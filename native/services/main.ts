import './account-storage';
import './transport';
import '../demo/download';
async function boot(){
 await import('../../src/main');
 const {installServiceLifecycle}=await import('./lifecycle');installServiceLifecycle();
}
void boot();
