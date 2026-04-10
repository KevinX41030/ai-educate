const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const { chunkText, normalizeWhitespace, summarizeText } = require('../lib/text');

let cachedPdfParse = null;

function getPdfParse() {
  if (!cachedPdfParse) {
    cachedPdfParse = require('pdf-parse');
  }
  return cachedPdfParse;
}

function getFileExtension(fileName = '') {
  return path.extname(fileName).toLowerCase();
}

function decodeXmlEntities(text = '') {
  return String(text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractXmlText(xml = '', tagName) {
  if (!xml) return [];
  try {
    const document = new DOMParser().parseFromString(xml, 'text/xml');
    const nodes = document.getElementsByTagName(tagName);
    const values = [];
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes.item(index);
      const text = normalizeWhitespace(node?.textContent || '');
      if (text) values.push(text);
    }
    return values;
  } catch (error) {
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'g');
    const matches = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const text = normalizeWhitespace(decodeXmlEntities(match[1]));
      if (text) matches.push(text);
    }
    return matches;
  }
}

async function parsePdf(filePath) {
  const pdfParse = getPdfParse();
  const buffer = fs.readFileSync(filePath);
  const result = await pdfParse(buffer);
  return normalizeWhitespace(result?.text || '');
}

async function parseDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return normalizeWhitespace(result?.value || '');
}

async function parsePptx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const slideEntries = Object.keys(zip.files)
    .filter((file) => /^ppt\/slides\/slide\d+\.xml$/i.test(file))
    .sort((left, right) => {
      const leftNum = Number((left.match(/slide(\d+)\.xml/i) || [])[1] || 0);
      const rightNum = Number((right.match(/slide(\d+)\.xml/i) || [])[1] || 0);
      return leftNum - rightNum;
    });

  const slides = [];
  for (const entry of slideEntries) {
    const xml = await zip.file(entry)?.async('string');
    if (!xml) continue;
    const texts = extractXmlText(xml, 'a:t');
    if (texts.length) slides.push(texts.join(' '));
  }

  return normalizeWhitespace(slides.join('\n\n'));
}

function shouldParseFile(file = {}) {
  const extension = getFileExtension(file.name || file.originalname || file.path || '');
  return ['.pdf', '.docx', '.pptx'].includes(extension);
}

async function extractDocumentText(file = {}) {
  const extension = getFileExtension(file.name || file.originalname || file.path || '');
  const filePath = file.diskPath || file.path || '';
  if (!filePath) return '';

  if (extension === '.pdf') return parsePdf(filePath);
  if (extension === '.docx') return parseDocx(filePath);
  if (extension === '.pptx') return parsePptx(filePath);
  return '';
}

async function enrichUploadedFile(file = {}) {
  const baseFile = {
    ...file,
    status: 'uploaded',
    parseSummary: '',
    parsedAt: '',
    chunkCount: 0,
    parsedText: ''
  };

  if (!shouldParseFile(file)) {
    return {
      ...baseFile,
      parseSummary: '当前格式暂未自动解析，可保留为参考附件。'
    };
  }

  try {
    const parsedText = await extractDocumentText(file);
    const chunks = chunkText(parsedText);
    return {
      ...baseFile,
      status: 'parsed',
      parseSummary: chunks.length
        ? summarizeText(parsedText, 140)
        : '已完成解析，但未提取到可用文本。',
      parsedAt: new Date().toISOString(),
      chunkCount: chunks.length,
      parsedText
    };
  } catch (error) {
    return {
      ...baseFile,
      status: 'failed',
      parseSummary: '解析失败，当前文件不会参与自动检索。',
      parsedAt: new Date().toISOString(),
      chunkCount: 0,
      parsedText: ''
    };
  }
}

module.exports = {
  shouldParseFile,
  extractDocumentText,
  enrichUploadedFile
};
