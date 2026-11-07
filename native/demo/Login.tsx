import Logo from '../../src/components/Logo';
import { useStore } from '../../src/store';
import { selectDemo } from './account';
export default function Login() {
  const enter = (id: string) => {
    selectDemo(id);
    void useStore.getState().loginPreview();
  };
  return <main className="login"><div className="login-card">
    <Logo size={56}/><h1>Lumen Demo</h1>
    <p>Explore Canvas with local demo profiles. Replies are generated from a fixed template on this device.</p>
    <button className="btn block" onClick={()=>enter('a')}>Open Demo A</button>
    <button className="btn block" onClick={()=>enter('b')}>Open Demo B</button>
    <p role="note">Google sign-in, cloud sync and real providers are unavailable in this experiment. Use sample text and files.</p>
  </div></main>;
}
