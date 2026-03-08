const PptxGenJS = require('pptxgenjs');
const { buildPptSceneFromDraft, normalizeScene } = require('../ppt/scene');

const DEFAULT_THEME = {
  primary: '1F3B73',
  accent: '4C8BF5',
  background: 'F8FAFC',
  text: '0F172A',
  muted: '475569',
  font: 'Microsoft YaHei'
};

const SLIDE_WIDTH = 13.33;
const SLIDE_HEIGHT = 7.5;
const PX_PER_INCH = 96;

function normalizeColor(color, fallback) {
  if (!color) return fallback;
  return String(color).replace('#', '').toUpperCase();
}

function getTheme(scene, draft) {
  const raw = scene?.theme || draft?.theme || {};
  return {
    primary: normalizeColor(raw.primary, DEFAULT_THEME.primary),
    accent: normalizeColor(raw.accent, DEFAULT_THEME.accent),
    background: normalizeColor(raw.background, DEFAULT_THEME.background),
    text: normalizeColor(raw.text, DEFAULT_THEME.text),
    muted: normalizeColor(raw.muted, DEFAULT_THEME.muted),
    font: raw.font || DEFAULT_THEME.font
  };
}

function withHash(color) {
  return `#${normalizeColor(color, DEFAULT_THEME.text)}`;
}

function toPx(value) {
  return Math.round(Number(value || 0) * PX_PER_INCH * 100) / 100;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function svgDataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function expandBox(box, dx, dy) {
  const x = Math.max(0, box.x - dx);
  const y = Math.max(0, box.y - dy);
  const maxWidth = SLIDE_WIDTH * PX_PER_INCH;
  const maxHeight = SLIDE_HEIGHT * PX_PER_INCH;
  return {
    x,
    y,
    w: Math.min(maxWidth - x, box.w + dx * 2),
    h: Math.min(maxHeight - y, box.h + dy * 2)
  };
}

function pxBox(box, fallback) {
  const base = box || fallback || { x: 0.9, y: 1.8, w: 7.0, h: 4.8 };
  return {
    x: toPx(base.x),
    y: toPx(base.y),
    w: toPx(base.w),
    h: toPx(base.h)
  };
}

function panelSvg(box, { fill, stroke, opacity = 1, radius = 22, strokeWidth = 2 }) {
  return `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${radius}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-opacity="${Math.min(opacity + 0.08, 1)}" stroke-width="${strokeWidth}" />`;
}

function circleSvg(cx, cy, r, fill, opacity) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="${opacity}" />`;
}

function lineSvg(x1, y1, x2, y2, stroke, opacity = 1, width = 3) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="${width}" stroke-linecap="round" />`;
}

function findBlock(sceneSlide, type) {
  return (sceneSlide?.blocks || []).find((block) => block?.type === type) || null;
}

function sortBlocks(blocks = []) {
  const order = {
    title: 1,
    subtitle: 2,
    bullets: 3,
    summaryCards: 4,
    callout: 5,
    question: 6
  };
  return [...blocks].sort((left, right) => (order[left.type] || 99) - (order[right.type] || 99));
}

function buildCommonDecorations(theme) {
  const primary = withHash(theme.primary);
  const accent = withHash(theme.accent);
  return [
    `<rect x="0" y="0" width="1280" height="18" fill="${primary}" />`,
    circleSvg(1120, 96, 150, accent, 0.16),
    circleSvg(1180, 164, 82, primary, 0.08),
    circleSvg(92, 646, 120, accent, 0.06)
  ];
}

