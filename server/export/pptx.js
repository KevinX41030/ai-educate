const path = require('path');
const fs = require('fs');
const PptxGenJS = require('pptxgenjs');

const EXPORT_DIR = path.join(__dirname, '..', '..', 'data', 'exports');
const FONT = 'Microsoft YaHei';

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

function addTitle(slide, title) {
  slide.addText(title, {
    x: 0.6,
    y: 0.5,
    w: 12.0,
    h: 0.8,
    fontSize: 36,
    bold: true,
    fontFace: FONT,
    color: '1F2937'
  });
}

function addSubtitle(slide, text) {
  slide.addText(text, {
    x: 0.6,
    y: 1.6,
    w: 12.0,
    h: 0.5,
    fontSize: 18,
    fontFace: FONT,
    color: '6B7280'
  });
}

function addBullets(slide, items) {
  const bulletText = items.map((item) => `• ${item}`).join('\n');
  slide.addText(bulletText, {
    x: 0.9,
    y: 1.8,
    w: 11.5,
    h: 4.5,
    fontSize: 20,
    fontFace: FONT,
    color: '111827',
    valign: 'top'
  });
}

function normalizeDraft(draft) {
  if (!draft || !Array.isArray(draft.ppt)) return null;
  return draft;
}

function buildPptx(draft) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'AI-Educate';
  pptx.company = 'AI-Educate';
  pptx.subject = 'Teaching Slides';
  pptx.title = 'Teaching Deck';

  const slides = draft.ppt;
  if (slides.length === 0) return pptx;

  const cover = slides.find((s) => s.type === 'cover') || slides[0];
  const toc = slides.find((s) => s.type === 'toc');
  const summary = slides.find((s) => s.type === 'summary');
  const contentSlides = slides.filter((s) => s.type === 'content');

  const coverSlide = pptx.addSlide();
  addTitle(coverSlide, cover.title || '教学课件');
  addSubtitle(coverSlide, (cover.bullets || []).filter(Boolean).join(' · ') || '');

  if (toc) {
    const tocSlide = pptx.addSlide();
    addTitle(tocSlide, toc.title || '目录');
    addBullets(tocSlide, toc.bullets || []);
  }

  contentSlides.forEach((content) => {
    const slide = pptx.addSlide();
    addTitle(slide, content.title || '内容');
    addBullets(slide, content.bullets || []);
  });

  if (summary) {
    const summarySlide = pptx.addSlide();
    addTitle(summarySlide, summary.title || '总结');
    addBullets(summarySlide, summary.bullets || []);
  }

  return pptx;
}

async function exportPptx(draft, fileNamePrefix = 'lesson') {
  const normalized = normalizeDraft(draft);
  if (!normalized) return null;

  ensureExportDir();
  const fileName = `${fileNamePrefix}-${Date.now()}.pptx`;
  const filePath = path.join(EXPORT_DIR, fileName);
  const pptx = buildPptx(normalized);
  await pptx.writeFile({ fileName: filePath });
  return { fileName, filePath };
}

module.exports = {
  exportPptx,
  EXPORT_DIR
};
