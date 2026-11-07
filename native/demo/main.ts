import './transport';
import './download';
import { selectDemo, signInPreview } from './account';
async function boot() {
  const smoke=(window as unknown as {__nativeSmoke?:boolean}).__nativeSmoke;
  if(smoke) { selectDemo('a'); signInPreview(); }
  await import('../../src/main');
  if(smoke) await import('./smoke');
}
void boot();
