import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {search}=require('../.build/client.cjs');
let requests=0;
const transport=async request => {
    requests++;
    const r=await fetch(request.url,{method:request.method,headers:request.headers,body:request.body,signal:AbortSignal.timeout(30000),redirect:'error'});
    return {status:r.status,headers:Object.fromEntries(r.headers),text:await r.text()};
};
try {await search('Obsidian documentation','',transport); throw Error('Missing-key check failed');} catch(e) {if(requests!==0) throw e; console.log('Missing key: blocked locally, zero requests');}
try {await search('Obsidian documentation','invalid-test-key-not-a-credential',transport); throw Error('Invalid-key check failed');} catch(e) {
    if(!/key|rejected/i.test(e.message)) throw new Error('Invalid-key path did not return a sanitized auth error');
    console.log('Invalid key: '+e.message);
}
const key=process.env.DESEARCH_QA_API_KEY;
if(!key) throw new Error('Provide DESEARCH_QA_API_KEY through mc secret run');
const results=await search('Obsidian official plugin developer documentation',key,transport);
if(!results.length) throw new Error('Live search returned no titled links');
console.log(JSON.stringify({endpoint:'https://mcp.desearch.ai/mcp',query:'Obsidian official plugin developer documentation',count:results.length,results:results.slice(0,5)},null,2));
