'use strict';
const {app,BrowserWindow,session,shell}=require('electron');
const http=require('node:http');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
const BASE='https://knksignage.vamtratech.com';
let mainWindow,loginWindow,server,port,updating=false,loginRequested=false,cache,manifest={slides:[],settings:{seconds:6,volume:80}};
const types={'.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'};
function contentType(t){return t.startsWith('video/')||t.startsWith('image/')?t:'application/octet-stream'}
function mimeExt(t){return ({'video/mp4':'.mp4','video/webm':'.webm','video/quicktime':'.mov','image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif'})[t]||'.bin'}
async function loadCache(){cache=path.join(app.getPath('userData'),'offline-media');await fsp.mkdir(cache,{recursive:true});try{manifest=JSON.parse(await fsp.readFile(path.join(cache,'playlist.json'),'utf8'))}catch{}}
function send(res,code,data,type='application/json'){res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data)}
async function serve(req,res){try{
 const u=new URL(req.url,'http://127.0.0.1');
 if(u.pathname==='/api/playlist')return send(res,200,JSON.stringify(manifest));
 if(u.pathname==='/player'||u.pathname==='/')return send(res,200,await fsp.readFile(path.join(__dirname,'player.html')),'text/html; charset=utf-8');
 if(u.pathname.startsWith('/api/signage-file/')){
  const id=decodeURIComponent(u.pathname.slice('/api/signage-file/'.length));
  if(!/^[a-zA-Z0-9_-]+$/.test(id))return send(res,404,'Not found','text/plain');
  const item=manifest.slides.find(x=>String(x.id)===id);
  if(!item)return send(res,404,'Not found','text/plain');
  const filename=path.join(cache,id+mimeExt(item.mediaType||''));
  const stat=await fsp.stat(filename);const total=stat.size;
  const headers={'Content-Type':contentType(item.mediaType||''),'Accept-Ranges':'bytes','Cache-Control':'no-store'};
  let start=0,end=total-1,code=200;
  const range=req.headers.range;
  if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m)return send(res,416,'Invalid range','text/plain');
   if(m[1]===''&&m[2]!==''){const suffix=Number(m[2]);start=Math.max(0,total-suffix)}
   else {start=Number(m[1]);end=m[2]?Math.min(total-1,Number(m[2])):total-1}
   if(start>=total||end<start){res.writeHead(416,{'Content-Range':'bytes */'+total});res.end();return}
   code=206;headers['Content-Range']='bytes '+start+'-'+end+'/'+total;
  }
  headers['Content-Length']=end-start+1;res.writeHead(code,headers);
  if(req.method==='HEAD'){res.end();return}
  fs.createReadStream(filename,{start,end}).on('error',()=>res.destroy()).pipe(res);return;
 }
 send(res,404,'Not found','text/plain');
}catch(e){send(res,500,'Unavailable','text/plain')}}
async function startServer(){server=http.createServer((req,res)=>{serve(req,res)});await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok)});port=server.address().port}
async function sync(){if(updating)return;updating=true;try{
 const ses=session.fromPartition('persist:knk-login');
 const response=await ses.fetch(BASE+'/api/playlist',{headers:{'Accept':'application/json','Cache-Control':'no-cache'}});
 if(!response.ok)throw Error('Cloud playlist HTTP '+response.status);
 const remote=await response.json();
 if(!Array.isArray(remote.slides))throw Error('Cloud login required');
 const slides=remote.slides.filter(s=>s.enabled!==false&&s.id&&s.url);
 for(const slide of slides){
  const id=String(slide.id);if(!/^[a-zA-Z0-9_-]+$/.test(id))continue;
  const file=path.join(cache,id+mimeExt(slide.mediaType||''));
  try{if((await fsp.stat(file)).size>0)continue}catch{}
  const target=new URL(slide.url,BASE);if(target.origin!==new URL(BASE).origin)throw Error('Unexpected media host');
  const response=await ses.fetch(target.href);
  if(!response.ok||!(response.headers.get('content-type')||'').startsWith(slide.mediaType?.split('/')[0]+'/'))throw Error('Media download failed: '+id);
  const tmp=file+'.download';
  try{await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(tmp));await fsp.rename(tmp,file)}
  catch(e){await fsp.rm(tmp,{force:true});throw e}
 }
 const safe=slides.filter(s=>/^[a-zA-Z0-9_-]+$/.test(String(s.id))).map(s=>({...s,url:'/api/signage-file/'+encodeURIComponent(s.id)}));
 const next={slides:safe,settings:remote.settings||{seconds:6,volume:80}};
 const tmp=path.join(cache,'playlist.tmp');await fsp.writeFile(tmp,JSON.stringify(next));await fsp.rename(tmp,path.join(cache,'playlist.json'));
 manifest=next;
 console.log('KNK signage cache updated:',safe.length,'items');
 if(loginWindow&&!loginWindow.isDestroyed()){loginWindow.close()}
 if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.executeJavaScript('window.dispatchEvent(new Event("knk-playlist-updated"))').catch(()=>{});
}catch(e){console.warn('KNK signage sync:',e.message);if(!manifest.slides.length&&!loginRequested&&/HTTP 401|HTTP 403|Cloud login required/.test(e.message))openLogin()}
finally{updating=false}}
function openLogin(){if(loginWindow&&!loginWindow.isDestroyed()){loginWindow.focus();return}
 loginRequested=true;
 loginWindow=new BrowserWindow({width:900,height:720,title:'KNK Signage — Sign in to synchronize',autoHideMenuBar:true,webPreferences:{partition:'persist:knk-login',sandbox:true,contextIsolation:true,nodeIntegration:false}});
 loginWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 // Cloudflare Access authentication only. Never show the upload/dashboard interface in the player.
 loginWindow.loadURL(BASE+'/cdn-cgi/access/login?redirect_url='+encodeURIComponent(BASE+'/player'));
 loginWindow.webContents.on('did-navigate',(event,url)=>{if(url.startsWith(BASE+'/player'))sync()});
 loginWindow.webContents.on('did-finish-load',()=>{sync()});
 loginWindow.on('closed',()=>{loginWindow=null;loginRequested=false});
}
async function createWindow(){mainWindow=new BrowserWindow({width:720,height:1080,backgroundColor:'#000000',autoHideMenuBar:true,fullscreen:true,title:'KNK Signage Player',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 mainWindow.webContents.on('before-input-event',(event,input)=>{
  if(input.type!=='keyDown')return;
  if(input.key==='F11'){mainWindow.setFullScreen(!mainWindow.isFullScreen());event.preventDefault()}
  else if(input.key==='Escape'){mainWindow.setFullScreen(false);event.preventDefault()}
  else if(input.control&&input.shift&&input.key.toLowerCase()==='l'){openLogin();event.preventDefault()}
  else if(input.control&&input.key.toLowerCase()==='r'){mainWindow.reload();event.preventDefault()}
 });
 await mainWindow.loadURL('http://127.0.0.1:'+port+'/player');
 mainWindow.on('closed',()=>{mainWindow=null});
}
app.whenReady().then(async()=>{await loadCache();await startServer();if(app.isPackaged)app.setLoginItemSettings({openAtLogin:true});await createWindow();await sync();setInterval(sync,120000)}).catch(console.error);
app.on('window-all-closed',()=>{app.quit()});
app.on('before-quit',()=>{server?.close()});
