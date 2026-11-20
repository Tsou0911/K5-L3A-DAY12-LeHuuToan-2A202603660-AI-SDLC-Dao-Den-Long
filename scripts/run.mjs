import {createServer} from 'node:http'
import {access,readFile,stat,writeFile} from 'node:fs/promises'
import {constants} from 'node:fs'
import {extname,join,relative,resolve,isAbsolute} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'
import {createLeaderboardMiddleware,loadLeaderboard} from './leaderboard-api.mjs'

const root=resolve(fileURLToPath(new URL('../dist/client/',import.meta.url)))
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'}
const api=createLeaderboardMiddleware()

async function main(){
  const {values}=parseArgs({strict:true,options:{'export-leaderboard':{type:'string'}}})
  if(values['export-leaderboard']!==undefined){
    const entries=await loadLeaderboard()
    await writeFile(values['export-leaderboard'],JSON.stringify({entries},null,2)+'\n')
    console.log(`Exported ${entries.length} leaderboard entries to ${values['export-leaderboard']}`)
    return
  }
  await access(root,constants.R_OK)
  const port=Number(process.env.PORT??4178)
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT')
  async function serveFile(request,response){
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405).end();return}
    let pathname
    try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname)}
    catch{response.writeHead(400).end('Invalid URL');return}
    let target=resolve(root,'.'+pathname)
    const rel=relative(root,target)
    if(rel==='..'||rel.startsWith('..'+(process.platform==='win32'?'\\':'/'))||isAbsolute(rel)){response.writeHead(403).end();return}
    try{
      if((await stat(target)).isDirectory())target=join(target,'index.html')
      const data=await readFile(target)
      response.writeHead(200,{'content-type':contentTypes[extname(target)]??'application/octet-stream','content-length':data.length})
      response.end(request.method==='HEAD'?undefined:data)
    }catch(error){
      if(error.code==='ENOENT'){response.writeHead(404).end('Not found');return}
      console.error('Static file read failed:',error)
      response.writeHead(500).end('Static file error')
    }
  }
  const server=createServer((request,response)=>api(request,response,()=>void serveFile(request,response)))
  server.listen(port,'127.0.0.1',()=>console.log(`Đảo Đèn Lồng: http://127.0.0.1:${port}/`))
  const stop=()=>server.close(error=>{if(error){console.error(error);process.exitCode=1}})
  process.once('SIGINT',stop)
  process.once('SIGTERM',stop)
}

main().catch(error=>{
  console.error(error instanceof Error?error.message:String(error))
  process.exitCode=1
})
