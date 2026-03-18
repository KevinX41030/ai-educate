const path = require('path');
const fs = require('fs');
const PptxGenJS = require('pptxgenjs');
const { ensureTemplateFile } = require('./template');
const { buildEditablePptx } = require('./editable');
const { sceneToPptSpec } = require('../ppt/scene');

const EXPORT_DIR = path.join(__dirname, '..', '..', 'data', 'exports');
const DEFAULT_THEME = {
  primary: '1F3B73',
  accent: '4C8BF5',
  background: 'F8FAFC',
  text: '0F172A',
  muted: '475569',
  font: 'Microsoft YaHei'
};

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

function normalizeColor(color, fallback) {
  if (!color) return fallback;
  return String(color).replace('#', '').toUpperCase();
}

function getTheme(draft) {
  const raw = draft.theme || {};
  return {
    primary: normalizeColor(raw.primary, DEFAULT_THEME.primary),
    accent: normalizeColor(raw.accent, DEFAULT_THEME.accent),
    background: normalizeColor(raw.background, DEFAULT_THEME.background),
    text: normalizeColor(raw.text, DEFAULT_THEME.text),
    muted: normalizeColor(raw.muted, DEFAULT_THEME.muted),
    font: raw.font || DEFAULT_THEME.font
  };
}

function addBackground(slide, theme) {
  slide.background = { color: theme.background };
}

function addTopBar(slide, theme, SHAPE) {
  slide.addShape(SHAPE.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.2,
    fill: { color: theme.primary },
    line: { color: theme.primary }
  });
}

function addFooter(slide, theme, index, total, SHAPE) {
  slide.addShape(SHAPE.line, {
    x: 0.6,
    y: 7.1,
    w: 12.2,
    h: 0,
    line: { color: 'E5E7EB', width: 1 }
  });
  slide.addText(`AI-Educate · ${index}/${total}`, {
    x: 0.7,
    y: 7.2,
    w: 12.0,
    h: 0.3,
    fontSize: 10,
    fontFace: theme.font,
    color: theme.muted,
    align: 'right'
  });
}

function addTitle(slide, title, theme) {
  slide.addText(title, {
    x: 0.8,
    y: 0.5,
    w: 11.8,
    h: 0.9,
    fontSize: 32,
    bold: true,
    fontFace: theme.font,
    color: theme.text
  });
}

function addSubtitle(slide, text, theme) {
  slide.addText(text, {
    x: 0.8,
    y: 1.6,
    w: 11.5,
    h: 0.5,
    fontSize: 16,
    fontFace: theme.font,
    color: theme.muted
  });
}

function addBullets(slide, items, theme, opts = {}) {
  const bulletText = items.map((item) => `• ${item}`).join('\n');
  slide.addText(bulletText, {
    x: opts.x ?? 0.9,
    y: opts.y ?? 1.8,
    w: opts.w ?? 7.2,
    h: opts.h ?? 4.8,
    fontSize: opts.fontSize ?? 18,
    fontFace: theme.font,
    color: theme.text,
    valign: 'top'
  });
}

function addInfoCard(slide, theme, data, SHAPE) {
  const x = 8.3;
  const y = 1.6;
  const w = 4.3;
  const h = 4.8;
  slide.addShape(SHAPE.roundRect, {
    x,
    y,
    w,
    h,
    fill: { color: 'EFF6FF' },
    line: { color: 'CBD5F5' },
    radius: 0.1
  });
  slide.addText('课堂示例', {
    x: x + 0.2,
    y: y + 0.2,
    w: w - 0.4,
    h: 0.3,
    fontSize: 12,
    bold: true,
    fontFace: theme.font,
    color: theme.primary
  });
  slide.addText(data.example || '（可补充教学案例）', {
    x: x + 0.2,
    y: y + 0.6,
    w: w - 0.4,
    h: 1.3,
    fontSize: 11,
    fontFace: theme.font,
    color: theme.text,
    valign: 'top'
  });
  slide.addText('互动提问', {
    x: x + 0.2,
    y: y + 2.0,
    w: w - 0.4,
    h: 0.3,
    fontSize: 12,
    bold: true,
    fontFace: theme.font,
    color: theme.primary
  });
  slide.addText(data.question || '（可加入课堂提问）', {
    x: x + 0.2,
    y: y + 2.4,
    w: w - 0.4,
    h: 1.0,
    fontSize: 11,
    fontFace: theme.font,
    color: theme.text,
    valign: 'top'
  });
  slide.addText(`视觉提示：${data.visual || '流程图/示意图'}`, {
    x: x + 0.2,
    y: y + 3.7,
    w: w - 0.4,
    h: 0.6,
    fontSize: 10,
    fontFace: theme.font,
    color: theme.muted,
    valign: 'top'
  });
}

