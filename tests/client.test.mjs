import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {search,parseRpc,parseResults,ENDPOINT}=require('../.build/client.cjs');
const response=(id,result,status=200,headers={})=>({status,headers,text:JSON.stringify({jsonrpc:'2.0',id,result})});
const init=()=>response(1,{protocolVersion:'2025-03-26'});
function server(tool={structuredContent:{results:[{title:'Official docs',url:'https://docs.obsidian.md/'}]}},opts={}) {
    const calls=[];
    const transport=async req=>{
        calls.push(req); const body=JSON.parse(req.body);
        if(body.method==='initialize') return response(1,{protocolVersion:'2025-03-26'},200,opts.session?{'mcp-session-id':'session-fixture'}:{});
        if(body.method==='notifications/initialized') return {status:202,headers:{},text:''};
        return response(2,tool,opts.status??200);
    };
    return {calls,transport};
}
test('empty key and blank/oversized query never send requests',async()=>{
    let count=0; const transport=async()=>{count++;return init();};
    for(const [q,k] of [['query',''],[' ','key'],['x'.repeat(2001),'key']]) await assert.rejects(search(q,k,transport));
    assert.equal(count,0);
});
test('initialize, notify, search: exact endpoint, normalized query and session propagation',async()=>{
    const {transport,calls}=server(undefined,{session:true});
    assert.equal((await search('  public query  ',' fixture-key ',transport))[0].title,'Official docs');
    assert.equal(calls.length,3); assert.ok(calls.every(c=>c.url===ENDPOINT));
    assert.equal(calls[1].headers['Mcp-Session-Id'],'session-fixture');
    assert.equal(calls[2].headers['MCP-Protocol-Version'],'2025-03-26');
    assert.equal(calls[2].headers['x-api-key'],'fixture-key');
    assert.deepEqual(JSON.parse(calls[2].body).params,{name:'search',arguments:{query:'public query'}});
    assert.ok(!calls.some(c=>c.body.includes('fixture-key')));
});
test('SSE handles comments, notifications and matching response only',()=>{
    const s=':ping\r\n\r\ndata: {"jsonrpc":"2.0","method":"notifications/message"}\r\n\r\nevent: message\r\ndata: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}\r\n\r\n';
    assert.deepEqual(parseRpc(s,2),{ok:true});
    assert.throws(()=>parseRpc(s,9),/unreadable/);
});
test('text result fallback, empty result and unsafe link rejection',()=>{
    const r=parseResults({content:[{type:'text',text:JSON.stringify({results:[{title:'<img onerror=x>',url:'https://example.org/'},{title:'bad',url:'javascript:alert(1)'},{title:'file',url:'file:///etc/passwd'},{title:'creds',url:'https://x:y@example.org'},{title:'',url:'https://example.org'}]})}]});
    assert.equal(r.length,1);assert.equal(r[0].title,'<img onerror=x>');
    assert.deepEqual(parseResults({structuredContent:{results:[]}}),[]);
    assert.throws(()=>parseResults({content:[{type:'text',text:'garbage'}]}),/unexpected/);
});
test('network/upstream errors are sanitized and tool calls are never retried',async()=>{
    for(const status of [401,403,429,500]) {
        const {transport,calls}=server(undefined,{status});
        await assert.rejects(search('q','key',transport)); assert.equal(calls.length,3);
    }
    const {transport}=server({isError:true,content:[{type:'text',text:'PRIVATE-KEY'}]});
    await assert.rejects(search('q','key',transport),e=>!e.message.includes('PRIVATE-KEY'));
    await assert.rejects(search('q','key',async()=>{throw Error('PRIVATE-KEY');}),e=>!e.message.includes('PRIVATE-KEY'));
    assert.throws(()=>parseRpc('{"jsonrpc":"2.0","id":2,"error":{"message":"PRIVATE-KEY"}}',2),e=>!e.message.includes('PRIVATE-KEY'));
});

test('unsupported protocol negotiation stops before tool invocation',async()=>{
    let count=0;
    await assert.rejects(search('q','key',async()=>{count++;return response(1,{protocolVersion:'1900-01-01'});}),/unsupported/);
    assert.equal(count,1);
});
