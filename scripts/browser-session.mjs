export async function connect(port='9232'){
const tabs=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())
const tab=tabs.find(t=>t.type==='page' && /^http:\/\/127\.0\.0\.1:41(78|79)/.test(t.url))
if(!tab)throw Error('Open the local production preview on port 4178 first')
const ws=new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject})
let seq=0
const pending=new Map()
ws.onmessage=e=>{
  const m=JSON.parse(e.data),p=pending.get(m.id)
  if(p){pending.delete(m.id);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result)}
}
function send(method,params={}){
  const id=++seq
  return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))})
}
async function js(expression){
  const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true})
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text)
  return r.result.value
}
const wait=ms=>new Promise(r=>setTimeout(r,ms))
async function key(code,key,type){await send('Input.dispatchKeyEvent',{type,code,key})}
  return {send,js,wait,key,close:()=>ws.close()}
}
