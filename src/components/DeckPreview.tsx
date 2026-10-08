import { useEffect, useMemo, useRef } from 'react';
import { parseDeck, type Bullet, type ChartSpec, type Slide } from '../lib/generate/deck-spec';
import type { DeckTheme } from '../lib/generate/spec';
import { isRtl } from '../lib/util';

const c = (hex: string) => `#${hex}`;

function SlideChart({ chart, theme }: { chart: ChartSpec; theme: DeckTheme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let inst: { destroy(): void } | null = null;
    let cancelled = false;
    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);
      if (cancelled || !ref.current) return;
      const round = chart.type === 'pie' || chart.type === 'doughnut';
      const type = round ? chart.type : chart.type === 'line' || chart.type === 'area' ? 'line' : 'bar';
      const palette = theme.palette.map(c);
      inst = new Chart(ref.current, {
        type: type as any,
        data: {
          labels: chart.labels,
          datasets: chart.series.map((s, i) => ({
            label: s.name,
            data: s.values,
            backgroundColor: round ? chart.labels.map((_, j) => palette[j % palette.length]) : chart.type === 'area' ? `${palette[i % palette.length]}55` : palette[i % palette.length],
            borderColor: round ? c(theme.background) : palette[i % palette.length],
            fill: chart.type === 'area',
            tension: 0.3,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          indexAxis: chart.type === 'horizontalBar' ? 'y' : 'x',
          plugins: { legend: { display: round || chart.series.length > 1, position: 'bottom', labels: { color: c(theme.text) } } },
          scales: round ? {} : { x: { ticks: { color: c(theme.muted) }, grid: { display: false } }, y: { ticks: { color: c(theme.muted) }, grid: { color: theme.dark ? '#334155' : '#E5E7EB' }, beginAtZero: true } },
        },
      });
    })();
    return () => {
      cancelled = true;
      inst?.destroy();
    };
  }, [chart, theme]);
  return <canvas ref={ref} />;
}

