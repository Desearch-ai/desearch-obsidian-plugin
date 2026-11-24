import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile,spawnSync} from 'node:child_process';
import {promisify} from 'node:util';

// Real subprocess fixtures exercise only CLI teardown, never plugin/API behavior.
for (const stubborn of [false,true]) {
    test(`desktop harness exits unaided with ${stubborn ? 'SIGTERM-resistant' : 'graceful'} host`,{skip:process.platform==='win32',timeout:20000},async () => {
        const root=mkdtempSync(join(tmpdir(),'desearch-shutdown-'));
        try {
            const binary=join(root,'fixture-host');
            writeFileSync(binary,`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const profile=process.argv.find(arg=>arg.startsWith('--user-data-dir=')).split('=')[1];
${stubborn ? "process.on('SIGTERM',()=>{});" : ''}
fs.writeFileSync(path.join(path.dirname(profile),'result.json'),JSON.stringify({ok:true,fixture:'teardown only'}));
setInterval(()=>{},1000);
`,{mode:0o700});
            const run=join(root,'run');
            await promisify(execFile)(process.execPath,['scripts/desktop-smoke.mjs',run,binary],{
                timeout:15000,env:{...process.env,DESEARCH_QA_API_KEY:''},
            });
            const shutdown=JSON.parse(readFileSync(join(run,'shutdown.json'),'utf8'));
            assert.equal(shutdown.stopped,true);
            assert.equal(shutdown.escalated,stubborn);
            const probe=spawnSync('ps',['-axo','pgid=,stat='],{encoding:'utf8'});
            assert.equal(probe.status,0);
            assert.equal(probe.stdout.split('\n').some(line=>{
                const [group,state]=line.trim().split(/\s+/);
                return Number(group)===shutdown.processGroup && !state?.startsWith('Z');
            }),false);
        } finally {rmSync(root,{recursive:true,force:true});}
    });
}
