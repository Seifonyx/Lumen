import { build } from '../../node_modules/vite/dist/node/index.js';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../..', import.meta.url)));
await build({configFile:'native/vite.config.ts'});
