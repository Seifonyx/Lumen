// Finds things that don't fit the screen: elements sticking out past the edges, and text spilling out of
// its box (anything inside a scroll or clip box that itself fits is fine: tables, code and diffs scroll).
async function scan(page) {
  return page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const out = [];
    const clips = (el) => ['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX);
    const name = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}`;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
      if (r.right <= 0 || r.left >= W) continue; // off-canvas (the closed sidebar)
      if (el.closest('svg, .katex, .cm-editor, .sheet-preview, .deck-preview')) continue;
      // Inside a scroll/clip box that itself fits, being wider is fine (tables, code, diffs scroll).
      let clipped = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (clips(a)) { const ar = a.getBoundingClientRect(); clipped = ar.right <= W + 1 && ar.left >= -1; break; }
      }
      if (!clipped && (r.right > W + 1 || r.left < -1)) out.push(`${name(el)} sticks out (${Math.round(r.left)}–${Math.round(r.right)} of ${W}) "${(el.textContent || '').trim().slice(0, 40)}"`);
      // Text spilling out of its own box without being clipped or scrollable.
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own && !clips(el) && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline' && !clipped) out.push(`${name(el)} text spills (${el.scrollWidth} > ${el.clientWidth}) "${(el.textContent || '').trim().slice(0, 40)}"`);
    }
    if (document.documentElement.scrollWidth > W + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${W})`);
    return [...new Set(out)].slice(0, 12);
  });
}

module.exports = { scan };
