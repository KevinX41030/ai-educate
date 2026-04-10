function extractPartialJsonStringField(text, fieldName) {
  const fieldToken = `"${fieldName}"`;
  const fieldIndex = text.indexOf(fieldToken);
  if (fieldIndex < 0) return null;

  let index = fieldIndex + fieldToken.length;
  while (index < text.length && /\s/.test(text[index])) index += 1;
  if (text[index] !== ':') return null;

  index += 1;
  while (index < text.length && /\s/.test(text[index])) index += 1;
  if (text[index] !== '"') return null;

  index += 1;
  let decoded = '';
  let escaped = false;

  for (; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      if (char === 'u') {
        const hex = text.slice(index + 1, index + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
        decoded += String.fromCharCode(Number.parseInt(hex, 16));
        index += 4;
      } else {
        const escapeMap = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          b: '\b',
          f: '\f',
          n: '\n',
          r: '\r',
          t: '\t'
        };
        decoded += escapeMap[char] ?? char;
      }
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      return decoded;
    }

    decoded += char;
  }

  return decoded;
}

function createJsonFieldDeltaTracker(fieldName, onDelta) {
  let rawText = '';
  let emittedText = '';

  return (delta) => {
    rawText += String(delta || '');
    const currentText = extractPartialJsonStringField(rawText, fieldName);
    if (typeof currentText !== 'string') return;
    if (!currentText.startsWith(emittedText)) {
      let prefixLength = 0;
      const maxPrefix = Math.min(currentText.length, emittedText.length);
      while (prefixLength < maxPrefix && currentText[prefixLength] === emittedText[prefixLength]) {
        prefixLength += 1;
      }
      const nextDelta = currentText.slice(prefixLength);
      emittedText = currentText;
      if (nextDelta) {
        onDelta?.(nextDelta, currentText);
      }
      return;
    }
    const nextDelta = currentText.slice(emittedText.length);
    if (!nextDelta) return;
    emittedText = currentText;
    onDelta?.(nextDelta, currentText);
  };
}

function safeJsonParseSnippet(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function extractCompletedJsonArrayItems(text, fieldName) {
  const raw = String(text || '');
  const fieldToken = `"${fieldName}"`;
  const fieldIndex = raw.indexOf(fieldToken);
  if (fieldIndex < 0) return [];

  let index = fieldIndex + fieldToken.length;
  while (index < raw.length && /\s/.test(raw[index])) index += 1;
  if (raw[index] !== ':') return [];

  index += 1;
  while (index < raw.length && /\s/.test(raw[index])) index += 1;
  if (raw[index] !== '[') return [];

  const items = [];
  let itemStart = -1;
  let objectDepth = 0;
  let arrayDepth = 0;
  let inString = false;
  let escaped = false;

  for (index += 1; index < raw.length; index += 1) {
    const char = raw[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inString) {
      if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (itemStart < 0) {
      if (/\s|,/.test(char)) continue;
      if (char === ']') break;
      if (char === '{') {
        itemStart = index;
        objectDepth = 1;
        arrayDepth = 0;
      }
      continue;
    }

    if (char === '{') {
      objectDepth += 1;
      continue;
    }

    if (char === '}') {
      objectDepth -= 1;
      if (objectDepth === 0 && arrayDepth === 0) {
        items.push(raw.slice(itemStart, index + 1));
        itemStart = -1;
      }
      continue;
    }

    if (char === '[') {
      arrayDepth += 1;
      continue;
    }

    if (char === ']' && arrayDepth > 0) {
      arrayDepth -= 1;
    }
  }

  return items;
}

module.exports = {
  extractPartialJsonStringField,
  createJsonFieldDeltaTracker,
  safeJsonParseSnippet,
  extractCompletedJsonArrayItems
};
