import {access,constants,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs'
import {promisify} from 'node:util'
import {tmpdir,homedir,type as osType,release,arch} from 'node:os'
import {join} from 'node:path'
import {spawn} from 'node:child_process'
import {createServer} from 'vite'
import {parseArgs} from 'node:util'
import {createServer as createTcpServer} from 'node:net'
import {performance} from 'node:perf_hooks'
import {fileURLToPath} from 'node:url'

const exists=promisify(access)
const processStarted=Date.now()
const contract=JSON.parse(readFileSync(fileURLToPath(new URL('../game.contract.json',import.meta.url)),'utf8'))

function options(){
  const {values}=parseArgs({options:{seed:{type:'string'},duration:{type:'string'},out:{type:'string'},screenshot:{type:'string'}}})
  const seed=Number(values.seed??42),duration=Number(values.duration??30)
  if(!Number.isSafeInteger(seed))throw Error('Invalid --seed')
  if(!Number.isFinite(duration)||duration<=0||duration>3600)throw Error('Invalid --duration')
  if(!values.out)throw Error('Expected --out PATH')
  return {seed,duration,out:values.out,screenshot:values.screenshot}
}
async function browserExecutable(){
  if(process.env.CHROME_PATH){
    await exists(process.env.CHROME_PATH,constants.X_OK).catch(()=>exists(process.env.CHROME_PATH))
    return process.env.CHROME_PATH
  }
  const candidates=process.platform==='win32'?[
    join(process.env.PROGRAMFILES??'C:\\Program Files','Google','Chrome','Application','chrome.exe'),
    join(process.env['PROGRAMFILES(X86)']??'C:\\Program Files (x86)','Microsoft','Edge','Application','msedge.exe'),
    join(process.env.LOCALAPPDATA??join(homedir(),'AppData','Local'),'Google','Chrome','Application','chrome.exe')
  ]:process.platform==='darwin'?[
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ]:[
    '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/microsoft-edge'
  ]
  for(const candidate of candidates)try{await exists(candidate);return candidate}catch{}
  throw Error('Chrome/Edge was not found. Set CHROME_PATH to a Chromium browser executable.')
}
async function freePort(){
  const server=createTcpServer()
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve))
  const port=server.address().port
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
  return port
}
async function waitForCdp(port,child){
  const deadline=Date.now()+20000
  while(Date.now()<deadline){
    if(child.exitCode!==null||child.signalCode!==null)throw Error(`Browser exited with code ${child.exitCode??child.signalCode}`)
    try{return await fetch(`http://127.0.0.1:${port}/json/version`).then(response=>response.json())}catch{}
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  throw Error('Timed out waiting for the browser debugging endpoint')
}
async function waitForTarget(port){
  const deadline=Date.now()+10000
  while(Date.now()<deadline){
    const targets=await fetch(`http://127.0.0.1:${port}/json/list`).then(response=>response.json())
    const page=targets.find(target=>target.type==='page')
    if(page)return page
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  throw Error('Browser did not open a page')
}
function connect(url){
  const ws=new WebSocket(url),pending=new Map()
  let id=0
  ws.onmessage=event=>{
    const message=JSON.parse(String(event.data)),waiter=pending.get(message.id)
    if(!waiter)return
    pending.delete(message.id)
    if(message.error)waiter.reject(Error(message.error.message))
    else waiter.resolve(message.result)
  }
  const ready=new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
  return {ready,close:()=>ws.close(),send(method,params={}){
    const requestId=++id
    return new Promise((resolve,reject)=>{
      pending.set(requestId,{resolve,reject})
      ws.send(JSON.stringify({id:requestId,method,params}))
    })
  }}
}
async function evaluate(cdp,expression){
  const result=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text)
  return result.result.value
}
function round(value){return Number(value.toFixed(1))}

async function main(){
  const {seed,duration,out,screenshot}=options()
  const binary=await browserExecutable(),port=await freePort()
  const profile=mkdtempSync(join(tmpdir(),'island-bench-'))
  const app=await createServer({server:{host:'127.0.0.1',port:0,strictPort:true}})
  let browser,cdp
  try{
    await app.listen()
    const address=app.httpServer.address()
    if(!address||typeof address==='string')throw Error('Vite did not bind a TCP port')
    const args=[
      `--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--remote-allow-origins=*',
      '--window-size=1280,720','--window-position=0,0','--disable-gpu-vsync','--disable-vsync',
      '--disable-frame-rate-limit','--disable-background-timer-throttling','--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows','--no-first-run','--no-default-browser-check',
      'about:blank'
    ]
    if(process.platform==='linux'&&process.getuid?.()===0)args.unshift('--no-sandbox')
    browser=spawn(binary,args,{stdio:'ignore'})
    await waitForCdp(port,browser)
    const target=await waitForTarget(port)
    cdp=connect(target.webSocketDebuggerUrl)
    await cdp.ready
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false})
    await cdp.send('Page.navigate',{url:`http://127.0.0.1:${address.port}/?bench=1&seed=${seed}&duration=${duration}`})
    const started=performance.now()
    const deadline=started+(duration+25)*1000
    let result=null,loadMs=null
    while(performance.now()<deadline){
      result=await evaluate(cdp,'window.__islandBench?.result ?? null')
      if(result)break
      const readyAt=await evaluate(cdp,'window.__islandBench?.readyAt ?? null')
      if(readyAt!==null&&loadMs===null){
        const timeOrigin=await evaluate(cdp,'performance.timeOrigin')
        loadMs=Math.max(0,round(timeOrigin+readyAt-processStarted))
        const viewport=await evaluate(cdp,'({width:innerWidth,height:innerHeight})')
        if(viewport.width!==1280||viewport.height!==720)throw Error(`Expected 1280x720 viewport, got ${viewport.width}x${viewport.height}`)
      }
      await new Promise(resolve=>setTimeout(resolve,100))
    }
    if(!result)throw Error('Benchmark did not finish before timeout')
    const report={
      contract_version:contract.contract_version,
      avg_fps:round(result.avg_fps),p1_low_fps:round(result.p1_low_fps),
      frame_ms_p95:round(result.frame_ms_p95),frames:result.frames,
      load_ms:loadMs??round(result.load_ms),peak_mem_mb:null,
      vsync_off:true,renderer:result.renderer,
      os:`${osType()} ${release()} (${arch()})`
    }
    writeFileSync(out,JSON.stringify(report,null,2)+'\n')
    if(screenshot){
      const capture=await cdp.send('Page.captureScreenshot',{format:'png'})
      writeFileSync(screenshot,Buffer.from(capture.data,'base64'))
    }
    console.log(JSON.stringify(report))
  }finally{
    cdp?.close()
    if(browser&&browser.exitCode===null){
      const exited=new Promise(resolve=>browser.once('exit',resolve))
      browser.kill()
      await exited
    }
    await app.close()
    rmSync(profile,{recursive:true,force:true})
  }
}

main().catch(error=>{
  console.error(error instanceof Error?error.message:String(error))
  process.exitCode=1
})