function buildContentPanels(sceneSlide, theme) {
  const accent = withHash(theme.accent);
  const primary = withHash(theme.primary);
  const bulletsBox = pxBox(findBlock(sceneSlide, 'bullets')?.box, { x: 0.9, y: 1.8, w: 7.0, h: 4.8 });
  const calloutBox = findBlock(sceneSlide, 'callout')?.box ? pxBox(findBlock(sceneSlide, 'callout').box) : null;
  const questionBox = findBlock(sceneSlide, 'question')?.box ? pxBox(findBlock(sceneSlide, 'question').box) : null;
  const panels = [];

  panels.push(panelSvg(expandBox(bulletsBox, 26, 28), {
    fill: '#FFFFFF',
    stroke: accent,
    opacity: 0.95,
    radius: 26,
    strokeWidth: 1.5
  }));

  if (calloutBox) {
    const fill = sceneSlide.variant === 'case' ? '#F8FBFF' : '#FFFFFF';
    panels.push(panelSvg(calloutBox, {
      fill,
      stroke: accent,
      opacity: 0.94,
      radius: 22,
      strokeWidth: 1.5
    }));
    if (sceneSlide.variant === 'case') {
      panels.push(`<rect x="${calloutBox.x}" y="${calloutBox.y}" width="${calloutBox.w}" height="18" rx="22" fill="${accent}" fill-opacity="0.9" />`);
    }
  }

  if (questionBox) {
    if (sceneSlide.variant === 'activity') {
      panels.push(panelSvg(questionBox, {
        fill: 'url(#accentGradient)',
        stroke: primary,
        opacity: 1,
        radius: 22,
        strokeWidth: 0
      }));
    } else {
      panels.push(panelSvg(questionBox, {
        fill: '#F7FAFF',
        stroke: accent,
        opacity: 0.96,
        radius: 22,
        strokeWidth: 1.5
      }));
    }
  }

  if (!calloutBox && !questionBox) {
    panels.push(panelSvg({ x: 820, y: 148, w: 350, h: 340 }, {
      fill: '#F8FBFF',
      stroke: accent,
      opacity: 0.9,
      radius: 24,
      strokeWidth: 1.5
    }));
  }

  if (sceneSlide.variant === 'process') {
    const startX = 1000;
    const ys = [210, 320, 430];
    panels.push(lineSvg(startX, ys[0], startX, ys[2], accent, 0.45, 4));
    ys.forEach((y, index) => {
      panels.push(circleSvg(startX, y, 24, accent, 0.92));
      panels.push(`<text x="${startX}" y="${y + 7}" font-size="16" font-weight="700" text-anchor="middle" fill="#FFFFFF">${index + 1}</text>`);
    });
  }

  if (sceneSlide.variant === 'activity') {
    panels.push(circleSvg(1110, 560, 96, accent, 0.12));
    panels.push(circleSvg(1000, 610, 58, primary, 0.08));
  }

  return panels;
}

