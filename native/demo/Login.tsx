import {useState,useRef} from 'react';
import Logo from '../../src/components/Logo';
import {beginDemoLogin,cancelDemoLogin} from './account';
export default function Login() {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const attempt=useRef(0);
 const enter=async(id:string)=>{
  const ticket=++attempt.current;setBusy(true);setError('');
  try{await beginDemoLogin(id);}catch(e){if(ticket===attempt.current&&(e as Error).name!=='AbortError')setError((e as Error).message);}finally{if(ticket===attempt.current)setBusy(false);}
 };
 return <main className="login"><div className="login-card">
  <Logo size={56}/><h1>Lumen Demo</h1>
  <p>Explore Canvas with local demo profiles. Replies are generated from a fixed template on this device.</p>
  <button className="btn block" disabled={busy} onClick={()=>void enter('a')}>Open Demo A</button>
  <button className="btn block" disabled={busy} onClick={()=>void enter('b')}>Open Demo B</button>
  {busy&&<button className="btn ghost" onClick={()=>{attempt.current++;cancelDemoLogin();setBusy(false);}}>Cancel sign-in</button>}
  {error&&<p role="alert">{error}</p>}
  <p role="note">Google sign-in, cloud sync and real providers are unavailable in this experiment. Use sample text and files.</p>
 </div></main>;
}
