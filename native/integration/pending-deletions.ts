type StoragePort=Pick<Storage,'getItem'|'setItem'>;
/** Reuses canonical ChatSync's existing account-owned JSON-array key; no new schema. */
export function pendingDeletions(uid:string,storage:StoragePort=localStorage):string[]{
 const raw=storage.getItem(`mr.sync.deletes.${uid}`);if(!raw)return [];
 const ids:unknown=JSON.parse(raw);if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'))throw Error('Pending cloud deletions could not be read.');
 return [...new Set(ids as string[])];
}
export function queueDeletion(uid:string,id:string,storage:StoragePort=localStorage){
 if(uid.startsWith('preview-')||id.startsWith('temporary-'))return;
 storage.setItem(`mr.sync.deletes.${uid}`,JSON.stringify([...new Set([...pendingDeletions(uid,storage),id])]));
}
