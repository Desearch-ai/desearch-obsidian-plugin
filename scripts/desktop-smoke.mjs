// Local-only disposable-vault harness. Requires a supplied official Obsidian .app.
import {mkdirSync,writeFileSync,copyFileSync,existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
const root=resolve(process.argv[2]||'../host-smoke');
const binary=resolve(process.argv[3]||'../host-mount/Obsidian.app/Contents/MacOS/Obsidian');
const vault=resolve(root,'vault'), profile=resolve(root,'profile'), output=resolve(root,'result.json');
if(process.platform==='darwin' && spawnSync('pgrep',['-x','Obsidian']).status===0) throw new Error('Close other Obsidian instances before this isolated smoke test');
if(existsSync(output)) throw new Error('Use a fresh smoke directory; never overwrite evidence');
for(const dir of [profile,`${vault}/.obsidian/plugins/desearch-search`,`${vault}/.obsidian/plugins/host-smoke`]) mkdirSync(dir,{recursive:true});
for(const name of ['manifest.json','main.js']) copyFileSync(name,`${vault}/.obsidian/plugins/desearch-search/${name}`);
writeFileSync(`${profile}/obsidian.json`,JSON.stringify({cli:true,vaults:{a1127aa1127aa112:{path:vault,ts:Date.now(),open:true}}}));
writeFileSync(`${vault}/.obsidian/community-plugins.json`,JSON.stringify(['desearch-search','host-smoke']));
writeFileSync(`${vault}/.obsidian/plugins/host-smoke/manifest.json`,JSON.stringify({id:'host-smoke',name:'Local smoke harness',version:'1.0.0',minAppVersion:'1.15.1',author:'Desearch',isDesktopOnly:true}));
const driver=`const {Plugin,apiVersion}=require('obsidian');
const fs=require('fs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=class extends Plugin {
 onload(){this.app.workspace.onLayoutReady(()=>{void this.run();});}
 async run(){
  const out={host:apiVersion,checks:[]};
  const check=(condition,name)=>{if(!condition) throw Error(name);out.checks.push(name);};
  const submit=async(query)=>{
    this.app.commands.executeCommandById('desearch-search:search-web');
    await wait(50);
    const modal=[...document.querySelectorAll('.modal-content')].find(el=>el.querySelector('h2')?.textContent==='Search with Desearch');
    if(!modal) throw Error('Search modal absent');
    modal.querySelector('input').value=query;
    modal.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    for(let n=0;n<350;n++){await wait(100);if(modal.querySelector('[role=status]').textContent!=='Searching…') return modal;}
    throw Error('Native search did not settle');
  };
  const close=()=>document.querySelector('.modal-close-button')?.click();
  try {
   const plugin=this.app.plugins.plugins['desearch-search'];check(!!plugin,'plugin loaded from local install');
   const missing=await submit('Obsidian documentation');check(/API key/.test(missing.querySelector('[role=status]').textContent),'missing key visible');close();await wait(50);
   plugin.apiKey='invalid-test-key-not-a-credential';const invalid=await submit('Obsidian documentation');check(/key|rejected/.test(invalid.querySelector('[role=status]').textContent),'invalid key sanitized');close();await wait(50);
   plugin.apiKey=process.env.DESEARCH_QA_API_KEY||'';check(!!plugin.apiKey,'test credential supplied only in process memory');
   const live=await submit('Obsidian official plugin developer documentation');
   const links=[...live.querySelectorAll('a')].map(a=>({title:a.textContent,url:a.href}));check(links.length>0,'live titled search rendered');out.results=links.slice(0,5);close();await wait(50);
   check(!fs.existsSync(this.app.vault.adapter.basePath+'/.obsidian/plugins/desearch-search/data.json'),'no persisted key file');
   await this.app.plugins.disablePlugin('desearch-search');check(plugin.apiKey==='','unload clears key');
   await this.app.plugins.enablePlugin('desearch-search');check(this.app.plugins.plugins['desearch-search'].apiKey==='','reload has empty key');
   out.ok=true;
  }catch{out.ok=false;out.failure='Native smoke assertion failed; see completed checks';}
  fs.writeFileSync(${JSON.stringify(output)},JSON.stringify(out,null,2));
 }
};`;
writeFileSync(`${vault}/.obsidian/plugins/host-smoke/main.js`,driver);
const child=spawn(binary,[`--user-data-dir=${profile}`,'--disable-gpu'],{env:process.env,stdio:'ignore'});
let result;
// Official CLI enables community plugins in this disposable profile only.
let setupActive=false;
const enableTimer=setInterval(()=>{
 if(setupActive) return;
 setupActive=true;
 const setup=net.connect(os.homedir()+'/.obsidian-cli.sock',()=>setup.write(JSON.stringify({argv:['plugins:restrict','off'],tty:false,cwd:vault})+'\n'));
 const timeout=setTimeout(()=>setup.destroy(),4000);
 setup.on('data',buffer=>{if(buffer.toString().includes('Restricted mode disabled')) clearInterval(enableTimer);});
 setup.on('error',()=>{});
 setup.on('close',()=>{clearTimeout(timeout);setupActive=false;});
},5000);
try {
 for(let n=0;n<900;n++) {
  if(process.platform==='darwin' && spawnSync('pgrep',['-x','Obsidian']).status===0) throw new Error('Close other Obsidian instances before this isolated smoke test');
if(existsSync(output)){result=JSON.parse(readFileSync(output,'utf8'));console.log(JSON.stringify(result,null,2));break;}
  if(child.exitCode!==null) throw new Error('Isolated Obsidian exited before smoke result');
  await new Promise(r=>setTimeout(r,100));
 }
 if(!result) throw new Error('Native smoke timed out; no result file produced');
 if(!result.ok) process.exitCode=1;
}finally{clearInterval(enableTimer);child.kill('SIGTERM');}
