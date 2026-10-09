import { BookOpen, Brain, Code2, FileText, FlaskConical, Languages, Layers, PenLine, Sun, Zap } from 'lucide-react';
import type { LayoutIcon as Icon } from '../lib/layouts';

const ICONS = { code: Code2, sun: Sun, brain: Brain, zap: Zap, file: FileText, languages: Languages, layers: Layers, flask: FlaskConical, pen: PenLine, graduation: BookOpen };

export default function LayoutIcon({ icon, size = 16, className }: { icon: Icon; size?: number; className?: string }) {
  const C = ICONS[icon] || Layers;
  return <C size={size} className={className} />;
}
