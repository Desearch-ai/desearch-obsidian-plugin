import {mkdirSync,copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const dir='artifacts/desearch-search'; mkdirSync(dir,{recursive:true});
const names=['main.js','manifest.json','README.md','LICENSE'];
for(const name of names) copyFileSync(name,`${dir}/${name}`);
execFileSync('zip',['-X','-q','-r','desearch-search-0.1.0.zip','desearch-search'],{cwd:'artifacts'});
const hashes=Object.fromEntries([...names.map(n=>`${dir}/${n}`),'artifacts/desearch-search-0.1.0.zip'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
writeFileSync('artifacts/SHA256.json',JSON.stringify(hashes,null,2)+'\n'); console.log(JSON.stringify(hashes,null,2));
