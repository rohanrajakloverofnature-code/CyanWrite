// Run: node tests/browser-routing-server.mjs
// Open http://127.0.0.1:8794/web/ and /web/?native=1.
// Read document.documentElement.dataset.routingReview in browser devtools.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = `<script>
window.__routingCalls=[];
if(new URLSearchParams(location.search).has('persisted'))localStorage.setItem('cyanwrite-v1',JSON.stringify({options:{aiProvider:'deepseek',aiBaseUrl:'https://api.deepseek.com/v1/chat/completions',aiModel:'',ai:false,aiAuto:false}}));
if(new URLSearchParams(location.search).has('native')) window.CyanAndroid={
requestAI(id,url,headers,body){const payload=JSON.parse(body);window.__routingCalls.push({url,method:'POST',body:payload});const content=payload.messages[0].content.includes('Translate the entire text')?'{"translation":"नमस्ते।"}':'{"issues":[]}';queueMicrotask(()=>window.__cyanAIReply(id,window.__routingStatus||200,JSON.stringify({choices:[{message:{content}}]})));},cancelAI(){}
};
</script>`;
http.createServer(async (req,res) => {
  const url=new URL(req.url,'http://localhost');
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  let rel;try{rel=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
  if(rel==='/web/')rel='/web/index.html';
  const file=path.resolve(root,'.'+rel);
  if(!file.startsWith(root+path.sep) || (!rel.startsWith('/web/') && !rel.startsWith('/tests/'))){res.writeHead(403).end();return;}
  try{
    let body=await readFile(file);
    if(rel==='/web/index.html')body=Buffer.from(body.toString().replace('<head>','<head>'+fixture).replace('</body>','<script type="module" src="../tests/browser-deepseek-routing-review.js"></script></body>'));
    res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css':'application/octet-stream','Cache-Control':'no-store'}).end(body);
  }catch{res.writeHead(404).end();}
}).listen(8794,'127.0.0.1',()=>console.log('Mock-only browser routing review: http://127.0.0.1:8794/web/ (add ?native=1 for mock bridge)'));
