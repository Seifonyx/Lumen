// Conservative estimates, not a provider tokenizer. Leave room for serialization and an answer.
export function textTokens(text = '') {
  let wide = 0;
  for (const char of text) if (char.codePointAt(0) > 127) wide++;
  return Math.ceil((text.length - wide) / 4 + wide / 2);
}

export function contentTokens(text = '', files = []) {
  return textTokens(text) + files.reduce((sum, file) => {
    if (file.text) return sum + textTokens(file.text) + 30;
    if (file.kind === 'image') return sum + 1600;
    if (file.kind === 'pdf') return sum + Math.ceil((file.size || 0) / 3000) * 260 + 300;
    return sum;
  }, 0);
}

export function inputBudget(context) {
  if (!Number.isFinite(context) || context <= 0) return Infinity;
  const answer = Math.min(8192, Math.max(1024, Math.floor(context * .15)));
  return Math.max(0, Math.floor(context * .9) - answer);
}

export function fitsContext(context, tokens) { return tokens <= inputBudget(context); }

export function requestTokens(messages, instructions = '') {
  return textTokens(instructions) + 100 + messages.reduce((sum, message) => sum + contentTokens(message.text, message.files) + 8, 0);
}
