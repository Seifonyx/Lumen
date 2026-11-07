document.addEventListener('click', async event => {
  const anchor=(event.target as Element)?.closest<HTMLAnchorElement>('a[download]');
  const bridge=(window as unknown as {webkit?:{messageHandlers:{nativeDownload?:{postMessage:(value:object)=>void}}}}).webkit?.messageHandlers.nativeDownload;
  if(!anchor || !bridge || !anchor.href.startsWith('blob:')) return;
  event.preventDefault();
  const response=await fetch(anchor.href);
  const blob=await response.blob();
  if(blob.size>10_000_000) { alert('Demo exports are limited to 10 MB.'); return; }
  const reader=new FileReader();
  reader.onload=()=>bridge.postMessage({name:anchor.download || 'Lumen-export',data:String(reader.result).split(',')[1]});
  reader.readAsDataURL(blob);
},true);
export {};
