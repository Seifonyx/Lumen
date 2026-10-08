// Voice input (speech-to-text) and read-aloud, using the browser's built-in speech features.

import { isRtl } from './util';

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: any) => void) | null;
};

const Ctor: (new () => Recognition) | undefined = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const canListen = Boolean(Ctor);
export const canSpeak = 'speechSynthesis' in window;

export const VOICE_LANGS: [string, string][] = [
  ['', 'Same as device'],
  ['en-US', 'English (US)'],
  ['en-GB', 'English (UK)'],
  ['ar-EG', 'Arabic (Egypt)'],
  ['ar-SA', 'Arabic (Saudi Arabia)'],
  ['fr-FR', 'French'],
  ['de-DE', 'German'],
  ['es-ES', 'Spanish'],
  ['tr-TR', 'Turkish'],
];

/** Starts listening; calls onText with (final text so far, interim text). Returns a stop function. */
export function listen(lang: string, onText: (finalText: string, interim: string) => void, onEnd: (error?: string) => void): () => void {
  if (!Ctor) {
    onEnd('Voice input is not supported in this browser.');
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = lang || navigator.language || 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  let finalText = '';
  rec.onresult = (e: any) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    onText(finalText, interim);
  };
  let error: string | undefined;
  rec.onerror = (e: any) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') error = 'Microphone access was blocked. Allow it in your browser settings.';
    else if (e.error !== 'no-speech' && e.error !== 'aborted') error = `Voice input stopped (${e.error}).`;
  };
  rec.onend = () => onEnd(error);
  rec.start();
  return () => rec.stop();
}

let speakingId: string | null = null;

export function speak(id: string, text: string, onDone: () => void) {
  stopSpeaking();
  const u = new SpeechSynthesisUtterance(text);
  const rtl = isRtl(text);
  const voices = speechSynthesis.getVoices();
  const voice = rtl ? voices.find((v) => v.lang.startsWith('ar')) : voices.find((v) => v.lang === navigator.language) || voices.find((v) => v.lang.startsWith('en'));
  if (voice) u.voice = voice;
  if (rtl) u.lang = voice?.lang || 'ar';
  u.onend = u.onerror = () => {
    if (speakingId === id) speakingId = null;
    onDone();
  };
  speakingId = id;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  speakingId = null;
  if (canSpeak) speechSynthesis.cancel();
}