function normalizeDraft(draft) {
  if (!draft || !Array.isArray(draft.ppt)) return null;
  return draft;
}

function normalizeSpec(spec, fallbackSlides) {
  if (!spec || !Array.isArray(spec.slides)) {
    return { slides: fallbackSlides, theme: null, layoutHints: [] };
  }
  return {
    slides: spec.slides.map((slide, idx) => ({
      title: slide.title || fallbackSlides[idx]?.title || '内容',
      type: ['cover', 'toc', 'content', 'summary'].includes(slide.type)
        ? slide.type
        : (fallbackSlides[idx]?.type || 'content'),
      bullets: Array.isArray(slide.bullets) ? slide.bullets : fallbackSlides[idx]?.bullets || [],
      example: slide.example || '',
      question: slide.question || '',
      visual: slide.visual || '',
      notes: slide.notes || '',
      layout: slide.layout || slide.variant || ''
    })),
    theme: spec.theme || null,
    layoutHints: Array.isArray(spec.layoutHints) ? spec.layoutHints : []
  };
}

function getEffectiveSpec(draft, options = {}) {
  const fallbackSlides = Array.isArray(draft?.ppt) ? draft.ppt : [];
  if (options.scene) {
    const mapped = sceneToPptSpec(options.scene, fallbackSlides);
    if (mapped) {
      return normalizeSpec(mapped, fallbackSlides);
    }
  }
  return normalizeSpec(options.pptSpec, fallbackSlides);
}

function resolveSlides(spec, fallbackSlides) {
  const slides = spec.slides || [];
  const fallback = Array.isArray(fallbackSlides) ? fallbackSlides : [];
  const cover = slides.find((s) => s.type === 'cover') || fallback.find((s) => s.type === 'cover') || slides[0];
  const summary = slides.find((s) => s.type === 'summary') || fallback.find((s) => s.type === 'summary');
  const contentSlides = slides.filter((s) => s.type === 'content');
  let toc = slides.find((s) => s.type === 'toc') || fallback.find((s) => s.type === 'toc');
  if (!toc) {
    toc = {
      title: '目录',
      type: 'toc',
      bullets: contentSlides.map((item) => item.title).filter(Boolean)
    };
  }
  return { cover, toc, summary, contentSlides };
}

function splitBullets(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { left: '', right: '' };
  }
  const mid = Math.ceil(items.length / 2);
  const left = items.slice(0, mid);
  const right = items.slice(mid);
  return {
    left: left.map((item) => `• ${item}`).join('\n'),
    right: right.map((item) => `• ${item}`).join('\n')
  };
}

function numberedText(items) {
  if (!Array.isArray(items)) return '';
  return items.filter(Boolean).map((item, idx) => `${idx + 1}. ${item}`).join('\n');
}

function inferLayout(slide) {
  if (slide.layout) return slide.layout;
  if (slide.type !== 'content') return '';
  const title = String(slide.title || '');
  const text = [title, ...(slide.bullets || [])].join(' ');
  if (/(流程|步骤|过程|机制|路径|循环)/.test(text)) return 'process';
  if (/(案例|应用|实验|场景|实例|拓展|综合)/.test(text)) return 'case';
  if (/(练习|互动|讨论|小测|活动|任务|探究)/.test(text)) return 'activity';
  return 'concept';
}

async function loadAutomizer() {
  const mod = await import('pptx-automizer');
  return {
    Automizer: mod.default || mod.Automizer || mod,
    modify: mod.modify || mod.default?.modify
  };
}

function bulletText(items) {
  if (!Array.isArray(items)) return '';
  return items.filter(Boolean).map((item) => `• ${item}`).join('\n');
}

function buildCoverMeta(draft, fields = {}, coverSlide) {
  const metaParts = [];
  if (fields.grade) metaParts.push(fields.grade);
  if (fields.duration) metaParts.push(fields.duration);
  if (fields.style) metaParts.push(fields.style);
  const meta = metaParts.join(' · ');
  if (meta) return meta;
  if (coverSlide?.bullets?.length) return coverSlide.bullets.join(' · ');
  return 'AI-Educate';
}

function buildSummaryNote(draft) {
  if (draft?.lessonPlan?.homework) return draft.lessonPlan.homework;
  if (draft?.interactionIdea?.description) return draft.interactionIdea.description;
  return '';
}

async function applyReplacements(slide, replacements, modify) {
  const items = Object.entries(replacements).map(([key, value]) => ({
    replace: key.includes('{{') ? key : `{{${key}}}`,
    by: { text: value || '' }
  }));
  const elements = await slide.getAllTextElementIds();
  elements.forEach((element) => {
    slide.modifyElement(element, modify.replaceText(items));
  });
}

