import { Download, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parseLooseJson } from '../lib/generate/spec';
import { saveBlob } from '../lib/util';

const PALETTE = ['#2F6FB3', '#E07A3F', '#3A9D6B', '#C2477F', '#8B6CC4', '#D4A72C', '#3FA7B5', '#7A8794'];

interface Spec {
  type?: string;
  title?: string;
  labels?: string[];
  series?: { name?: string; values?: (number | [number, number])[] }[];
  colors?: string[];
}

export default function ChartBlock({ content, complete }: { content: string; complete: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!complete) return;
    const spec = parseLooseJson<Spec>(content);
    if (!spec || !Array.isArray(spec.series)) {
      setError("This chart's data couldn't be read.");
      return;
    }
    setTitle(spec.title || '');
    let chart: { destroy(): void } | null = null;
    let cancelled = false;
    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      if (cancelled || !canvas.current) return;
      const styles = getComputedStyle(document.documentElement);
      const text = styles.getPropertyValue('--text-2').trim() || '#555';
      const grid = styles.getPropertyValue('--border').trim() || '#ddd';
      const colors = spec.colors?.length ? spec.colors : PALETTE;
      const raw = (spec.type || 'bar').toLowerCase();
      const type = raw === 'horizontalbar' ? 'bar' : raw === 'area' ? 'line' : raw === 'column' ? 'bar' : raw;
      const round = type === 'pie' || type === 'doughnut';
      chart = new Chart(canvas.current, {
        type: type as any,
        data: {
          labels: spec.labels || [],
          datasets: spec.series!.map((s, i) => ({
            label: s.name || `Series ${i + 1}`,
            data: (s.values || []) as any,
            backgroundColor: round ? (spec.labels || []).map((_, j) => colors[j % colors.length]) : raw === 'area' ? `${colors[i % colors.length]}33` : colors[i % colors.length],
            borderColor: round ? styles.getPropertyValue('--surface').trim() || '#fff' : colors[i % colors.length],
            borderWidth: round ? 2 : type === 'line' ? 2.5 : 0,
            borderRadius: type === 'bar' ? 4 : 0,
            fill: raw === 'area',
            tension: 0.3,
            pointRadius: type === 'line' ? 3 : undefined,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: raw === 'horizontalbar' ? 'y' : 'x',
          plugins: {
            legend: { display: round || spec.series!.length > 1, position: 'bottom', labels: { color: text, boxWidth: 12 } },
            title: { display: false },
          },
          scales: round
            ? {}
            : {
                x: { ticks: { color: text }, grid: { display: raw === 'scatter', color: grid } },
                y: { ticks: { color: text }, grid: { color: grid }, beginAtZero: true },
              },
        },
      });
    })().catch((e) => setError((e as Error).message));
    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [content, complete]);

  if (!complete) {
    return (
      <div className="chart-card loading">
        <Loader2 size={18} className="spin" /> Drawing chart…
      </div>
    );
  }
  if (error) return <pre className="chart-error">{error}</pre>;
  return (
    <figure className="chart-card">
      <figcaption>
        <span dir="auto">{title}</span>
        <button
          className="icon-btn sm"
          aria-label="Save chart as image"
          title="Save as image"
          onClick={() => canvas.current?.toBlob((b) => b && saveBlob(b, `${title || 'chart'}.png`), 'image/png')}
        >
          <Download size={16} />
        </button>
      </figcaption>
      <div className="chart-box">
        <canvas ref={canvas} role="img" aria-label={title || 'Chart'} />
      </div>
    </figure>
  );
}
