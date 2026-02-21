const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');
const DEFAULT_TEMPLATE = path.join(TEMPLATE_DIR, 'ai-educate-template.pptx');
const BASE_THEME = {
  primary: '1F3B73',
  accent: '4C8BF5',
  lightAccent: 'E8F1FF',
  background: 'F8FAFC',
  text: '0F172A',
  muted: '475569',
  font: 'Microsoft YaHei'
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function createTemplate(filePath) {
  const pptx = new PptxGenJS();
  const SHAPE = pptx.ShapeType || PptxGenJS.ShapeType;
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'AI-Educate';
  pptx.company = 'AI-Educate';
  pptx.title = 'AI-Educate Template';
  pptx.theme = {
    headFontFace: BASE_THEME.font,
    bodyFontFace: BASE_THEME.font,
    lang: 'zh-CN'
  };

  const addTopBar = (slide) => {
    slide.addShape(SHAPE.rect, {
      x: 0,
      y: 0,
      w: 13.33,
      h: 0.2,
      fill: { color: BASE_THEME.primary },
      line: { color: BASE_THEME.primary }
    });
  };

  const cover = pptx.addSlide();
  cover.background = { color: BASE_THEME.background };
  cover.addShape(SHAPE.rect, {
    x: 9.5,
    y: 0,
    w: 3.83,
    h: 7.5,
    fill: { color: BASE_THEME.lightAccent },
    line: { color: BASE_THEME.lightAccent }
  });
  addTopBar(cover);
  cover.addText('{{title}}', {
    x: 0.8,
    y: 1.2,
    w: 8.3,
    h: 1.2,
    fontSize: 40,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text
  });
  cover.addText('{{subtitle}}', {
    x: 0.8,
    y: 2.6,
    w: 8.2,
    h: 0.6,
    fontSize: 18,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.muted
  });
  cover.addShape(SHAPE.roundRect, {
    x: 0.8,
    y: 3.5,
    w: 4.2,
    h: 0.55,
    fill: { color: BASE_THEME.primary },
    line: { color: BASE_THEME.primary },
    radius: 0.08
  });
  cover.addText('{{meta}}', {
    x: 1.0,
    y: 3.55,
    w: 3.8,
    h: 0.45,
    fontSize: 12,
    fontFace: BASE_THEME.font,
    color: 'FFFFFF',
    valign: 'mid'
  });

  const toc = pptx.addSlide();
  toc.background = { color: 'FFFFFF' };
  addTopBar(toc);
  toc.addText('{{title}}', {
    x: 0.9,
    y: 0.6,
    w: 11.2,
    h: 0.8,
    fontSize: 28,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text
  });
  toc.addText('{{bullets}}', {
    x: 1.1,
    y: 1.7,
    w: 11.2,
    h: 5.2,
    fontSize: 18,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });

  const content = pptx.addSlide();
  content.background = { color: 'FFFFFF' };
  addTopBar(content);
  content.addText('{{title}}', {
    x: 0.9,
    y: 0.5,
    w: 11.0,
    h: 0.8,
    fontSize: 26,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text
  });
  content.addText('{{bullets}}', {
    x: 0.9,
    y: 1.5,
    w: 7.1,
    h: 4.9,
    fontSize: 16,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });
  content.addShape(SHAPE.roundRect, {
    x: 8.3,
    y: 1.5,
    w: 4.2,
    h: 5.0,
    fill: { color: 'EFF6FF' },
    line: { color: 'CBD5F5' },
    radius: 0.1
  });
  content.addText('Example', {
    x: 8.5,
    y: 1.7,
    w: 3.8,
    h: 0.3,
    fontSize: 11,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.primary
  });
  content.addText('{{example}}', {
    x: 8.5,
    y: 2.1,
    w: 3.8,
    h: 1.1,
    fontSize: 10,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });
  content.addText('Question', {
    x: 8.5,
    y: 3.4,
    w: 3.8,
    h: 0.3,
    fontSize: 11,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.primary
  });
  content.addText('{{question}}', {
    x: 8.5,
    y: 3.8,
    w: 3.8,
    h: 1.0,
    fontSize: 10,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });
  content.addText('Visual', {
    x: 8.5,
    y: 5.1,
    w: 3.8,
    h: 0.3,
    fontSize: 11,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.primary
  });
  content.addText('{{visual}}', {
    x: 8.5,
    y: 5.5,
    w: 3.8,
    h: 0.7,
    fontSize: 10,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.muted,
    valign: 'top'
  });

  const summary = pptx.addSlide();
  summary.background = { color: 'FFFFFF' };
  addTopBar(summary);
  summary.addText('{{title}}', {
    x: 0.9,
    y: 0.6,
    w: 11.2,
    h: 0.8,
    fontSize: 26,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text
  });
  summary.addText('{{bullets}}', {
    x: 1.1,
    y: 1.7,
    w: 11.2,
    h: 3.4,
    fontSize: 16,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });
  summary.addShape(SHAPE.roundRect, {
    x: 1.1,
    y: 5.3,
    w: 11.2,
    h: 1.6,
    fill: { color: BASE_THEME.lightAccent },
    line: { color: BASE_THEME.lightAccent },
    radius: 0.08
  });
  summary.addText('{{summary_note}}', {
    x: 1.3,
    y: 5.45,
    w: 10.8,
    h: 1.3,
    fontSize: 12,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });

  await pptx.writeFile({ fileName: filePath });
}

async function ensureTemplateFile(customPath) {
  const filePath = customPath || DEFAULT_TEMPLATE;
  if (fs.existsSync(filePath)) return filePath;
  ensureDir(path.dirname(filePath));
  await createTemplate(filePath);
  return filePath;
}

module.exports = {
  ensureTemplateFile,
  DEFAULT_TEMPLATE
};