function Bullets({ list, theme }: { list: Bullet[]; theme: DeckTheme }) {
  return (
    <ul className="s-bullets">
      {list.map((b, i) => (
        <li key={i} dir="auto" style={{ color: c(theme.text) }}>
          {b.text}
          {b.sub.length > 0 && (
            <ul>
              {b.sub.map((s, j) => (
                <li key={j} dir="auto" style={{ color: c(theme.muted) }}>{s}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function SlideView({ slide, n, deckTitle, theme }: { slide: Slide; n: number; deckTitle: string; theme: DeckTheme }) {
  const rtl = isRtl(JSON.stringify(slide).replace(/"[a-zA-Z-]+":/g, ''));
  const vars = {
    '--p': c(theme.primary),
    '--a': c(theme.accent),
    '--bg': c(theme.background),
    '--sf': c(theme.surface),
    '--tx': c(theme.text),
    '--mt': c(theme.muted),
  } as React.CSSProperties;
  const footer = (
    <div className="s-footer" style={{ color: c(theme.muted) }}>
      <span dir="auto">{deckTitle}</span>
      <span>{n}</span>
    </div>
  );
  const header = (title: string) => (
    <>
      <div className="s-topbar" />
      <h3 className="s-title" dir="auto" style={{ color: theme.dark ? c(theme.text) : c(theme.primary) }}>{title}</h3>
      <div className="s-accent" />
    </>
  );

  let inner: React.ReactNode;
  switch (slide.layout) {
    case 'title':
    case 'closing':
      inner = (
        <div className="s-cover">
          <div className="s-circle one" />
          <div className="s-circle two" />
          <div className="s-cover-rule" />
          <h2 dir="auto">{slide.title}</h2>
          {slide.subtitle && <p dir="auto">{slide.subtitle}</p>}
        </div>
      );
      break;
    case 'section':
      inner = (
        <div className="s-section">
          <div className="s-side" />
          <div className="s-num">{String(n).padStart(2, '0')}</div>
          <h2 dir="auto">{slide.title}</h2>
          {slide.subtitle && <p dir="auto">{slide.subtitle}</p>}
          {footer}
        </div>
      );
      break;
    case 'bullets':
      inner = (<>{header(slide.title)}<div className="s-body"><Bullets list={slide.bullets} theme={theme} /></div>{footer}</>);
      break;
    case 'two-column':
      inner = (
        <>
          {header(slide.title)}
          <div className="s-body s-cols">
            {[[slide.leftTitle, slide.left, 'var(--p)'], [slide.rightTitle, slide.right, 'var(--a)']].map(([t, list, color], i) => (
              <div key={i} className="s-col">
                {t && <h4 dir="auto" style={{ color: color as string }}>{t as string}</h4>}
                <Bullets list={list as Bullet[]} theme={theme} />
              </div>
            ))}
          </div>
          {footer}
        </>
      );
      break;
    case 'table':
      inner = (
        <>
          {header(slide.title)}
          <div className="s-body">
            <table className="s-table">
              <thead><tr>{slide.header.map((h, i) => <th key={i} dir="auto">{h}</th>)}</tr></thead>
              <tbody>{slide.rows.map((r, ri) => <tr key={ri}>{r.map((v, i) => <td key={i} dir="auto">{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
          {footer}
        </>
      );
      break;
    case 'chart':
      inner = (
        <>
          {header(slide.title)}
          <div className="s-body s-chart"><SlideChart chart={slide.chart} theme={theme} /></div>
          {slide.caption && <p className="s-caption" dir="auto">{slide.caption}</p>}
          {footer}
        </>
      );
      break;
    case 'stats':
      inner = (
        <>
          {header(slide.title)}
          <div className="s-body s-stats" style={{ gridTemplateColumns: `repeat(${slide.stats.length <= 4 ? Math.max(1, slide.stats.length) : 3}, 1fr)` }}>
            {slide.stats.map((s, i) => (
              <div key={i} className="s-stat" style={{ borderColor: i % 2 ? 'var(--a)' : 'var(--p)' }}>
                <div className="s-stat-v" style={{ color: i % 2 ? 'var(--a)' : 'var(--p)' }} dir="auto">{s.value}</div>
                <div className="s-stat-l" dir="auto">{s.label}</div>
              </div>
            ))}
          </div>
          {footer}
        </>
      );
      break;
    case 'timeline':
      inner = (
        <>
          {header(slide.title)}
          <div className="s-body s-timeline">
            <div className="s-line" />
            {slide.steps.map((st, i) => (
              <div key={i} className="s-step">
                <div className="s-dot" style={{ background: i % 2 ? 'var(--a)' : 'var(--p)' }}>{i + 1}</div>
                <div className="s-step-t" dir="auto">{st.title}</div>
                {st.text && <div className="s-step-x" dir="auto">{st.text}</div>}
              </div>
            ))}
          </div>
          {footer}
        </>
      );
      break;
    case 'quote':
      inner = (
        <div className="s-quote">
          <div className="s-qmark">“</div>
          <blockquote dir="auto">{slide.quote}</blockquote>
          {slide.author && <cite dir="auto">— {slide.author}</cite>}
          {footer}
        </div>
      );
      break;
  }

  const coverLike = slide.layout === 'title' || slide.layout === 'closing';
  const bg = coverLike ? c(theme.primary) : slide.layout === 'section' || slide.layout === 'quote' ? c(theme.surface) : c(theme.background);
  return (
    <div className="slide-wrap">
      <div className={`slide layout-${slide.layout}`} dir={rtl ? 'rtl' : 'ltr'} style={{ ...vars, background: bg }}>
        {inner}
      </div>
      {slide.notes && <p className="slide-notes" dir="auto"><strong>Notes:</strong> {slide.notes}</p>}
    </div>
  );
}

export default function DeckPreview({ content }: { content: string }) {
  const deck = useMemo(() => parseDeck(content), [content]);
  if (!deck) return <p className="pad muted">This presentation's data couldn't be read.</p>;
  return (
    <div className="deck-preview">
      {deck.slides.map((s, i) => (
        <SlideView key={i} slide={s} n={i + 1} deckTitle={deck.title} theme={deck.theme} />
      ))}
    </div>
  );
}
