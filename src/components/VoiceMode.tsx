import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import { listen, speak, stopSpeaking } from '../lib/speech';
import { toPlainText } from '../lib/markdown';
import { useStore } from '../store';

type Phase = 'listening' | 'thinking' | 'speaking' | 'paused';
const LABEL: Record<Phase, string> = { listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking…', paused: 'Paused' };
const QUIET_TRIES = 3;

/** Hands-free conversation: listen → send → read the reply aloud → listen again, until ended. */
export default function VoiceMode({ onClose }: { onClose: () => void }) {
  const lang = useStore((s) => s.settings.voiceLang);
  const shield = useStore((s) => s.settings.privacyShield);
  const [phase, setPhase] = useState<Phase>('listening');
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const stopMic = useRef<() => void>(() => {});
  const quiet = useRef(0);
  const alive = useRef(true);

  const startListening = () => {
    if (!alive.current) return;
    stopSpeaking();
    setPhase('listening');
    setHeard('');
    let said = '';
    stopMic.current = listen(lang, (final, interim) => { said = final; setHeard(final + interim); }, (err) => {
      if (!alive.current) return;
      if (err) { setError(err); setPhase('paused'); return; }
      const text = said.trim();
      if (!text) {
        // Nothing heard: try again a few times, then wait for a tap.
        if (++quiet.current < QUIET_TRIES) startListening(); else setPhase('paused');
        return;
      }
      quiet.current = 0;
      void ask(text);
    }, { continuous: false });
  };

  const ask = async (text: string) => {
    setPhase('thinking');
    setReply('');
    const s = useStore.getState();
    if (!s.currentId) s.newChat();
    const chatId = useStore.getState().currentId;
    await useStore.getState().send(text, []);
    // send() resolves when the reply is complete.
    if (!alive.current) return;
    const chat = useStore.getState().chats.find((c) => c.id === chatId);
    const last = chat?.messages.filter((m) => m.role === 'assistant').at(-1);
    const spoken = last?.text ? toPlainText(last.text).trim() : '';
    if (!spoken) { setError(last?.error || 'No reply came back. Tap the microphone to try again.'); setPhase('paused'); return; }
    setReply(spoken);
    setPhase('speaking');
    speak(`voice-${last!.id}`, spoken, () => { if (alive.current) startListening(); });
  };

  useEffect(() => {
    alive.current = true;
    startListening();
    return () => { alive.current = false; stopMic.current(); stopSpeaking(); useStore.getState().stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);

  // Tap the orb: interrupt speaking, or start/stop listening.
  const tap = () => {
    setError('');
    if (phase === 'listening') { stopMic.current(); quiet.current = QUIET_TRIES; return; }
    if (phase === 'thinking') return;
    quiet.current = 0;
    startListening();
  };

  return (
    <div className="voice-mode" role="dialog" aria-modal="true" aria-label="Voice conversation">
      <button type="button" className="icon-btn voice-close" onClick={onClose} aria-label="End voice conversation"><X size={20} /></button>
      <div className="voice-stage">
        <button type="button" className={`voice-orb ${phase}`} onClick={tap} aria-label={phase === 'listening' ? 'Stop listening' : phase === 'speaking' ? 'Interrupt and talk' : 'Start talking'}>
          <span className="voice-ring" aria-hidden="true" />
          {phase === 'paused' ? <MicOff size={28} /> : <Mic size={28} />}
        </button>
        <p className="voice-status" role="status">{error || LABEL[phase]}</p>
        <p className="voice-text" dir="auto">{phase === 'speaking' || phase === 'thinking' ? (reply || heard) : heard || (phase === 'paused' ? 'Tap the microphone to talk.' : 'Say something…')}</p>
      </div>
      <p className="voice-foot">
        {phase === 'speaking' ? 'Tap to interrupt.' : 'Pauses after a moment of silence, then sends.'} Messages appear in this chat.{shield ? ' Personal details are masked before sending.' : ''}
      </p>
    </div>
  );
}