async function buildPptxWithTemplate(draft, fileName, options = {}) {
  const templatePath = await ensureTemplateFile(options.templatePath);
  const { Automizer, modify } = await loadAutomizer();
  if (!Automizer || !modify) {
    throw new Error('template_engine_unavailable');
  }
  const templateDir = path.dirname(templatePath);
  const templateName = path.basename(templatePath);

  const spec = getEffectiveSpec(draft, options);
  const { cover, toc, summary, contentSlides } = resolveSlides(spec, draft.ppt);
  const coverMeta = buildCoverMeta(draft, options.fields, cover);
  const summaryNote = buildSummaryNote(draft);
  const tocBullets = toc?.bullets?.length ? toc.bullets : contentSlides.map((s) => s.title).filter(Boolean);

  const automizer = new Automizer({
    templateDir,
    outputDir: EXPORT_DIR,
    removeExistingSlides: true,
    autoImportSlideMasters: true,
    verbosity: 0
  });

  const pres = automizer.loadRoot(templateName).load(templateName, 'template');

  if (cover) {
    pres.addSlide('template', 1, async (slide) => {
      await applyReplacements(slide, {
        title: cover.title || '教学课件',
        subtitle: cover.bullets?.join(' · ') || '',
        meta: coverMeta,
        bullets: '',
        bullets_left: '',
        bullets_right: '',
        example: '',
        question: '',
        visual: '',
        summary_note: '',
        steps: '',
        case: '',
        takeaways: '',
        activity: ''
      }, modify);
    });
  }

  if (toc) {
    pres.addSlide('template', 2, async (slide) => {
      await applyReplacements(slide, {
        title: toc.title || '目录',
        bullets: bulletText(tocBullets),
        bullets_left: '',
        bullets_right: '',
        subtitle: '',
        meta: coverMeta,
        example: '',
        question: '',
        visual: '',
        summary_note: '',
        steps: '',
        case: '',
        takeaways: '',
        activity: ''
      }, modify);
    });
  }

  contentSlides.forEach((content) => {
    const layout = inferLayout(content);
    const layoutIndex = layout === 'process'
      ? 4
      : layout === 'case'
        ? 5
        : layout === 'activity'
          ? 6
          : 3;
    const bullets = Array.isArray(content.bullets) ? content.bullets : [];
    const { left, right } = splitBullets(bullets);
    const replacements = {
      title: content.title || '内容',
      bullets: bulletText(bullets),
      bullets_left: left,
      bullets_right: right,
      example: content.example || '',
      question: content.question || '',
      visual: content.visual || '',
      steps: numberedText(bullets),
      case: content.example || bulletText(bullets.slice(0, 4)),
      takeaways: bulletText(bullets.slice(-3)),
      activity: content.question || content.example || bulletText(bullets.slice(0, 4)),
      subtitle: '',
      meta: coverMeta,
      summary_note: ''
    };
    pres.addSlide('template', layoutIndex, async (slide) => {
      await applyReplacements(slide, {
        ...replacements
      }, modify);
    });
  });

  if (summary) {
    pres.addSlide('template', 7, async (slide) => {
      await applyReplacements(slide, {
        title: summary.title || '总结',
        bullets: bulletText(summary.bullets),
        bullets_left: '',
        bullets_right: '',
        summary_note: summaryNote,
        subtitle: '',
        meta: coverMeta,
        example: '',
        question: '',
        visual: '',
        steps: '',
        case: '',
        takeaways: '',
        activity: ''
      }, modify);
    });
  }

  await pres.write(fileName);
}

