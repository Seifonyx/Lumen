import config from 'lumen:service-config';
import {namespacedStorage,namespaceDatabases} from '../integration/storage-namespace';
// Existing demo/test databases stay intact at the same origin. No imports/migrations into real accounts.
if(config.mode==='account-connected'){
 const prefix='lumen.account.'+config.projectId+'.';
 Object.defineProperty(window,'localStorage',{configurable:true,value:namespacedStorage(window.localStorage,prefix)});
 Object.defineProperty(window,'sessionStorage',{configurable:true,value:namespacedStorage(window.sessionStorage,prefix)});
 // WebKit may return another IDBFactory wrapper on the next Window getter access.
 const databases=window.indexedDB;
 namespaceDatabases(databases,prefix);
 Object.defineProperty(window,'indexedDB',{configurable:true,value:databases});
}
