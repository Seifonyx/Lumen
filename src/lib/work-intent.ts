/** Local interpretation of requested work. Topics alone never grant a tool capability. */
export type WorkTask = 'coding' | 'everyday' | 'thinking' | 'fast' | 'documents' | 'writing' | 'research' | 'study' | 'images' | 'languages';
export type WorkCapability = 'vision' | 'search' | 'pdf';
export interface WorkIntent {
  tasks: WorkTask[];
  excluded: WorkTask[];
  required: WorkCapability[];
  minContext?: number;
  minInputTokens?: number;
  noReasoning: boolean;
  speed: boolean;
  quality: boolean;
  cost: boolean;
}

const CODE = /```|\b(?:function|class|def|const|import|return|stack ?trace|exception|traceback|bugs?|debug(?:ging)?|compil\w*|syntax|regex|sql|python|javascript|typescript|react|vue|svelte|next\.?js|frontend|backend|java|html|css|api|json|cod(?:e|ing)|scripts?|program(?:ming)?|software|apps?|websites?|endpoints?|components?)\b|\bc\+\+\b|كود|برمج/i;
const THINK = /\b(?:maths?|prove|proof|solve|calculat\w*|comput\w*|equation|integral|derivative|probability|statistics|optimi[sz]\w*|step[- ]by[- ]step|explain why|why does|logic|puzzle|analy[sz]\w*|trade[- ]?offs?|architectures?|failure modes?|migration|evaluat\w*|reasoning|security|strategy|physics|hard problems?)\b|[=^√∑∫]\s*\d|\d\s*[+\-*/^]\s*\d|احسب|معادلة|برهن|حل المسألة/i;
const WRITE = /\b(?:writ\w*|rewrit\w*|draft|compose|essays?|emails?|e-mails?|letters?|articles?|blogs?|stor(?:y|ies)|poems?|summar\w*|paraphrase|proofread|translat\w*|tone|formal|polish)\b|اكتب|أعد صياغة|لخص|ترجم|رسالة|مقال/i;
const PROSE = /\b(?:email|e-mail|letter|cover letter|essay|article|blog|story|poem|memo|announcement|message|speech)\b/i;
const CODE_ACTION = /\b(?:fix|debug|refactor|implement|program|compile|deploy|test|optimi[sz]e|build|create|develop)\b/i;
const CODE_OUTPUT = /\b(?:write|rewrite|generate)\s+(?:(?!(?:about|for|with|on|regarding|concerning|to|and)\b)[\w+-]+\s+){0,5}(?:code|functions?|classes?|scripts?|queries|components?|programs?|apps?|websites?|endpoints?|tests?|modules?|services?|validators?)\b/i;
const IMAGE = /\b(?:images?|photos?|photographs?|pictures?|screenshots?|charts?|diagrams?|scans?|ocr|vision)\b/i;
const DOCUMENT = /\b(?:documents?|pdfs?|docx?|word|excel|xlsx?|csv|powerpoint|pptx?|spreadsheets?|workbooks?|files?|reports?|slides?|presentations?|decks?)\b|ملف|عرض تقديمي|تقرير|جدول|إكسل|اكسل|وورد|باوربوينت/i;
const ABSTRACT = /\b(?:explain|teach|learn|study)\s+(?:(?:to me|about)\s+)?(?:how|what|why)\b|\b(?:how (?:do|does|to)|what (?:is|are))\b/i;
const NEGATED_TERM = '(?:reason(?:ing)?|thinking|search(?:ing)?|research|brows(?:e|ing)|internet|cod(?:e|ing)|images?|photos?|vision|pdfs?)';
const NEGATION = new RegExp(`\\b(?:without|no need (?:to|for)|do not|don't|never|avoid|skip|excluding|not|no)\\s+(?:(?:use|using|require|requiring|include|including|do|any|a|the|lengthy|long|slow|live|web|online|external|deep)\\s+)*(${NEGATED_TERM})\\b((?:\\s*(?:,?\\s*(?:or|and|nor))\\s+(?:(?:web|online|lengthy|deep)\\s+)*${NEGATED_TERM}\\b)*)`, 'gi');

function proseDeliverable(text: string) {
  return [...text.matchAll(/\b(?:write|rewrite|draft|compose|polish|proofread|summari[sz]e|translate)\b\s+([^.!;\n]+)/gi)]
    .some(hit => PROSE.test(hit[1].split(/\b(?:about|regarding|concerning|with|for|using|to|that|which)\b/i)[0]));
}

function positiveWork(text: string) {
  const excluded = new Set<WorkTask>();
  const remove = (_match: string, word: string) => {
    excluded.add(/reason|think/i.test(word) ? 'thinking' : /search|research|brows|internet/i.test(word) ? 'research' : /cod/i.test(word) ? 'coding' : /pdf/i.test(word) ? 'documents' : 'images');
    return ' ';
  };
  const positive = text.replace(NEGATION, (match, word: string, coordinated: string) => {
    remove(match, word);
    for (const term of coordinated.matchAll(new RegExp(NEGATED_TERM, 'gi'))) remove(term[0], term[0]);
    return ' ';
  });
  if (/\boffline\b|\b(?:local|provided|supplied|attached) (?:sources|references|papers|documents) only\b/i.test(text)) excluded.add('research');
  return {positive, excluded};
}

/** Separate an advertised context window from the amount of input it must actually fit. */
function contextNeeds(text: string): {minContext?: number; minInputTokens?: number} {
  const number = '(?:\\d{1,3}(?:[, _]\\d{3})+|\\d+(?:\\.\\d+)?)';
  const value = new RegExp(`(?<![\\d,.])(${number})\\s*(thousand|million|billion|[kmb])?\\s*(?:[- ]?tokens?\\b(?:\\s+of)?\\s*(context(?:\\s+window)?\\b)?|context(?:\\s+window)?\\b)`, 'gi');
  let minContext: number | undefined, minInputTokens: number | undefined;
  for (const hit of text.matchAll(value)) {
    const before = text.slice(Math.max(0, hit.index! - 100), hit.index);
    const after = text.slice(hit.index! + hit[0].length, hit.index! + hit[0].length + 50);
    if (/\b(?:up to|at most|no more than|less than|under|maximum|max)\s*$/i.test(before)) continue;
    if (/\b(?:output|reply|response|completion|answer)(?:\s+(?:token|tokens|limit|length|of|to|at|maximum|max|is))*\s*[:=]?\s*$/i.test(before) || /^\s*(?:of\s+)?(?:output|reply|response|completion|answer)\b/i.test(after)) continue;
    const unit = hit[2]?.toLowerCase(), scale = unit === 'm' || unit === 'million' ? 1e6 : unit === 'b' || unit === 'billion' ? 1e9 : unit ? 1e3 : 1;
    const amount = Math.ceil(Number(hit[1].replace(/[, _]/g, '')) * scale);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const window = /\bcontext\b/i.test(hit[0]) || /\bcontext(?:\s+window)?(?:\s+(?:of|at least|minimum|is|with))*\s*[:=]?\s*$/i.test(before);
    if (window) minContext = Math.max(minContext || 0, amount);
    else if (/\b(?:read|reading|review|analy[sz]e|process|summari[sz]e|input|prompt|document|report|support|need|handle|at least)\w*\b/i.test(before)) minInputTokens = Math.max(minInputTokens || 0, amount);
  }
  return {minContext, minInputTokens};
}

export function interpretWork(raw: string): WorkIntent {
  const text = raw.normalize('NFKC').replace(/[’‘]/g, "'");
  const {positive, excluded} = positiveWork(text);
  const tasks = new Set<WorkTask>(), required = new Set<WorkCapability>();
  const head = positive.split(/\b(?:about|regarding|concerning)\b/i)[0];
  const prose = proseDeliverable(positive);
  const explicitCode = CODE_OUTPUT.test(head) || (CODE_ACTION.test(head) && CODE.test(head)) || /\b(?:and|then)\s+(?:fix|debug|refactor|implement|build|develop)\b/i.test(positive);
  const code = !excluded.has('coding') && CODE.test(positive) && (!prose || explicitCode);
  if (code) tasks.add('coding');
  if (!excluded.has('thinking') && THINK.test(positive) && (!prose || explicitCode || /\b(?:analy[sz]e|evaluate|prove|solve)\b/i.test(head))) tasks.add('thinking');
  if (WRITE.test(positive) && (!code || prose || /\b(?:and|then)\s+(?:write|draft|compose)\b/i.test(positive))) tasks.add('writing');
  if (DOCUMENT.test(positive)) tasks.add('documents');
  if (/\b(?:study|learn|exam|homework|teach|explain|school|university|course)\b/i.test(positive)) tasks.add('study');
  if (/\b(?:translat\w*|languages?|arabic|french|spanish|german|chinese|hindi|turkish|japanese|portuguese|dialects?)\b|ترجم/i.test(positive)) tasks.add('languages');

  // Scope tool requirements to the clause requesting them. Implementing a reader
  // or explaining a feature is different from supplying inputs to that reader.
  for (const clause of positive.split(/[.!;\n]+|\b(?:and|then|also)\b/i)) {
    const actualImage = /\b(?:these|this|attached|provided|supplied|uploaded)\s+(?:images?|photos?|pictures?|screenshots?|charts?|diagrams?|scans?)\b/i.test(clause);
    const actualPdf = /\b(?:these|this|attached|provided|supplied|uploaded)\s+pdfs?\b/i.test(clause);
    const createsSoftware = CODE_OUTPUT.test(clause) || CODE_ACTION.test(clause) && CODE.test(clause);
    const createsVisual = /\b(?:draw|generate|create|build|make|design|write|render)\b[^;\n]{0,100}\b(?:images?|pictures?|diagrams?|charts?|photos?)\b/i.test(clause);
    const abstract = ABSTRACT.test(clause) || /^\s*(?:explain|teach|learn|study)\b/i.test(clause);
    const clauseProse = proseDeliverable(clause);
    if (!excluded.has('images') && IMAGE.test(clause) && (actualImage || !clauseProse && !createsSoftware && !createsVisual && !abstract)) {
      tasks.add('images'); required.add('vision');
    }
    const supplied = /\b(?:provided|supplied|attached|these|my|local)\s+(?:papers?|documents?|sources?|files?|references?)\b/i.test(clause);
    const live = /\b(?:web|online|internet|brows\w*|real[- ]time|up[- ]to[- ]date|current|latest|news)\b/i.test(clause);
    const lookup = /\b(?:research|browse|browsing|look up|fact[- ]check)\b|\b(?:web|online|internet)\s+search\b|\bsearch(?:ing)?\s+(?:the\s+)?(?:web|internet|online)\b|\b(?:find|verify|search)\b[^;\n]{0,80}\b(?:current|latest|online|sources?|references?|news)\b|^(?:search|research)$/i.test(clause.trim());
    if (!excluded.has('research') && !abstract && !createsSoftware && !clauseProse && lookup && (!supplied || live)) {
      tasks.add('research'); required.add('search');
    }
    // Native PDF ingestion is requested only when the PDF itself is the input.
    if (!excluded.has('documents') && !clauseProse && !abstract && (actualPdf || !createsSoftware) && /\b(?:read|reading|scan|analy[sz]e|review|summari[sz]e)\b[^;\n]{0,80}\bpdfs?\b/i.test(clause)) required.add('pdf');
  }
  const speed = /\b(?:fast(?:est)?|quick|instant|speed|low latency)\b/i.test(positive);
  const quality = /\b(?:best|highest|maximum|max)\s+(?:quality|accuracy|correctness)|\b(?:quality|accuracy)\s+(?:over|before)\s+speed\b/i.test(positive);
  const cost = /\b(?:use|pick|choose|prefer|route to)\s+(?:the\s+)?(?:cheapest|least expensive|lowest[- ]cost)\s+(?:available\s+)?models?\b|^\s*(?:minimi[sz]e|reduce|save on)\s+(?:inference|api|token|routing)\s+(?:costs?|spend)\b/i.test(positive);
  if (speed) tasks.add('fast');
  if (!tasks.size) tasks.add('everyday');
  return {tasks:[...tasks],excluded:[...excluded],required:[...required],...contextNeeds(positive),noReasoning:excluded.has('thinking'),speed,quality,cost};
}

/** Only anaphoric follow-ups inherit intent; an explicit new deliverable owns its own route. */
export function contextualWork(text: string, recent = ''): string {
  const clean = text.trim();
  const affirmation = /^(?:yes|ok(?:ay)?|sure|approved)[.!\s]*$/i.test(clean);
  const reference = /^(?:(?:yes|ok(?:ay)?|sure)[,!\s]+)?(?:go ahead|do (?:it|that|these|\d)|continue|proceed|carry on|try again|make (?:it|that|this)|improve (?:it|that|this)|what about (?:it|that|this)|and (?:then|now)|fix (?:it|that|this))\b/i.test(clean);
  const newDeliverable = proseDeliverable(clean) || CODE_OUTPUT.test(clean);
  return recent && clean.length < 240 && (affirmation || reference && !newDeliverable) ? `${recent.slice(-6000)}\n${text}` : text;
}

/** Resolve the latest substantive turn instead of mixing every old topic into a follow-up. */
export function previousWork(turns: string[], summary = ''): string {
  return turns.slice(-4).reduce((previous, text) => contextualWork(text, previous), summary);
}
