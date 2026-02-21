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
    x: 9.2,
    y: 0,
    w: 4.13,
    h: 7.5,
    fill: { color: BASE_THEME.lightAccent },
    line: { color: BASE_THEME.lightAccent }
  });
  cover.addShape(SHAPE.circle, {
    x: 9.7,
    y: 0.7,
    w: 2.8,
    h: 2.8,
    fill: { color: 'FFFFFF' },
    line: { color: 'FFFFFF' }
  });
  cover.addShape(SHAPE.circle, {
    x: 10.5,
    y: 3.1,
    w: 1.4,
    h: 1.4,
    fill: { color: BASE_THEME.accent },
    line: { color: BASE_THEME.accent }
  });
  addTopBar(cover);
  cover.addText('{{title}}', {
    x: 0.8,
    y: 1.1,
    w: 8.2,
    h: 1.3,
    fontSize: 42,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text
  });
  cover.addText('{{subtitle}}', {
    x: 0.8,
    y: 2.7,
    w: 8.2,
    h: 0.6,
    fontSize: 18,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.muted
  });
  cover.addShape(SHAPE.roundRect, {
    x: 0.8,
    y: 3.7,
    w: 4.8,
    h: 0.6,
    fill: { color: BASE_THEME.primary },
    line: { color: BASE_THEME.primary },
    radius: 0.08
  });
  cover.addText('{{meta}}', {
    x: 1.0,
    y: 3.78,
    w: 4.4,
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
  toc.addShape(SHAPE.roundRect, {
    x: 0.9,
    y: 1.6,
    w: 11.4,
    h: 5.2,
    fill: { color: 'F8FAFC' },
    line: { color: 'E2E8F0' },
    radius: 0.1
  });
  toc.addText('{{bullets}}', {
    x: 1.2,
    y: 1.8,
    w: 10.8,
    h: 4.8,
    fontSize: 18,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });

  const concept = pptx.addSlide();
  concept.background = { color: 'FFFFFF' };
  addTopBar(concept);
  concept.addText('{{title}}', {
    x: 0.9,
    y: 0.5,
    w: 11.0,
    h: 0.8,
    fontSize: 26,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text
  });
  concept.addText('{{bullets}}', {
    x: 0.9,
    y: 1.5,
    w: 7.1,
    h: 4.9,
    fontSize: 16,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });
  concept.addShape(SHAPE.roundRect, {
    x: 8.3,
    y: 1.4,
    w: 4.2,
    h: 5.1,
    fill: { color: 'EFF6FF' },
    line: { color: 'CBD5F5' },
    radius: 0.1
  });
  concept.addText('课堂案例', {
    x: 8.5,
    y: 1.6,
    w: 3.8,
    h: 0.3,
    fontSize: 11,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.primary
  });
  concept.addText('{{example}}', {
    x: 8.5,
    y: 2.0,
    w: 3.8,
    h: 1.2,
    fontSize: 10,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });
  concept.addText('互动提问', {
    x: 8.5,
    y: 3.4,
    w: 3.8,
    h: 0.3,
    fontSize: 11,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.primary
  });
  concept.addText('{{question}}', {
    x: 8.5,
    y: 3.8,
    w: 3.8,
    h: 1.0,
    fontSize: 10,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });
  concept.addText('视觉提示', {
    x: 8.5,
    y: 5.1,
    w: 3.8,
    h: 0.3,
    fontSize: 11,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.primary
  });
  concept.addText('{{visual}}', {
    x: 8.5,
    y: 5.5,
    w: 3.8,
    h: 0.7,
    fontSize: 10,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.muted,
    valign: 'top'
  });

  const process = pptx.addSlide();
  process.background = { color: 'FFFFFF' };
  addTopBar(process);
  process.addText('{{title}}', {
    x: 0.9,
    y: 0.5,
    w: 11.0,
    h: 0.8,
    fontSize: 26,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text
  });
  process.addShape(SHAPE.line, {
    x: 1.4,
    y: 1.8,
    w: 0,
    h: 4.2,
    line: { color: 'CBD5F5', width: 2 }
  });
  [0, 1, 2, 3].forEach((idx) => {
    process.addShape(SHAPE.circle, {
      x: 1.25,
      y: 1.7 + idx * 1.2,
      w: 0.3,
      h: 0.3,
      fill: { color: BASE_THEME.accent },
      line: { color: BASE_THEME.accent }
    });
  });
  process.addText('{{steps}}', {
    x: 1.8,
    y: 1.5,
    w: 5.6,
    h: 4.8,
    fontSize: 16,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });
  process.addShape(SHAPE.roundRect, {
    x: 7.8,
    y: 1.5,
    w: 4.7,
    h: 4.8,
    fill: { color: 'F8FAFC' },
    line: { color: 'E2E8F0' },
    radius: 0.1
  });
  process.addText('关键要点', {
    x: 8.1,
    y: 1.8,
    w: 4.2,
    h: 0.3,
    fontSize: 11,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.primary
  });
  process.addText('{{bullets_right}}', {
    x: 8.1,
    y: 2.2,
    w: 4.1,
    h: 3.8,
    fontSize: 12,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });

  const caseSlide = pptx.addSlide();
  caseSlide.background = { color: 'FFFFFF' };
  addTopBar(caseSlide);
  caseSlide.addText('{{title}}', {
    x: 0.9,
    y: 0.5,
    w: 11.0,
    h: 0.8,
    fontSize: 26,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text
  });
  caseSlide.addShape(SHAPE.roundRect, {
    x: 0.9,
    y: 1.6,
    w: 7.4,
    h: 4.9,
    fill: { color: 'F8FAFC' },
    line: { color: 'E2E8F0' },
    radius: 0.12
  });
  caseSlide.addText('案例情境', {
    x: 1.2,
    y: 1.9,
    w: 6.9,
    h: 0.3,
    fontSize: 11,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.primary
  });
  caseSlide.addText('{{case}}', {
    x: 1.2,
    y: 2.3,
    w: 6.9,
    h: 3.9,
    fontSize: 13,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });
  caseSlide.addShape(SHAPE.roundRect, {
    x: 8.5,
    y: 1.6,
    w: 3.8,
    h: 4.9,
    fill: { color: BASE_THEME.lightAccent },
    line: { color: BASE_THEME.lightAccent },
    radius: 0.12
  });
  caseSlide.addText('要点提炼', {
    x: 8.7,
    y: 1.9,
    w: 3.4,
    h: 0.3,
    fontSize: 11,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.primary
  });
  caseSlide.addText('{{takeaways}}', {
    x: 8.7,
    y: 2.3,
    w: 3.4,
    h: 4.0,
    fontSize: 11,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });

  const activity = pptx.addSlide();
  activity.background = { color: 'FFFFFF' };
  addTopBar(activity);
  activity.addText('{{title}}', {
    x: 0.9,
    y: 0.5,
    w: 11.0,
    h: 0.8,
    fontSize: 26,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text
  });
  activity.addShape(SHAPE.roundRect, {
    x: 0.9,
    y: 1.7,
    w: 6.0,
    h: 4.8,
    fill: { color: 'F8FAFC' },
    line: { color: 'E2E8F0' },
    radius: 0.12
  });
  activity.addText('课堂活动', {
    x: 1.2,
    y: 2.0,
    w: 5.4,
    h: 0.3,
    fontSize: 11,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.primary
  });
  activity.addText('{{activity}}', {
    x: 1.2,
    y: 2.4,
    w: 5.4,
    h: 4.0,
    fontSize: 13,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });
  activity.addShape(SHAPE.roundRect, {
    x: 7.3,
    y: 1.7,
    w: 5.0,
    h: 4.8,
    fill: { color: BASE_THEME.lightAccent },
    line: { color: BASE_THEME.lightAccent },
    radius: 0.12
  });
  activity.addText('即时小测', {
    x: 7.6,
    y: 2.0,
    w: 4.4,
    h: 0.3,
    fontSize: 11,
    bold: true,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.primary
  });
  activity.addText('{{question}}', {
    x: 7.6,
    y: 2.4,
    w: 4.3,
    h: 1.6,
    fontSize: 12,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });
  activity.addText('{{bullets_right}}', {
    x: 7.6,
    y: 4.1,
    w: 4.3,
    h: 2.2,
    fontSize: 11,
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
  summary.addShape(SHAPE.roundRect, {
    x: 0.9,
    y: 1.6,
    w: 11.6,
    h: 3.2,
    fill: { color: 'F8FAFC' },
    line: { color: 'E2E8F0' },
    radius: 0.1
  });
  summary.addText('{{bullets}}', {
    x: 1.2,
    y: 1.8,
    w: 11.0,
    h: 2.8,
    fontSize: 15,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });
  summary.addShape(SHAPE.roundRect, {
    x: 0.9,
    y: 5.1,
    w: 11.6,
    h: 1.8,
    fill: { color: BASE_THEME.lightAccent },
    line: { color: BASE_THEME.lightAccent },
    radius: 0.08
  });
  summary.addText('{{summary_note}}', {
    x: 1.2,
    y: 5.25,
    w: 11.0,
    h: 1.4,
    fontSize: 12,
    fontFace: BASE_THEME.font,
    color: BASE_THEME.text,
    valign: 'top'
  });

  await pptx.writeFile({ fileName: filePath });
}

async function ensureTemplateFile(customPath) {
  const filePath = customPath || DEFAULT_TEMPLATE;
  if (fs.existsSync(filePath) && process.env.TEMPLATE_REBUILD !== '1') {
    return filePath;
  }
  ensureDir(path.dirname(filePath));
  await createTemplate(filePath);
  return filePath;
}

module.exports = {
  ensureTemplateFile,
  DEFAULT_TEMPLATE
};
