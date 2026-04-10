const PptxGenJS = require('pptxgenjs');
const { stripHtml } = require('../lib/client-errors');
const {
  CLASSROOM_VIEWPORT_SIZE,
  CLASSROOM_VIEWPORT_HEIGHT,
  normalizeClassroom
} = require('./schema');

const SLIDE_WIDTH = 13.333;
const SLIDE_HEIGHT = 7.5;

function toInchesX(value) {
  return (Number(value || 0) / CLASSROOM_VIEWPORT_SIZE) * SLIDE_WIDTH;
}

function toInchesY(value) {
  return (Number(value || 0) / CLASSROOM_VIEWPORT_HEIGHT) * SLIDE_HEIGHT;
}

function pxToPt(value, fallback = 16) {
  const px = Number(value);
  if (!Number.isFinite(px) || px <= 0) return fallback;
  return px * 0.75;
}

function stripHash(color, fallback = '000000') {
  const raw = `${color || ''}`.replace('#', '').trim();
  return raw || fallback;
}

function decodeHtmlEntities(value = '') {
  return `${value || ''}`
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToPlainText(html = '') {
  return decodeHtmlEntities(
    `${html || ''}`
      .replace(/<\/(p|div|li|h\d)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
  )
    .split('\n')
    .map((line) => stripHtml(line))
    .filter(Boolean)
    .join('\n');
}

function extractStyleValue(html = '', prop = '', fallback = '') {
  const pattern = new RegExp(`${prop}\\s*:\\s*([^;"]+)`, 'i');
  const match = `${html || ''}`.match(pattern);
  return match?.[1]?.trim() || fallback;
}

function extractFontSize(html = '', fallback = 18) {
  const raw = extractStyleValue(html, 'font-size', '');
  const numeric = Number(`${raw}`.replace(/px$/i, '').trim());
  return Number.isFinite(numeric) ? numeric : fallback;
}

function extractTextAlign(html = '', fallback = 'left') {
  const raw = extractStyleValue(html, 'text-align', fallback).toLowerCase();
  return ['left', 'center', 'right', 'justify'].includes(raw) ? raw : fallback;
}

function buildThemeProps(theme = {}) {
  return {
    backgroundColor: theme.backgroundColor || '#FFFFFF',
    fontName: theme.fontName || 'Microsoft YaHei',
    fontColor: theme.fontColor || '#1F2937'
  };
}

function addTextElement(slide, element, canvasTheme) {
  const html = element.content || '';
  const text = htmlToPlainText(html);
  if (!text) return;

  slide.addText(text, {
    x: toInchesX(element.left),
    y: toInchesY(element.top),
    w: toInchesX(element.width),
    h: toInchesY(element.height),
    fontFace: element.defaultFontName || canvasTheme.fontName,
    fontSize: pxToPt(extractFontSize(html, 18)),
    color: stripHash(element.defaultColor || canvasTheme.fontColor, '1F2937'),
    align: extractTextAlign(html, 'left'),
    valign: 'mid',
    margin: 0.03,
    breakLine: false,
    fit: 'shrink'
  });
}

function addShapeElement(slide, element, shapeType) {
  slide.addShape(shapeType.rect, {
    x: toInchesX(element.left),
    y: toInchesY(element.top),
    w: toInchesX(element.width),
    h: toInchesY(element.height),
    fill: { color: stripHash(element.fill, 'E5E7EB') },
    line: { color: stripHash(element.fill, 'E5E7EB') }
  });
}

function addLineElement(slide, element, shapeType) {
  slide.addShape(shapeType.line, {
    x: toInchesX(element.left + (element.start?.[0] || 0)),
    y: toInchesY(element.top + (element.start?.[1] || 0)),
    w: toInchesX((element.end?.[0] || 0) - (element.start?.[0] || 0)),
    h: toInchesY((element.end?.[1] || 0) - (element.start?.[1] || 0)),
    line: {
      color: stripHash(element.color, '94A3B8'),
      width: pxToPt(element.width || 2, 1.5) / 2,
      dashType: element.style === 'dashed'
        ? 'dash'
        : (element.style === 'dotted' ? 'sysDot' : 'solid')
    },
    endArrowType: Array.isArray(element.points) && element.points[1] === 'arrow' ? 'triangle' : undefined
  });
}

function addTableElement(slide, element, canvasTheme) {
  const rows = Array.isArray(element.data) ? element.data : [];
  if (!rows.length) return;

  const tableRows = rows.map((row) => row.map((cell) => ({
    text: cell.text || '',
    options: {
      bold: Boolean(cell.style?.bold),
      color: stripHash(cell.style?.color || canvasTheme.fontColor, '1F2937'),
      fill: cell.style?.backcolor ? stripHash(cell.style.backcolor, 'FFFFFF') : undefined,
      align: cell.style?.align || 'left',
      fontSize: pxToPt(cell.style?.fontsize || 15),
      fontFace: canvasTheme.fontName,
      margin: 0.03
    }
  })));

  slide.addTable(tableRows, {
    x: toInchesX(element.left),
    y: toInchesY(element.top),
    w: toInchesX(element.width),
    h: toInchesY(element.height),
    border: {
      type: 'solid',
      pt: (element.outline?.width || 1) * 0.75,
      color: stripHash(element.outline?.color, 'D9E2F3')
    },
    colW: Array.isArray(element.colWidths) && element.colWidths.length
      ? element.colWidths.map((ratio) => ratio * toInchesX(element.width))
      : undefined,
    autoFit: false,
    margin: 0.03
  });
}

function addLatexElement(slide, element, canvasTheme) {
  const text = htmlToPlainText(element.html || '') || element.latex || '';
  if (!text) return;
  slide.addText(text, {
    x: toInchesX(element.left),
    y: toInchesY(element.top),
    w: toInchesX(element.width),
    h: toInchesY(element.height),
    fontFace: canvasTheme.fontName,
    fontSize: 18,
    color: stripHash(element.color || canvasTheme.fontColor, '1F2937'),
    align: element.align || 'left',
    valign: 'mid',
    margin: 0.02,
    italic: false,
    bold: true,
    fit: 'shrink'
  });
}

function addImageElement(slide, element) {
  if (!element.src) return;
  try {
    if (/^data:/i.test(element.src)) {
      slide.addImage({
        data: element.src,
        x: toInchesX(element.left),
        y: toInchesY(element.top),
        w: toInchesX(element.width),
        h: toInchesY(element.height)
      });
      return;
    }
    slide.addImage({
      path: element.src,
      x: toInchesX(element.left),
      y: toInchesY(element.top),
      w: toInchesX(element.width),
      h: toInchesY(element.height)
    });
  } catch (error) {
    // Ignore invalid/remote image paths in demo export mode.
  }
}

function populateSlide(slide, scene, pptx) {
  const canvas = scene?.content?.canvas;
  if (!canvas) return;
  const shapeType = pptx.ShapeType || PptxGenJS.ShapeType;
  const theme = buildThemeProps(canvas.theme || {});
  slide.background = { color: stripHash(theme.backgroundColor, 'FFFFFF') };

  (canvas.elements || []).forEach((element) => {
    switch (element.type) {
      case 'text':
        addTextElement(slide, element, theme);
        break;
      case 'shape':
        addShapeElement(slide, element, shapeType);
        break;
      case 'line':
        addLineElement(slide, element, shapeType);
        break;
      case 'table':
        addTableElement(slide, element, theme);
        break;
      case 'latex':
        addLatexElement(slide, element, theme);
        break;
      case 'image':
        addImageElement(slide, element);
        break;
      default:
        break;
    }
  });
}

function buildClassroomPptx(classroom, options = {}) {
  const normalized = normalizeClassroom(classroom, {
    source: options.source || 'classroom_export'
  });
  if (!normalized || !Array.isArray(normalized.scenes) || !normalized.scenes.length) return null;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'AI-Educate';
  pptx.company = 'AI-Educate';
  pptx.subject = normalized.stage?.name || 'Teaching Slides';
  pptx.title = normalized.stage?.name || 'Teaching Slides';
  pptx.theme = {
    headFontFace: normalized.stage?.theme?.fontName || 'Microsoft YaHei',
    bodyFontFace: normalized.stage?.theme?.fontName || 'Microsoft YaHei',
    lang: normalized.language || 'zh-CN'
  };

  normalized.scenes.forEach((scene) => {
    const slide = pptx.addSlide();
    populateSlide(slide, scene, pptx);
    const notes = scene?.slideMeta?.notes || scene?.slideMeta?.speakerNotes || '';
    if (notes && typeof slide.addNotes === 'function') {
      slide.addNotes(notes);
    }
  });

  return pptx;
}

async function writeClassroomPptx(classroom, filePath, options = {}) {
  const pptx = buildClassroomPptx(classroom, options);
  if (!pptx) return null;
  await pptx.writeFile({ fileName: filePath });
  return { filePath };
}

module.exports = {
  buildClassroomPptx,
  writeClassroomPptx
};