function buildHybridBackdrop(sceneSlide, theme) {
  const primary = withHash(theme.primary);
  const accent = withHash(theme.accent);
  const backgroundColor = withHash(sceneSlide?.background?.color || theme.background);
  const role = sceneSlide?.role || 'content';
  const calloutBlock = findBlock(sceneSlide, 'callout');
  const summaryBlock = findBlock(sceneSlide, 'summaryCards');
  const bulletsBlock = findBlock(sceneSlide, 'bullets');

  const parts = [
    `<rect x="0" y="0" width="1280" height="720" fill="${backgroundColor}" />`,
    ...buildCommonDecorations(theme)
  ];

  if (role === 'cover') {
    parts.push(`<rect x="960" y="0" width="320" height="720" fill="url(#accentGradient)" />`);
    parts.push(circleSvg(1120, 116, 158, '#FFFFFF', 0.16));
    if (calloutBlock?.box) {
      parts.push(panelSvg(pxBox(calloutBlock.box), {
        fill: '#FFFFFF',
        stroke: accent,
        opacity: 0.94,
        radius: 22,
        strokeWidth: 1.5
      }));
    }
  } else if (role === 'toc') {
    const bulletsBox = pxBox(bulletsBlock?.box, { x: 1.0, y: 1.8, w: 11.2, h: 4.8 });
    parts.push(panelSvg(expandBox(bulletsBox, 18, 22), {
      fill: '#FFFFFF',
      stroke: accent,
      opacity: 0.95,
      radius: 24,
      strokeWidth: 1.5
    }));
    parts.push(`<rect x="76" y="148" width="12" height="420" rx="6" fill="${accent}" fill-opacity="0.82" />`);
  } else if (role === 'summary') {
    const summaryBox = pxBox(summaryBlock?.box, { x: 0.9, y: 1.8, w: 11.4, h: 3.9 });
    const gap = 26;
    const cardWidth = (summaryBox.w - gap * 2) / 3;
    for (let index = 0; index < 3; index += 1) {
      const x = summaryBox.x + index * (cardWidth + gap);
      parts.push(panelSvg({ x, y: summaryBox.y, w: cardWidth, h: summaryBox.h }, {
        fill: '#FFFFFF',
        stroke: accent,
        opacity: 0.95,
        radius: 22,
        strokeWidth: 1.5
      }));
      parts.push(`<rect x="${x}" y="${summaryBox.y}" width="${cardWidth}" height="14" rx="22" fill="${accent}" fill-opacity="0.82" />`);
    }
    if (calloutBlock?.box) {
      parts.push(panelSvg(pxBox(calloutBlock.box), {
        fill: '#EFF6FF',
        stroke: accent,
        opacity: 0.98,
        radius: 22,
        strokeWidth: 1.5
      }));
    }
  } else {
    parts.push(...buildContentPanels(sceneSlide, theme));
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${escapeXml(accent)}" stop-opacity="0.96" />
      <stop offset="100%" stop-color="${escapeXml(primary)}" stop-opacity="0.96" />
    </linearGradient>
  </defs>
  ${parts.join('')}
</svg>`;
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

function addText(slide, text, box, theme, options = {}) {
  if (!text) return;
  slide.addText(text, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: theme.font,
    color: options.color || theme.text,
    fontSize: options.fontSize || 18,
    bold: options.bold || false,
    margin: options.margin ?? 0,
    valign: options.valign || 'top',
    align: options.align,
    breakLine: false,
    fit: options.fit || 'shrink'
  });
}

function addBullets(slide, items, box, theme, options = {}) {
  if (!Array.isArray(items) || items.length === 0) return;
  addText(slide, items.map((item) => `• ${item}`).join('\n'), box, theme, {
    fontSize: options.fontSize || (items.length > 5 ? 15 : 17),
    color: options.color || theme.text,
    margin: 0
  });
}

function addCalloutText(slide, block, theme, options = {}) {
  if (!block?.box) return;
  const titleColor = options.titleColor || theme.primary;
  const bodyColor = options.bodyColor || theme.text;
  const x = block.box.x + 0.15;
  addText(slide, block.title || options.fallbackTitle || '提示', {
    x,
    y: block.box.y + 0.12,
    w: Math.max(block.box.w - 0.3, 0.2),
    h: 0.26
  }, theme, { fontSize: 12, bold: true, color: titleColor });
  addText(slide, block.text || '', {
    x,
    y: block.box.y + 0.48,
    w: Math.max(block.box.w - 0.3, 0.2),
    h: Math.max(block.box.h - 0.58, 0.3)
  }, theme, { fontSize: 11, color: bodyColor });
}

function addSummaryCards(slide, block, theme) {
  if (!block?.box || !Array.isArray(block.items) || block.items.length === 0) return;
  const groups = [block.items.slice(0, 2), block.items.slice(2, 4), block.items.slice(4, 6)];
  const gap = 0.28;
  const cardWidth = (block.box.w - gap * 2) / 3;

  groups.forEach((group, index) => {
    const x = block.box.x + index * (cardWidth + gap) + 0.16;
    addText(slide, `要点 ${index + 1}`, {
      x,
      y: block.box.y + 0.14,
      w: Math.max(cardWidth - 0.32, 0.2),
      h: 0.24
    }, theme, { fontSize: 12, bold: true, color: theme.primary });
    addBullets(slide, group.length ? group : ['补充总结内容'], {
      x,
      y: block.box.y + 0.54,
      w: Math.max(cardWidth - 0.32, 0.2),
      h: Math.max(block.box.h - 0.72, 0.3)
    }, theme, { fontSize: 11 });
  });
}

function renderHybridSceneSlide(slide, sceneSlide, theme, index, total, SHAPE) {
  slide.background = { color: theme.background };
  slide.addImage({
    data: svgDataUri(buildHybridBackdrop(sceneSlide, theme)),
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: SLIDE_HEIGHT,
    altText: `${sceneSlide.title || 'slide'}-background`
  });

  sortBlocks(sceneSlide.blocks || []).forEach((block) => {
    if (block.type === 'title') {
      addText(slide, block.text, block.box, theme, {
        fontSize: sceneSlide.role === 'cover' ? 30 : 28,
        bold: true,
        color: theme.text
      });
      return;
    }

    if (block.type === 'subtitle') {
      addText(slide, block.text, block.box, theme, {
        fontSize: 16,
        color: theme.muted
      });
      return;
    }

    if (block.type === 'bullets') {
      addBullets(slide, block.items, block.box, theme, {
        fontSize: sceneSlide.role === 'toc' ? 16 : 17
      });
      return;
    }

    if (block.type === 'summaryCards') {
      addSummaryCards(slide, block, theme);
      return;
    }

    if (block.type === 'callout') {
      addCalloutText(slide, block, theme, {
        fallbackTitle: '补充说明'
      });
      return;
    }

    if (block.type === 'question') {
      const useWhiteText = sceneSlide.variant === 'activity';
      addCalloutText(slide, block, theme, {
        fallbackTitle: '互动提问',
        titleColor: useWhiteText ? 'FFFFFF' : theme.primary,
        bodyColor: useWhiteText ? 'FFFFFF' : theme.text
      });
    }
  });

  if (sceneSlide.notes && slide.addNotes) {
    slide.addNotes(sceneSlide.notes);
  }

  addFooter(slide, theme, index, total, SHAPE);
}

function getEffectiveScene(draft, options = {}) {
  return normalizeScene(options.scene, draft) || buildPptSceneFromDraft(draft);
}

function buildHybridPptx(draft, options = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'AI-Educate';
  pptx.company = 'AI-Educate';
  pptx.subject = 'Teaching Slides';
  pptx.title = 'Teaching Deck';

  const scene = getEffectiveScene(draft, options);
  const theme = getTheme(scene, draft);
  pptx.theme = {
    headFontFace: theme.font,
    bodyFontFace: theme.font,
    lang: 'zh-CN'
  };

  const slides = Array.isArray(scene?.slides) ? scene.slides : [];
  const SHAPE = pptx.ShapeType || PptxGenJS.ShapeType;
  slides.forEach((sceneSlide, index) => {
    const slide = pptx.addSlide();
    renderHybridSceneSlide(slide, sceneSlide, theme, index + 1, slides.length, SHAPE);
  });

  return pptx;
}

module.exports = {
  buildHybridPptx
};
