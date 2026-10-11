import assert from 'node:assert/strict';
import { previewUndo, undoCommit } from '../../src/lib/commit-undo';
import { setGitHubToken } from '../../src/lib/github';
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40),D='d'.repeat(40),E='e'.repeat(40);
const repo={owner:'demo',repo:'app',branch:'feature/test',defaultBranch:'main'};
let mode='ok',requests:{path:string;method:string;body:any}[]=[];
globalThis.fetch=async (url:any,init:any)=>{
 const path=String(url).replace('https://api.github.com',''),method=init?.method||'GET',body=init?.body?JSON.parse(init.body):undefined;
 requests.push({path,method,body});
 let data:any;
 if(path.includes('/git/ref/')){data={object:{sha:mode==='moved'?B:A}};if(mode==='changed-key'){setGitHubToken('other');}}
 else if(path.endsWith('/git/commits/'+A))data={message:'Change files',tree:{sha:D},parents:mode==='root'?[]:mode==='merge'?[{sha:B},{sha:C}]:[{sha:B}]};
 else if(path.endsWith('/git/commits/'+B))data={tree:{sha:C}};
 else if(path.includes('/commits/'+A+'?'))data={files:[{filename:'image.png',status:'added'},{filename:'run.sh',status:'modified',patch:'original diff'}]};
 else if(method==='POST'){data={sha:E};if(mode==='late-key')setGitHubToken('late');}
 else if(method==='PATCH'){if(mode==='protected')return new Response(JSON.stringify({message:'Protected branch'}),{status:422});data={object:{sha:E}};}
 else throw Error('Unexpected API '+path);
 return new Response(JSON.stringify(data),{status:200});
};
setGitHubToken('fixture');const preview=await previewUndo(repo);
assert.equal(preview.tree,C);assert.equal(preview.parent,B);assert.equal(preview.files[0].path,'image.png');assert.ok(requests.every(r=>r.method==='GET'));
requests=[];const result=await undoCommit(preview,()=>{});assert.equal(result.sha,E);
assert.deepEqual(requests.find(r=>r.method==='POST')?.body,{message:`Revert "Change files"\n\nThis reverts commit ${A}.`,tree:C,parents:[A]});
assert.deepEqual(requests.find(r=>r.method==='PATCH')?.body,{sha:E,force:false});
for(const m of ['root','merge']){mode=m;requests=[];await assert.rejects(()=>previewUndo(repo));assert.ok(requests.every(r=>r.method==='GET'));}
mode='moved';requests=[];await assert.rejects(()=>undoCommit(preview,()=>{}),/branch changed/);assert.ok(requests.every(r=>r.method==='GET'));
mode='protected';await assert.rejects(()=>undoCommit(preview,()=>{}),/Check the branch/);
mode='ok';requests=[];await assert.rejects(()=>undoCommit(preview,()=>{throw Error('Workspace changed')}),/Workspace/);assert.equal(requests.length,0);
mode='changed-key';requests=[];await assert.rejects(()=>previewUndo(repo),/key changed/);assert.equal(requests.length,1);
setGitHubToken('fixture');mode='ok';const fresh=await previewUndo(repo);mode='late-key';requests=[];await assert.rejects(()=>undoCommit(fresh,()=>{}),/key changed/);assert.ok(!requests.some(r=>r.method==='PATCH'));
requests=[];await assert.rejects(()=>undoCommit(fresh,()=>{}),/key changed/);assert.equal(requests.length,0);
console.log('PASS whole commit undo: exact parent tree, history preservation, non-forced update, moved branches, merge/root refusal, workspace/key guards and protected branch errors');