function buildPptx(draft, options = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'AI-Educate';
  pptx.company = 'AI-Educate';
  pptx.subject = 'Teaching Slides';
  pptx.title = 'Teaching Deck';
  const spec = getEffectiveSpec(draft, options);
  const theme = getTheme({ theme: spec.theme || draft.theme });
  pptx.theme = {
    headFontFace: theme.font,
    bodyFontFace: theme.font,
    lang: 'zh-CN'
  };

  const slides = spec.slides;
  const SHAPE = pptx.ShapeType || PptxGenJS.ShapeType;
  if (slides.length === 0) return pptx;

  const rawHints = Array.isArray(spec.layoutHints) && spec.layoutHints.length
    ? spec.layoutHints
    : ['cover_right_panel', 'content_two_column', 'summary_cards'];
  const layoutHints = new Set(rawHints);
  const { cover, toc, summary, contentSlides } = resolveSlides(spec, draft.ppt);

  const totalSlides = (toc ? 1 : 0) + contentSlides.length + (summary ? 1 : 0) + 1;
  let slideIndex = 1;

  const coverSlide = pptx.addSlide();
  addBackground(coverSlide, theme);
  if (layoutHints.has('cover_right_panel')) {
    coverSlide.addShape(SHAPE.rect, {
      x: 9.8,
      y: 0,
      w: 3.53,
      h: 7.5,
      fill: { color: theme.accent },
      line: { color: theme.accent }
    });
  }
  addTitle(coverSlide, cover.title || '教学课件', theme);
  addSubtitle(coverSlide, (cover.bullets || []).filter(Boolean).join(' · ') || '', theme);
  addFooter(coverSlide, theme, slideIndex++, totalSlides, SHAPE);

  if (toc) {
    const tocSlide = pptx.addSlide();
    addBackground(tocSlide, theme);
    addTopBar(tocSlide, theme, SHAPE);
    addTitle(tocSlide, toc.title || '目录', theme);
    addBullets(tocSlide, toc.bullets || [], theme, { x: 1.0, y: 1.8, w: 11.5 });
    addFooter(tocSlide, theme, slideIndex++, totalSlides, SHAPE);
  }

  contentSlides.forEach((content) => {
    const slide = pptx.addSlide();
    addBackground(slide, theme);
    addTopBar(slide, theme, SHAPE);
    addTitle(slide, content.title || '内容', theme);
    const bullets = content.bullets || [];
    if (layoutHints.has('content_two_column')) {
      addBullets(slide, bullets, theme, { x: 0.9, y: 1.6, w: 7.0, h: 4.8 });
      addInfoCard(slide, theme, content, SHAPE);
    } else {
      addBullets(slide, bullets, theme);
    }
    if (content.notes && slide.addNotes) {
      slide.addNotes(content.notes);
    }
    addFooter(slide, theme, slideIndex++, totalSlides, SHAPE);
  });

  if (summary) {
    const summarySlide = pptx.addSlide();
    addBackground(summarySlide, theme);
    addTopBar(summarySlide, theme, SHAPE);
    addTitle(summarySlide, summary.title || '总结', theme);
    const bullets = summary.bullets || [];
    if (layoutHints.has('summary_cards')) {
      const cardWidth = 3.9;
      const cardHeight = 3.8;
      const startX = 0.9;
      const startY = 1.7;
      const groups = [bullets.slice(0, 2), bullets.slice(2, 4), bullets.slice(4, 6)];
      groups.forEach((group, idx) => {
        const x = startX + idx * (cardWidth + 0.4);
        summarySlide.addShape(SHAPE.roundRect, {
          x,
          y: startY,
          w: cardWidth,
          h: cardHeight,
          fill: { color: 'FFFFFF' },
          line: { color: 'E2E8F0' },
          radius: 0.1
        });
        summarySlide.addText(`要点 ${idx + 1}`, {
          x: x + 0.2,
          y: startY + 0.2,
          w: cardWidth - 0.4,
          h: 0.3,
          fontSize: 12,
          bold: true,
          fontFace: theme.font,
          color: theme.primary
        });
        summarySlide.addText(group.length ? group.map((item) => `• ${item}`).join('\n') : '补充总结内容', {
          x: x + 0.2,
          y: startY + 0.7,
          w: cardWidth - 0.4,
          h: cardHeight - 0.9,
          fontSize: 12,
          fontFace: theme.font,
          color: theme.text,
          valign: 'top'
        });
      });
    } else {
      addBullets(summarySlide, bullets, theme, { x: 1.0, y: 1.8, w: 11.5 });
    }
    addFooter(summarySlide, theme, slideIndex++, totalSlides, SHAPE);
  }

  return pptx;
}

async function exportPptx(draft, fileNamePrefix = 'lesson', options = {}) {
  const normalized = normalizeDraft(draft);
  if (!normalized) return null;

  ensureExportDir();
  const fileName = `${fileNamePrefix}-${Date.now()}.pptx`;
  const filePath = path.join(EXPORT_DIR, fileName);

  if (options.scene) {
    const pptx = buildEditablePptx(normalized, options);
    await pptx.writeFile({ fileName: filePath });
    return { fileName, filePath };
  }

  const useTemplate = options.useTemplate !== false;
  if (useTemplate) {
    try {
      await buildPptxWithTemplate(normalized, fileName, options);
      return { fileName, filePath };
    } catch (error) {
      // fallback to generated slides
    }
  }
  const pptx = buildPptx(normalized, options);
  await pptx.writeFile({ fileName: filePath });
  return { fileName, filePath };
}

module.exports = {
  exportPptx,
  EXPORT_DIR
};
