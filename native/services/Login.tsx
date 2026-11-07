import {useState} from 'react';
import Logo from '../../src/components/Logo';
import {auth,signInWithGoogle} from '../../src/lib/firebase';
import {cancelNative} from './account';
import {signInProblem} from '../integration/auth-errors';
export default function Login(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function login(){setBusy(true);setError('');try{await signInWithGoogle();}catch(error){const problem=signInProblem(error);setError(`${problem.message} (${problem.code})`);}finally{setBusy(false);}}
 return <main className="login"><div className="login-card"><Logo size={56}/><h1>Lumen Test</h1>
  <p>Isolated test environment. Use an authorized test Google account only.</p>
  <button className="btn block" disabled={busy} onClick={()=>void login()}>Sign in with Google</button>
  {busy&&<button className="btn ghost" onClick={()=>void cancelNative(auth).catch(()=>setError('Close Google sign-in to cancel.'))}>Cancel sign-in</button>}
  {error&&<p role="alert">{error}</p>}
 </div></main>;
}
