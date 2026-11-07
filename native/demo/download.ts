// Native-only download seam. Canonical exports use both attached and detached anchors.
type DownloadBridge={postMessage:(value:object)=>void};
const bridge=():DownloadBridge|undefined=> (window as unknown as {webkit?:{messageHandlers:{nativeDownload?:DownloadBridge}}}).webkit?.messageHandlers.nativeDownload;
const eligible=(anchor:HTMLAnchorElement)=>Boolean(bridge()&&anchor.hasAttribute('download')&&anchor.href.startsWith('blob:'));
async function exportBlob(anchor:HTMLAnchorElement) {
 try {
  const response=await fetch(anchor.href),blob=await response.blob();
  if(blob.size>10_000_000) throw new Error('Demo exports are limited to 10 MB.');
  const data=await new Promise<string>((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);
   reader.onerror=()=>reject(new Error('Could not read this export. Try again.'));reader.readAsDataURL(blob);
  });
  bridge()?.postMessage({name:anchor.download||'Lumen-export',data});
 }catch(error){alert(error instanceof Error?error.message:'Could not export this file. Try again.');}
}
const ordinaryClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){
 // A detached anchor's click cannot bubble to document (Router/Activity exports).
 if(eligible(this)){void exportBlob(this);return;}
 ordinaryClick.call(this);
};
document.addEventListener('click',event=>{
 const anchor=(event.target as Element)?.closest<HTMLAnchorElement>('a[download]');
 if(!anchor||!eligible(anchor))return;
 event.preventDefault();void exportBlob(anchor);
},true);
export {};
