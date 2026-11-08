/** A new backend must never adopt an older test cache just because a Firebase UID matches. */
export function namespacedStorage(raw:Storage,prefix:string):Storage {
 const keys=()=>Array.from({length:raw.length},(_,i)=>raw.key(i)).filter((k):k is string=>Boolean(k?.startsWith(prefix))).map(k=>k.slice(prefix.length));
 const methods={
  getItem:(name:string)=>raw.getItem(prefix+String(name)),
  setItem:(name:string,value:string)=>raw.setItem(prefix+String(name),String(value)),
  removeItem:(name:string)=>raw.removeItem(prefix+String(name)),
  key:(index:number)=>keys()[index]??null,
  clear:()=>{for(const key of keys())raw.removeItem(prefix+key);}
 };
 return new Proxy(Object.create(StoragePrototype()) as Storage,{
  get:(_,name)=>name==='length'?keys().length:Object.hasOwn(methods,name)?methods[name as keyof typeof methods]:typeof name==='string'?methods.getItem(name):undefined,
  set:(_,name,value)=>{if(typeof name!=='string')return false;methods.setItem(name,String(value));return true;},
  deleteProperty:(_,name)=>{if(typeof name==='string')methods.removeItem(name);return true;},
  ownKeys:keys,
  getOwnPropertyDescriptor:(_,name)=>typeof name==='string'&&keys().includes(name)?{enumerable:true,configurable:true,writable:true,value:methods.getItem(name)}:undefined
 });
}
function StoragePrototype(){return typeof Storage==='undefined'?null:Storage.prototype;}

export function namespaceDatabases(factory:IDBFactory,prefix:string){
 const open=factory.open.bind(factory),remove=factory.deleteDatabase.bind(factory),list=factory.databases?.bind(factory);
 factory.open=(name,version)=>version===undefined?open(prefix+name):open(prefix+name,version);
 factory.deleteDatabase=name=>remove(prefix+name);
 if(list)factory.databases=async()=> (await list()).filter(d=>d.name?.startsWith(prefix)).map(d=>({...d,name:d.name!.slice(prefix.length)}));
}
