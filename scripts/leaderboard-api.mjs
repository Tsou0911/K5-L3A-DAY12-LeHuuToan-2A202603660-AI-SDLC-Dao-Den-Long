import {mkdir,readFile,rename,writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'

const namePattern=/^[A-Za-z0-9_]{3,12}$/
const dataDirectory=process.env.ISLAND_DATA_DIR??join(homedir(),'.dao-den-long')
const dataPath=join(dataDirectory,'leaderboard.json')
let writes=Promise.resolve()
class InvalidEntry extends Error {}

function validEntry(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new InvalidEntry('Entry must be an object')
  const {name,score,nights_won,achieved_at,seed}=value
  if(typeof name!=='string'||!namePattern.test(name))throw new InvalidEntry('Name must be 3-12 ASCII letters, numbers, or underscores')
  if(!Number.isSafeInteger(score)||score<0)throw new InvalidEntry('Invalid score')
  if(!Number.isInteger(nights_won)||nights_won<0||nights_won>3)throw new InvalidEntry('Invalid nights_won')
  if(typeof achieved_at!=='string'||!Number.isFinite(Date.parse(achieved_at))||!/[zZ]|[+-]\d\d:\d\d$/.test(achieved_at))throw new InvalidEntry('achieved_at must be an ISO timestamp with timezone')
  if(!Number.isSafeInteger(seed))throw new InvalidEntry('Invalid seed')
  return {name,score,nights_won,achieved_at,seed}
}
function rank(entries){
  return entries.map(validEntry).sort((a,b)=>b.score-a.score||Date.parse(a.achieved_at)-Date.parse(b.achieved_at)).slice(0,10)
}
export async function loadLeaderboard(){
  let text
  try{text=await readFile(dataPath,'utf8')}
  catch(error){if(error.code==='ENOENT')return [];throw error}
  const data=JSON.parse(text)
  if(!data||!Array.isArray(data.entries))throw Error('Leaderboard file must contain an entries array')
  return rank(data.entries)
}
async function saveEntry(value){
  const entry=validEntry(value)
  const operation=writes.then(async()=>{
    const entries=rank([...(await loadLeaderboard()),entry])
    await mkdir(dataDirectory,{recursive:true})
    const temporary=dataPath+'.'+process.pid+'.tmp'
    await writeFile(temporary,JSON.stringify({entries},null,2)+'\n')
    await rename(temporary,dataPath)
    return entries
  })
  writes=operation.then(()=>undefined,()=>undefined)
  return operation
}
function send(response,status,value){
  response.statusCode=status
  response.setHeader('content-type','application/json; charset=utf-8')
  response.end(JSON.stringify(value))
}
function body(request){
  return new Promise((resolve,reject)=>{
    let text='',tooLarge=false
    request.setEncoding('utf8')
    request.on('data',chunk=>{
      if(tooLarge)return
      text+=chunk
      if(text.length>16384){tooLarge=true;reject(Error('Request body too large'))}
    })
    request.on('end',()=>{if(!tooLarge)resolve(text)})
    request.on('error',reject)
  })
}
export function createLeaderboardMiddleware(){
  return (request,response,next)=>{
    if(new URL(request.url,'http://localhost').pathname!=='/api/leaderboard'){next();return}
    void (async()=>{
      if(request.method==='GET'){
        send(response,200,{entries:await loadLeaderboard()})
        return
      }
      if(request.method!=='POST'){
        send(response,405,{error:'Method not allowed'})
        return
      }
      let payload
      try{payload=JSON.parse(await body(request))}
      catch(error){send(response,400,{error:error instanceof Error?error.message:'Invalid JSON'});return}
      let entry
      try{entry=validEntry(payload?.entry)}
      catch(error){send(response,400,{error:error instanceof Error?error.message:'Invalid leaderboard entry'});return}
      send(response,201,{entries:await saveEntry(entry)})
    })().catch(error=>{
      console.error('Leaderboard storage failed:',error)
      if(!response.headersSent)send(response,500,{error:'Leaderboard storage failed'})
      else response.destroy(error)
    })
  }
}
