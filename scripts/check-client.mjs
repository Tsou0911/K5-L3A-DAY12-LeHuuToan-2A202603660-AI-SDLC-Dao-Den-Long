// QA-only Vite server: enter each island one interaction from victory.
// Only the initial scenario is substituted; the UI, renderer and engine run normally.
import {createServer} from 'vite'
import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
import {connect} from './browser-session.mjs'
const app=await createServer({server:{host:'127.0.0.1',port:4179,strictPort:true},plugins:[{
  name:'campaign-scenario',enforce:'pre',transform(code,id){
    if(!id.replaceAll('\\','/').endsWith('/src/client/main.ts'))return
    const from='engine = new GameEngine(42,{},night)'
    if(!code.includes(from))throw Error('Campaign scenario injection point changed')
    return code.replace(from,`engine = new GameEngine(42,{
      player:{pos:[islands[night].lamps[0][0]+1.7,islands[night].lamps[0][1],islands[night].lamps[0][2]],carried:10},
      lanterns:islands[night].lamps.slice(1).map((_,i)=>({id:'L'+(i+2),lit:true})),
      motes:[],shades:[],drifters:[]
    },night)`)
  }
}]})
await app.listen()
const {send,js,wait,key,close}=await connect(process.argv[2])
const out='docs/proof/phase-2',checks=[]
const click=id=>js("document.getElementById("+JSON.stringify(id)+").click()")
async function press(code,letter){
  await key(code,letter,'keyDown');await wait(80);await key(code,letter,'keyUp');await wait(80)
}
async function until(expression){
  for(let i=0;i<100;i++){if(await js(expression))return;await wait(100)}
  throw Error('UI timeout: '+expression)
}
try{
  await send('Page.navigate',{url:'http://127.0.0.1:4179/'})
  await until("Boolean(document.querySelector('#primary')?.onclick)")
  await click('primary')
  for(const night of [1,2,3]){
    await until("document.querySelector('#message').textContent.startsWith('Đêm "+night+"')")
    await click('primary');await until("document.querySelector('#result').hidden")
    for(const view of ['follow','overhead']){
      if(view==='overhead')await press('KeyV','v')
      await wait(150)
      const png=await send('Page.captureScreenshot',{format:'png'})
      writeFileSync(out+'/night-'+night+'-'+view+'.png',Buffer.from(png.data,'base64'))
    }
    await press('Escape','Escape')
    await until("document.querySelector('#message').textContent==='Tạm dừng'")
    await click('options');assert.equal(await js("document.querySelector('#settings').hidden"),false)
    await click('primary');await click('primary')
    await until("document.querySelector('#result').hidden")
    await press('KeyE','e')
    await until("!document.querySelector('#result').hidden")
    checks.push({night,result:await js("document.querySelector('#message').textContent")})
    if(night<3)await click('primary')
  }
  assert.match(checks[2].result,/Bình Minh/)
  writeFileSync(out+'/campaign.json',JSON.stringify({fixture:'one deposit from victory per night',checks},null,2)+'\n')
  console.log(checks)
}finally{
  await send('Page.navigate',{url:'http://127.0.0.1:4178/'})
  close();await app.close()
}
