import {build} from 'esbuild';
await build({entryPoints:['src/main.ts'],bundle:true,external:['obsidian'],platform:'browser',format:'cjs',target:'es2022',outfile:'main.js',logLevel:'warning'});
if(process.argv.includes('--test')) await build({entryPoints:['src/client.ts'],bundle:true,platform:'node',format:'cjs',target:'node22',outfile:'.build/client.cjs'});
