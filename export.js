'use strict';
// Turns an AI reply (Markdown) into a Word (.docx) or Excel (.xlsx) file in the browser.
// Loaded on demand; needs window.marked and window.JSZip.

(() => {
  const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
  const LTR_CHAR = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;

  function esc(s) {
    return String(s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function decodeEntities(s) {
    const t = document.createElement('textarea');
    t.innerHTML = s;
    return t.value;
  }

  // Direction of the first "strong" character decides the paragraph direction.
  function isRtl(text) {
    for (const ch of text) {
      if (RTL_CHAR.test(ch)) return true;
      if (LTR_CHAR.test(ch)) return false;
    }
    return false;
  }

  // Plain text of inline tokens (used for table cells, headings for sheet names, etc.).
  function plain(tokens) {
    return (tokens || [])
      .map((t) => (t.tokens ? plain(t.tokens) : t.type === 'br' ? '\n' : decodeEntities(t.text ?? t.raw ?? '')))
      .join('');
  }

  // ---------------------------------------------------------------- Word (.docx)

  function runXml(text, fmt) {
    if (!text) return '';
    const props = [];
    if (fmt.code) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>');
    if (fmt.bold) props.push('<w:b/><w:bCs/>');
    if (fmt.italic) props.push('<w:i/><w:iCs/>');
    if (fmt.strike) props.push('<w:strike/>');
    if (fmt.link) props.push('<w:color w:val="2F6F5E"/><w:u w:val="single"/>');
    if (fmt.code) props.push('<w:shd w:val="clear" w:color="auto" w:fill="EFEFEC"/>');
    if (RTL_CHAR.test(text)) props.push('<w:rtl/>');
    const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
    return text
      .split('\n')
      .map((line, i) => `<w:r>${rPr}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(line)}</w:t></w:r>`)
      .join('');
  }

  function inlineXml(tokens, fmt = {}) {
    let out = '';
    for (const t of tokens || []) {
      switch (t.type) {
        case 'strong': out += inlineXml(t.tokens, { ...fmt, bold: true }); break;
        case 'em': out += inlineXml(t.tokens, { ...fmt, italic: true }); break;
        case 'del': out += inlineXml(t.tokens, { ...fmt, strike: true }); break;
        case 'codespan': out += runXml(decodeEntities(t.text), { ...fmt, code: true }); break;
        case 'link': out += inlineXml(t.tokens, { ...fmt, link: true }); break;
        case 'br': out += '<w:r><w:br/></w:r>'; break;
        case 'image': out += runXml(`[image: ${t.text || t.href}]`, fmt); break;
        default:
          out += t.tokens ? inlineXml(t.tokens, fmt) : runXml(decodeEntities(t.text ?? t.raw ?? ''), fmt);
      }
    }
    return out;
  }

  function paragraph(runs, { style, numId, ilvl, indent, rtl, border, keepNext } = {}) {
    const pPr = [];
    if (style) pPr.push(`<w:pStyle w:val="${style}"/>`);
    if (keepNext) pPr.push('<w:keepNext/>');
    if (numId) pPr.push(`<w:numPr><w:ilvl w:val="${ilvl || 0}"/><w:numId w:val="${numId}"/></w:numPr>`);
    if (border) pPr.push('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="BBBBBB"/></w:pBdr>');
    if (rtl) pPr.push('<w:bidi/>');
    if (indent) pPr.push(`<w:ind w:left="${indent}"/>`);
    return `<w:p>${pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''}${runs}</w:p>`;
  }

  function tableXml(t) {
    const rtl = isRtl(plain(t.header.flatMap((c) => c.tokens)));
    const cell = (c, i, header) => {
      const jc = { left: 'start', right: 'end', center: 'center' }[t.align[i]];
      const runs = inlineXml(c.tokens, header ? { bold: true } : {});
      const pPr = `${isRtl(plain(c.tokens)) ? '<w:bidi/>' : ''}<w:spacing w:after="0"/>${jc ? `<w:jc w:val="${jc}"/>` : ''}`;
      const shade = header ? '<w:shd w:val="clear" w:color="auto" w:fill="E6EFE9"/>' : '';
      return `<w:tc><w:tcPr>${shade}</w:tcPr><w:p><w:pPr>${pPr}</w:pPr>${runs}</w:p></w:tc>`;
    };
    const rows = [
      `<w:tr><w:trPr><w:tblHeader/></w:trPr>${t.header.map((c, i) => cell(c, i, true)).join('')}</w:tr>`,
      ...t.rows.map((r) => `<w:tr>${r.map((c, i) => cell(c, i, false)).join('')}</w:tr>`),
    ];
    const grid = t.header.map(() => `<w:gridCol w:w="${Math.floor(9638 / t.header.length)}"/>`).join('');
    return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/>${rtl ? '<w:bidiVisual/>' : ''}<w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows.join('')}</w:tbl><w:p/>`;
  }

  function toDocxParts(markdown) {
    const nums = [{ id: 1, abstract: 0 }]; // numId 1 = bullets; ordered lists each get their own so they restart at 1
    const body = [];

    function blocks(tokens, ctx = {}) {
      for (const t of tokens) {
        switch (t.type) {
          case 'heading': {
            const text = plain(t.tokens);
            body.push(paragraph(inlineXml(t.tokens), { style: `Heading${Math.min(t.depth, 3)}`, rtl: isRtl(text), keepNext: true }));
            break;
          }
          case 'paragraph':
          case 'text':
            body.push(paragraph(inlineXml(t.tokens || [{ type: 'text', text: t.text }], ctx.fmt), { rtl: isRtl(plain(t.tokens) || t.text), indent: ctx.indent, style: ctx.style }));
            break;
          case 'list':
            list(t, ctx.depth || 0);
            break;
          case 'table':
            body.push(tableXml(t));
            break;
          case 'code':
            for (const line of t.text.split('\n')) body.push(paragraph(runXml(line || ' ', { code: true }), { style: 'Code' }));
            break;
          case 'blockquote':
            blocks(t.tokens, { ...ctx, style: 'Quote' });
            break;
          case 'hr':
            body.push(paragraph('', { border: true }));
            break;
          case 'space':
            break;
          default:
            if (t.text) body.push(paragraph(runXml(decodeEntities(t.text), {}), { rtl: isRtl(t.text) }));
        }
      }
    }

    function list(t, depth) {
      let numId = 1;
      if (t.ordered) {
        numId = nums.length + 1;
        nums.push({ id: numId, abstract: 1, start: Number(t.start) || 1, depth });
      }
      for (const item of t.items) {
        let first = true;
        for (const sub of item.tokens) {
          if (sub.type === 'list') {
            list(sub, Math.min(depth + 1, 8));
          } else if ((sub.type === 'text' || sub.type === 'paragraph') && first) {
            const prefix = item.task ? (item.checked ? '☑ ' : '☐ ') : '';
            const text = plain(sub.tokens) || sub.text;
            body.push(paragraph(runXml(prefix, {}) + inlineXml(sub.tokens || [{ type: 'text', text: sub.text }]), { numId, ilvl: depth, rtl: isRtl(text) }));
            first = false;
          } else {
            blocks([sub], { indent: 720 * (depth + 1), depth: depth + 1 });
          }
        }
      }
    }

    blocks(window.marked.lexer(markdown));
    if (body.length === 0) body.push('<w:p/>');

    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;

    const lvl = (i, ordered) => {
      const bullets = ['•', '◦', '▪'];
      const fmt = ordered ? `<w:numFmt w:val="decimal"/><w:lvlText w:val="%${i + 1}."/>` : `<w:numFmt w:val="bullet"/><w:lvlText w:val="${bullets[i % 3]}"/>`;
      return `<w:lvl w:ilvl="${i}"><w:start w:val="1"/>${fmt}<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
    };
    const levels = (ordered) => Array.from({ length: 9 }, (_, i) => lvl(i, ordered)).join('');
    const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering ${W}>
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${levels(false)}</w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${levels(true)}</w:abstractNum>
${nums
  .map((n) => `<w:num w:numId="${n.id}"><w:abstractNumId w:val="${n.abstract}"/>${n.abstract === 1 ? `<w:lvlOverride w:ilvl="${n.depth}"><w:startOverride w:val="${n.start}"/></w:lvlOverride>` : ''}</w:num>`)
  .join('')}
</w:numbering>`;

    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}>
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="1F4D40"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="2F6F5E"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="EFEFEC"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="BBBBBB"/></w:pBdr><w:ind w:left="567"/></w:pPr><w:rPr><w:i/><w:iCs/><w:color w:val="555555"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="BBBBBB"/><w:left w:val="single" w:sz="4" w:color="BBBBBB"/><w:bottom w:val="single" w:sz="4" w:color="BBBBBB"/><w:right w:val="single" w:sz="4" w:color="BBBBBB"/><w:insideH w:val="single" w:sz="4" w:color="BBBBBB"/><w:insideV w:val="single" w:sz="4" w:color="BBBBBB"/></w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`;

    return {
      '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`,
      'word/document.xml': document,
      'word/styles.xml': styles,
      'word/numbering.xml': numbering,
    };
  }

  // ---------------------------------------------------------------- Excel (.xlsx)

  function tablesIn(markdown) {
    const found = [];
    let lastHeading = '';
    const walk = (tokens) => {
      for (const t of tokens) {
        if (t.type === 'heading') lastHeading = plain(t.tokens);
        if (t.type === 'table') found.push({ table: t, title: lastHeading });
        if (t.type === 'list') t.items.forEach((i) => walk(i.tokens));
        else if (t.tokens && t.type !== 'table') walk(t.tokens);
      }
    };
    walk(window.marked.lexer(markdown));
    return found;
  }

  function colName(i) {
    let s = '';
    for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  }

  // "1,234.5" → 1234.5; leaves things like phone numbers with leading zeros and percentages as text.
  function asNumber(text) {
    const s = text.trim();
    if (!/^-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/.test(s)) return null;
    if (/^-?0\d/.test(s)) return null;
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function sheetXml(t) {
    const header = t.header.map((c) => plain(c.tokens));
    const rows = t.rows.map((r) => r.map((c) => plain(c.tokens)));
    const all = [header, ...rows];
    const widths = header.map((_, i) => Math.min(60, Math.max(8, ...all.map((r) => (r[i] || '').length + 2))));
    const rtl = isRtl(header.join(' '));
    const cell = (text, r, c, bold) => {
      const ref = `${colName(c)}${r + 1}`;
      const n = bold ? null : asNumber(text);
      if (n !== null) return `<c r="${ref}"><v>${n}</v></c>`;
      if (!text) return '';
      return `<c r="${ref}" t="inlineStr"${bold ? ' s="1"' : ' s="2"'}><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
    };
    const data = all.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => cell(v, ri, ci, ri === 0)).join('')}</row>`).join('');
    const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    const last = `${colName(header.length - 1)}${all.length}`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"${rtl ? ' rightToLeft="1"' : ''}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${data}</sheetData></worksheet>`;
  }

  function toXlsxParts(markdown) {
    const tables = tablesIn(markdown);
    if (tables.length === 0) return null;
    const used = new Set();
    const names = tables.map(({ title }, i) => {
      let base = (title || `Table ${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28) || `Table ${i + 1}`;
      let name = base;
      for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 25)} (${n})`;
      used.add(name.toLowerCase());
      return name;
    });
    const parts = {
      '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${tables
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}</Types>`,
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${tables.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6EFE9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    };
    tables.forEach(({ table }, i) => (parts[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(table)));
    return parts;
  }

  async function zip(parts, mime) {
    const z = new window.JSZip();
    for (const [path, content] of Object.entries(parts)) z.file(path, content);
    return z.generateAsync({ type: 'blob', mimeType: mime, compression: 'DEFLATE' });
  }

  window.Exporter = {
    hasTables: (markdown) => tablesIn(markdown).length > 0,
    docx: (markdown) => zip(toDocxParts(markdown), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    xlsx: (markdown) => {
      const parts = toXlsxParts(markdown);
      return parts ? zip(parts, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') : null;
    },
  };
})();
