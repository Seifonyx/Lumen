import { useStore } from '../../src/store';
import { openRoutingCenter, closeRoutingCenter, showRoutingSection } from '../../src/lib/routing-center';
import { blocked } from './transport';
import { selectDemo, signInPreview, signOutUser } from './account';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve,ms));
async function until(test:()=>boolean) {
  for(let i=0;i<100;i++) { if(test()) return; await delay(100); }
  throw new Error('Timed out waiting for demo screen');
}
function report(value: object) {
  (window as unknown as {webkit?:{messageHandlers:{nativeSmoke:{postMessage:(v:object)=>void}}}}).webkit?.messageHandlers.nativeSmoke.postMessage(value);
}
async function capture(stage: string) {
  await document.fonts.ready; await delay(500); report({stage}); await delay(400);
}
async function run() {
  try {
    const capacitor=(window as unknown as {Capacitor:{nativePromise:(plugin:string,method:string,options:object)=>Promise<unknown>}}).Capacitor;
    for(const method of ['request','get','post','put','patch','delete']) {
      let denied=false;
      try { await capacitor.nativePromise('CapacitorHttp',method,{url:'not-a-url'}); }
      catch(error) { denied=(error as {code?:string}).code==='OFFLINE_DEMO'; }
      if(!denied) throw new Error('Native HTTP bridge is not default-deny: '+method);
    }
    await until(()=>Boolean(document.querySelector('.composer textarea')));
    await capture('chat');
    const store=useStore.getState();
    store.newChat();
    // Let React commit the new chat before addressing its composer (the old node is replaced).
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    const input=document.querySelector<HTMLTextAreaElement>('.composer textarea')!;
    // Use the real React input path and submit handler.
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,'Synthetic native smoke');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    await until(()=>document.querySelector<HTMLButtonElement>('.send-btn')?.disabled===false);
    document.querySelector<HTMLButtonElement>('.send-btn')!.click();
    await until(()=>Boolean(document.querySelector('.message-row')?.textContent?.includes('Synthetic native smoke')));
    await until(()=>document.body.textContent!.includes('Offline demonstration.'));
    await capture('reply');
    openRoutingCenter();
    await until(()=>Boolean(document.querySelector('.rc-page')));
    showRoutingSection('providers');
    await capture('router');
    closeRoutingCenter();
    useStore.getState().setUi({page:'collection'});
    await until(()=>Boolean(document.querySelector('.library-workspace')));
    await capture('library');
    useStore.getState().setUi({page:null,settingsOpen:true});
    await until(()=>Boolean(document.querySelector('.settings-page')));
    await capture('settings');
    useStore.getState().setUi({settingsOpen:false});
    const ownerA=useStore.getState().user?.uid;
    await signOutUser();
    await until(()=>!useStore.getState().authed);
    selectDemo('b'); signInPreview();
    await until(()=>Boolean(useStore.getState().authed));
    if(useStore.getState().user?.uid===ownerA || useStore.getState().chats.some(c=>c.messages.some(m=>m.text.includes('Synthetic native smoke')))) throw new Error('Demo account isolation failed');
    await capture('profile-b');
    if(blocked.length) throw new Error('Unexpected blocked application request');
    report({done:true,passed:true,checks:['native HTTP bridge denied','bundled launch','Canvas navigation','local synthetic reply','profile separation'],limitations:['programmatic interaction, not hardware keyboard or VoiceOver']});
  } catch(error) { report({done:true,passed:false,error:String(error)}); }
}
void run();
