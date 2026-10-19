// Synthetic CPU measurements only. No credentials, inference or network access.
import {build} from 'rolldown';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const directory='node_modules/.cache/model-picker-benchmark';mkdirSync(directory,{recursive:true});
const file=`${directory}/benchmark.mjs`;
await build({input:'tests/performance/model-picker.ts',output:{file,format:'esm',codeSplitting:false},logLevel:'silent'});
const run=spawnSync(process.execPath,['--import','./tests/unit/setup.mjs',file],{stdio:'inherit'});
process.exit(run.status ?? 1);
