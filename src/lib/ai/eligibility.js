import { fitsContext, UNKNOWN_CONTEXT } from './context-budget.js';

/** Shared hard constraints. A positive rank never makes an incompatible model eligible. */
export function modelProblem(model, {image=false,pdf=false,search=false,tools=false,structuredOutput=false,
  tokens=0,minContext=0,minInputTokens=0,unavailable=false}={}) {
  if(unavailable) return 'is not available from your connected provider';
  if(!model && (image||pdf)) return 'has no verified attachment capabilities';
  if(image && !model?.vision) return "can't read images";
  if(pdf && !model?.pdf) return "can't read PDFs";
  if(search && !model?.search) return 'does not support web search';
  if(tools && model?.tools!==true) return 'has no verified tool-calling support';
  if(structuredOutput && model?.structuredOutput!==true) return 'has no verified structured-output support';
  const context=model?.context;
  const known=Number.isFinite(context)&&context>0;
  if(minContext && (!known || context<minContext)) return 'has too little verified context for this task';
  if(minInputTokens && (!known || !fitsContext(context,minInputTokens))) return 'has too little verified context for the input and a reply';
  if(!fitsContext(known?context:UNKNOWN_CONTEXT,tokens)) return known?'is too small for this much text and a reply':'has no verified context window for this much text';
  return null;
}

/** Extracted text does not require a native image/PDF transport. */
export function attachmentNeeds(files=[]) {
  return {image:files.some(f=>f.kind==='image'&&!f.text),pdf:files.some(f=>f.kind==='pdf'&&!f.text)};
}
