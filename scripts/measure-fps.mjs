// Run against a production preview with a local Chromium DevTools port.
import {writeFileSync,mkdirSync} from 'node:fs'
import {cpus,release,platform} from 'node:os'
const out='docs/proof/phase-3'
mkdirSync(out,{recursive:true})
import {connect} from './browser-session.mjs'
const {send,js,wait,key,close}=await connect(process.argv[2])
try{
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false})
  await send('Page.reload',{ignoreCache:true})
  for(let i=0;i<100 && !await js("document.querySelector('#primary')?.onclick != null");i++)await wait(100)
  await js("document.querySelector('#primary').click();document.querySelector('#primary').click()")
  await wait(1200)
  if(!await js("document.querySelector('#result').hidden"))throw Error('Game is not running')
  await key('KeyW','w','keyDown');await wait(650);await key('KeyW','w','keyUp')
  const sample=()=>js(`new Promise(resolve=>{
    const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info')
    let frames=0,first
    const start=document.querySelector('#time').textContent
    function step(now){
      first??=now
      if(now-first>=5000)resolve({frames,elapsed_ms:now-first,fps:1000*frames/(now-first),width:innerWidth,height:innerHeight,
        gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),browser:navigator.userAgent,start,end:document.querySelector('#time').textContent})
      else{frames++;requestAnimationFrame(step)}
    }requestAnimationFrame(step)
  })`)
  const follow=await sample()
  for(const [name,toggle] of [['follow',false],['overhead',true]]){
    if(toggle){await key('KeyV','v','keyDown');await key('KeyV','v','keyUp');await wait(200)}
    const png=await send('Page.captureScreenshot',{format:'png'})
    writeFileSync(out+'/camera-'+name+'.png',Buffer.from(png.data,'base64'))
  }
  const overhead=await sample()
  const result={platform:platform(),os:release(),cpu:cpus()[0].model,mode:'production WebGL, night 1',follow,overhead,
    mean_fps:1000*(follow.frames+overhead.frames)/(follow.elapsed_ms+overhead.elapsed_ms)}
  writeFileSync(out+'/fps.json',JSON.stringify(result,null,2)+'\n')
  console.log(JSON.stringify(result))
}finally{close()}
