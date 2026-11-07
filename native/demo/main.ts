import './transport';
import './download';
import { selectDemo, signInPreview } from './account';
async function boot() {
  const smoke=(window as unknown as {__nativeSmoke?:boolean}).__nativeSmoke;
  if(smoke) {
    // Diagnostic: a "boot" screenshot proves the page saw the smoke flag, before any other smoke step.
    (window as unknown as {webkit?:{messageHandlers:{nativeSmoke:{postMessage:(v:object)=>void}}}}).webkit?.messageHandlers.nativeSmoke.postMessage({stage:'boot'});
    selectDemo('a'); signInPreview();
  }
  await import('../../src/main');
  const {installAppLifecycle}=await import('./lifecycle');installAppLifecycle();
  if(smoke) await import('./smoke');
}
void boot();
