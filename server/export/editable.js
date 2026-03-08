const PptxGenJS = require('pptxgenjs');
const { buildPptSceneFromDraft, normalizeScene } = require('../ppt/scene');
const { resolveDesignPreset } = require('../ppt/design');

const SLIDE_WIDTH = 13.33;
const SLIDE_HEIGHT = 7.5;

const SOFT_SURFACES = {
  corporate: 'EFF6FF',
  editorial: 'FEF3C7',
  classroom: 'D1FAE5'
};

function normalizeColor(color, fallback) {
  if (!color) return fallback;
  return String(color).replace('#', '').toUpperCase();
}

function getTheme(scene, draft) {
  const raw = scene?.theme || draft?.theme || {};
  return {
    primary: normalizeColor(raw.primary, '1F3B73'),
    accent: normalizeColor(raw.accent, '4C8BF5'),
    background: normalizeColor(raw.background, 'F8FAFC'),
    text: normalizeColor(raw.text, '0F172A'),
    font: raw.font || 'Microsoft YaHei'
  };
}

function findBlock(sceneSlide, type) {
  return (sceneSlide?.blocks || []).find((block) => block?.type === type) || null;
}

function sortBlocks(blocks = []) {
  const order = {
    title: 1,
    subtitle: 2,
    bullets: 3,
    factCards: 4,
    steps: 5,
    columns: 6,
    taskCards: 7,
    summaryCards: 8,
    callout: 9,
    question: 10
  };
  return [...blocks].sort((left, right) => (order[left.type] || 99) - (order[right.type] || 99));
}

function expandBox(box, dx, dy) {
  return {
    x: Math.max(0.2, box.x - dx),
    y: Math.max(0.2, box.y - dy),
    w: Math.min(SLIDE_WIDTH - 0.4, box.w + dx * 2),
    h: Math.min(SLIDE_HEIGHT - 0.4, box.h + dy * 2)
  };
}

function addPanel(slide, box, SHAPE, options = {}) {
  slide.addShape(options.shape || SHAPE.roundRect, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fill: { color: options.fill || 'FFFFFF', transparency: options.transparency ?? 0 },
    line: { color: options.stroke || options.fill || 'E2E8F0', width: options.lineWidth ?? 1 },
    radius: options.radius ?? 0.12
  });
}

function addCircle(slide, x, y, size, fill, SHAPE, transparency = 0) {
  slide.addShape(SHAPE.ellipse, {
    x,
    y,
    w: size,
    h: size,
    fill: { color: fill, transparency },
    line: { color: fill, transparency }
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
    fit: options.fit || 'shrink'
  });
}

function addBullets(slide, items, box, theme, options = {}) {
  if (!Array.isArray(items) || items.length === 0) return;
  addText(slide, items.map((item) => `• ${item}`).join('\n'), box, theme, {
    fontSize: options.fontSize || 16,
    color: options.color || theme.text
  });
}

function addCalloutText(slide, block, theme, options = {}) {
  if (!block?.box) return;
  const x = block.box.x + 0.18;
  addText(slide, block.title || options.fallbackTitle || '提示', {
    x,
    y: block.box.y + 0.14,
    w: Math.max(block.box.w - 0.36, 0.2),
    h: 0.24
  }, theme, { fontSize: 12, bold: true, color: options.titleColor || theme.primary });
  addText(slide, block.text || '', {
    x,
    y: block.box.y + 0.46,
    w: Math.max(block.box.w - 0.36, 0.2),
    h: Math.max(block.box.h - 0.56, 0.3)
  }, theme, { fontSize: 11, color: options.bodyColor || theme.text });
}

function addSummaryCards(slide, block, theme, designPreset, SHAPE) {
  if (!block?.box || !Array.isArray(block.items) || block.items.length === 0) return;
  const groups = [block.items.slice(0, 2), block.items.slice(2, 4), block.items.slice(4, 6)];
  const gap = designPreset === 'editorial' ? 0.24 : 0.28;
  const cardWidth = (block.box.w - gap * 2) / 3;
  const cardFill = designPreset === 'editorial' ? 'FFFDF8' : 'FFFFFF';
  const stripeFill = designPreset === 'classroom' ? theme.accent : theme.primary;

  groups.forEach((group, index) => {
    const x = block.box.x + index * (cardWidth + gap);
    addPanel(slide, { x, y: block.box.y, w: cardWidth, h: block.box.h }, SHAPE, {
      fill: cardFill,
      stroke: designPreset === 'editorial' ? theme.accent : 'E2E8F0',
      radius: designPreset === 'editorial' ? 0.08 : 0.16
    });
    slide.addShape(SHAPE.rect, {
      x,
      y: block.box.y,
      w: cardWidth,
      h: 0.16,
      fill: { color: stripeFill },
      line: { color: stripeFill }
    });
    addText(slide, `要点 ${index + 1}`, {
      x: x + 0.18,
      y: block.box.y + 0.2,
      w: Math.max(cardWidth - 0.36, 0.2),
      h: 0.22
    }, theme, { fontSize: 12, bold: true, color: theme.primary });
    addBullets(slide, group.length ? group : ['补充总结内容'], {
      x: x + 0.18,
      y: block.box.y + 0.58,
      w: Math.max(cardWidth - 0.36, 0.2),
      h: Math.max(block.box.h - 0.76, 0.3)
    }, theme, { fontSize: 11 });
  });
}

function addFactCards(slide, block, theme, designPreset, SHAPE) {
  if (!block?.box || !Array.isArray(block.items) || !block.items.length) return;
  const columns = Math.min(block.items.length, 3);
  const rows = Math.ceil(block.items.length / columns);
  const gapX = 0.24;
  const gapY = 0.22;
  const cardWidth = (block.box.w - gapX * (columns - 1)) / columns;
  const cardHeight = (block.box.h - gapY * (rows - 1)) / rows;

  block.items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = block.box.x + col * (cardWidth + gapX);
    const y = block.box.y + row * (cardHeight + gapY);
    addPanel(slide, { x, y, w: cardWidth, h: cardHeight }, SHAPE, {
      fill: designPreset === 'editorial' ? 'FFFDF8' : 'FFFFFF',
      stroke: designPreset === 'classroom' ? theme.primary : theme.accent,
      radius: designPreset === 'editorial' ? 0.08 : 0.18
    });
    addText(slide, item, {
      x: x + 0.18,
      y: y + 0.18,
      w: Math.max(cardWidth - 0.36, 0.2),
      h: Math.max(cardHeight - 0.36, 0.3)
    }, theme, { fontSize: 13, color: theme.text });
  });
}

function addSteps(slide, block, theme, designPreset, SHAPE) {
  if (!block?.box || !Array.isArray(block.items) || !block.items.length) return;
  const count = block.items.length;
  const startX = block.box.x + 0.35;
  const cardX = block.box.x + 0.95;
  const availableH = block.box.h;
  const stepHeight = Math.min(0.82, (availableH - (count - 1) * 0.18) / count);

  slide.addShape(SHAPE.line, {
    x: startX + 0.12,
    y: block.box.y + 0.36,
    w: 0,
    h: Math.max(0.3, availableH - 0.72),
    line: { color: theme.accent, width: 2 }
  });

  block.items.forEach((item, index) => {
    const y = block.box.y + index * (stepHeight + 0.18);
    addCircle(slide, startX, y + 0.06, 0.32, theme.accent, SHAPE, 0);
    addText(slide, String(index + 1), {
      x: startX,
      y: y + 0.1,
      w: 0.32,
      h: 0.18
    }, theme, { fontSize: 10, bold: true, color: 'FFFFFF', align: 'center', valign: 'mid' });
    addPanel(slide, { x: cardX, y, w: block.box.w - 1.15, h: stepHeight }, SHAPE, {
      fill: designPreset === 'editorial' ? 'FFFDF8' : 'FFFFFF',
      stroke: designPreset === 'editorial' ? theme.primary : theme.accent,
      radius: designPreset === 'editorial' ? 0.08 : 0.14
    });
    addText(slide, item, {
      x: cardX + 0.18,
      y: y + 0.14,
      w: Math.max(block.box.w - 1.51, 0.3),
      h: Math.max(stepHeight - 0.22, 0.2)
    }, theme, { fontSize: 13 });
  });
}

function addColumns(slide, block, theme, designPreset, SHAPE) {
  if (!block?.box || !Array.isArray(block.items) || !block.items.length) return;
  const count = Math.min(block.items.length, 3);
  const gap = 0.24;
  const columnWidth = (block.box.w - gap * (count - 1)) / count;

  block.items.slice(0, 3).forEach((item, index) => {
    const x = block.box.x + index * (columnWidth + gap);
    addPanel(slide, { x, y: block.box.y, w: columnWidth, h: block.box.h }, SHAPE, {
      fill: index === 1 && designPreset === 'classroom' ? 'FFEDD5' : (designPreset === 'editorial' ? 'FFFDF8' : 'FFFFFF'),
      stroke: designPreset === 'editorial' ? theme.primary : theme.accent,
      radius: designPreset === 'editorial' ? 0.08 : 0.16
    });
    addText(slide, item, {
      x: x + 0.18,
      y: block.box.y + 0.22,
      w: Math.max(columnWidth - 0.36, 0.3),
      h: Math.max(block.box.h - 0.4, 0.4)
    }, theme, { fontSize: 13 });
  });
}

function addTaskCards(slide, block, theme, designPreset, SHAPE) {
  if (!block?.box || !Array.isArray(block.items) || !block.items.length) return;
  const columns = Math.min(block.items.length, 2);
  const rows = Math.ceil(block.items.length / columns);
  const gapX = 0.26;
  const gapY = 0.22;
  const cardWidth = (block.box.w - gapX * (columns - 1)) / columns;
  const cardHeight = (block.box.h - gapY * (rows - 1)) / rows;
  const fills = designPreset === 'editorial'
    ? ['FFFDF8', 'FFF7ED', 'FEF3C7', 'FFFFFF']
    : ['FFFFFF', 'FFEDD5', SOFT_SURFACES.classroom, 'FFFFFF'];

  block.items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = block.box.x + col * (cardWidth + gapX);
    const y = block.box.y + row * (cardHeight + gapY);
    addPanel(slide, { x, y, w: cardWidth, h: cardHeight }, SHAPE, {
      fill: fills[index % fills.length],
      stroke: theme.accent,
      radius: 0.2
    });
    addText(slide, `任务 ${index + 1}`, {
      x: x + 0.18,
      y: y + 0.14,
      w: Math.max(cardWidth - 0.36, 0.2),
      h: 0.22
    }, theme, { fontSize: 12, bold: true, color: theme.primary });
    addText(slide, item, {
      x: x + 0.18,
      y: y + 0.46,
      w: Math.max(cardWidth - 0.36, 0.2),
      h: Math.max(cardHeight - 0.58, 0.3)
    }, theme, { fontSize: 12 });
  });
}

function addFooter(slide, theme, index, total, SHAPE) {
  slide.addShape(SHAPE.line, {
    x: 0.6,
    y: 7.08,
    w: 12.1,
    h: 0,
    line: { color: 'E5E7EB', width: 1 }
  });
  slide.addText(`AI-Educate · ${index}/${total}`, {
    x: 0.7,
    y: 7.14,
    w: 12.0,
    h: 0.28,
    fontSize: 10,
    fontFace: theme.font,
    color: '64748B',
    align: 'right'
  });
}

function decorateCorporate(slide, sceneSlide, theme, SHAPE) {
  slide.background = { color: theme.background };
  slide.addShape(SHAPE.rect, {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH,
    h: 0.18,
    fill: { color: theme.primary },
    line: { color: theme.primary }
  });

  if (sceneSlide.role === 'cover') {
    slide.addShape(SHAPE.rect, {
      x: 9.75,
      y: 0,
      w: 3.58,
      h: SLIDE_HEIGHT,
      fill: { color: theme.accent },
      line: { color: theme.accent }
    });
    addCircle(slide, 10.4, 0.9, 1.7, 'FFFFFF', SHAPE, 22);
    addCircle(slide, 11.2, 3.0, 0.9, theme.primary, SHAPE, 15);
    return;
  }

  const bulletsBlock = findBlock(sceneSlide, 'bullets');
  const calloutBlock = findBlock(sceneSlide, 'callout');
  const questionBlock = findBlock(sceneSlide, 'question');
  const summaryBlock = findBlock(sceneSlide, 'summaryCards');

  if (sceneSlide.role === 'toc' && bulletsBlock?.box) {
    addPanel(slide, expandBox(bulletsBlock.box, 0.16, 0.18), SHAPE, {
      fill: 'FFFFFF',
      stroke: 'E2E8F0',
      radius: 0.12
    });
    slide.addShape(SHAPE.rect, {
      x: 0.76,
      y: 1.62,
      w: 0.1,
      h: 4.8,
      fill: { color: theme.accent },
      line: { color: theme.accent }
    });
    return;
  }

  if (sceneSlide.role === 'summary' && summaryBlock?.box) {
    addSummaryCards(slide, summaryBlock, theme, 'corporate', SHAPE);
    if (calloutBlock?.box) {
      addPanel(slide, calloutBlock.box, SHAPE, {
        fill: SOFT_SURFACES.corporate,
        stroke: theme.accent,
        radius: 0.12
      });
    }
    return;
  }

  if (bulletsBlock?.box) {
    addPanel(slide, expandBox(bulletsBlock.box, 0.16, 0.18), SHAPE, {
      fill: 'FFFFFF',
      stroke: theme.accent,
      radius: 0.16
    });
  }
  if (calloutBlock?.box) {
    addPanel(slide, calloutBlock.box, SHAPE, {
      fill: SOFT_SURFACES.corporate,
      stroke: theme.accent,
      radius: 0.12
    });
  }
  if (questionBlock?.box) {
    addPanel(slide, questionBlock.box, SHAPE, {
      fill: 'F8FBFF',
      stroke: theme.primary,
      radius: 0.12
    });
  }
}

function decorateEditorial(slide, sceneSlide, theme, SHAPE) {
  slide.background = { color: theme.background };
  slide.addShape(SHAPE.line, {
    x: 0.9,
    y: 0.42,
    w: 11.2,
    h: 0,
    line: { color: theme.primary, width: 1.5 }
  });
  slide.addShape(SHAPE.rect, {
    x: 0.9,
    y: 0.52,
    w: 0.9,
    h: 0.08,
    fill: { color: theme.accent },
    line: { color: theme.accent }
  });

  const bulletsBlock = findBlock(sceneSlide, 'bullets');
  const calloutBlock = findBlock(sceneSlide, 'callout');
  const questionBlock = findBlock(sceneSlide, 'question');
  const summaryBlock = findBlock(sceneSlide, 'summaryCards');

  if (sceneSlide.role === 'cover') {
    slide.addShape(SHAPE.rect, {
      x: 0.72,
      y: 0.75,
      w: 0.1,
      h: 4.9,
      fill: { color: theme.accent },
      line: { color: theme.accent }
    });
    slide.addShape(SHAPE.line, {
      x: 0.95,
      y: 6.05,
      w: 4.5,
      h: 0,
      line: { color: theme.primary, width: 2 }
    });
    return;
  }

  if (sceneSlide.role === 'summary' && summaryBlock?.box) {
    addSummaryCards(slide, summaryBlock, theme, 'editorial', SHAPE);
    if (calloutBlock?.box) {
      slide.addShape(SHAPE.line, {
        x: calloutBlock.box.x,
        y: calloutBlock.box.y,
        w: calloutBlock.box.w,
        h: 0,
        line: { color: theme.accent, width: 1.5 }
      });
    }
    return;
  }

  if (bulletsBlock?.box) {
    addPanel(slide, expandBox(bulletsBlock.box, 0.12, 0.14), SHAPE, {
      fill: 'FFFDF8',
      stroke: theme.primary,
      radius: 0.06
    });
  }
  if (questionBlock?.box) {
    addPanel(slide, questionBlock.box, SHAPE, {
      fill: 'FFFFFF',
      stroke: theme.accent,
      radius: 0.06
    });
    slide.addShape(SHAPE.rect, {
      x: questionBlock.box.x,
      y: questionBlock.box.y,
      w: questionBlock.box.w,
      h: 0.12,
      fill: { color: theme.accent },
      line: { color: theme.accent }
    });
  }
  if (calloutBlock?.box) {
    slide.addShape(SHAPE.line, {
      x: calloutBlock.box.x,
      y: calloutBlock.box.y + 0.08,
      w: calloutBlock.box.w,
      h: 0,
      line: { color: theme.primary, width: 1.25 }
    });
  }
}

function decorateClassroom(slide, sceneSlide, theme, SHAPE) {
  slide.background = { color: theme.background };
  addCircle(slide, 10.9, 0.7, 1.3, theme.accent, SHAPE, 30);
  addCircle(slide, 11.55, 1.35, 0.8, theme.primary, SHAPE, 20);
  addCircle(slide, 0.45, 5.9, 1.1, theme.accent, SHAPE, 35);

  const bulletsBlock = findBlock(sceneSlide, 'bullets');
  const calloutBlock = findBlock(sceneSlide, 'callout');
  const questionBlock = findBlock(sceneSlide, 'question');
  const summaryBlock = findBlock(sceneSlide, 'summaryCards');

  if (sceneSlide.role === 'cover') {
    addPanel(slide, { x: 7.55, y: 1.55, w: 4.7, h: 2.55 }, SHAPE, {
      fill: 'FFFFFF',
      stroke: theme.accent,
      radius: 0.2
    });
    return;
  }

  if (sceneSlide.role === 'summary' && summaryBlock?.box) {
    addSummaryCards(slide, summaryBlock, theme, 'classroom', SHAPE);
    if (calloutBlock?.box) {
      addPanel(slide, calloutBlock.box, SHAPE, {
        fill: SOFT_SURFACES.classroom,
        stroke: theme.primary,
        radius: 0.18
      });
    }
    return;
  }

  if (bulletsBlock?.box) {
    addPanel(slide, expandBox(bulletsBlock.box, 0.16, 0.16), SHAPE, {
      fill: 'FFFFFF',
      stroke: theme.primary,
      radius: 0.22
    });
  }
  if (calloutBlock?.box) {
    addPanel(slide, calloutBlock.box, SHAPE, {
      fill: SOFT_SURFACES.classroom,
      stroke: theme.accent,
      radius: 0.18
    });
  }
  if (questionBlock?.box) {
    addPanel(slide, questionBlock.box, SHAPE, {
      fill: 'FFEDD5',
      stroke: theme.accent,
      radius: 0.18
    });
  }
}

function decorateSceneSlide(slide, sceneSlide, theme, designPreset, SHAPE) {
  if (designPreset === 'editorial') {
    decorateEditorial(slide, sceneSlide, theme, SHAPE);
    return;
  }
  if (designPreset === 'classroom') {
    decorateClassroom(slide, sceneSlide, theme, SHAPE);
    return;
  }
  decorateCorporate(slide, sceneSlide, theme, SHAPE);
}

function renderEditableSceneSlide(slide, sceneSlide, theme, designPreset, index, total, SHAPE) {
  decorateSceneSlide(slide, sceneSlide, theme, designPreset, SHAPE);

  sortBlocks(sceneSlide.blocks || []).forEach((block) => {
    if (block.type === 'title') {
      addText(slide, block.text, block.box, theme, {
        fontSize: sceneSlide.role === 'cover' ? 30 : 26,
        bold: true,
        color: theme.text
      });
      return;
    }

    if (block.type === 'subtitle') {
      addText(slide, block.text, block.box, theme, {
        fontSize: 16,
        color: designPreset === 'editorial' ? theme.primary : '475569'
      });
      return;
    }

    if (block.type === 'bullets') {
      addBullets(slide, block.items, block.box, theme, {
        fontSize: sceneSlide.role === 'toc' ? 16 : 15
      });
      return;
    }

    if (block.type === 'factCards') {
      addFactCards(slide, block, theme, designPreset, SHAPE);
      return;
    }

    if (block.type === 'steps') {
      addSteps(slide, block, theme, designPreset, SHAPE);
      return;
    }

    if (block.type === 'columns') {
      addColumns(slide, block, theme, designPreset, SHAPE);
      return;
    }

    if (block.type === 'taskCards') {
      addTaskCards(slide, block, theme, designPreset, SHAPE);
      return;
    }

    if (block.type === 'summaryCards') {
      addSummaryCards(slide, block, theme, designPreset, SHAPE);
      return;
    }

    if (block.type === 'callout') {
      addCalloutText(slide, block, theme, { fallbackTitle: '补充说明' });
      return;
    }

    if (block.type === 'question') {
      const useWhiteText = designPreset === 'classroom' && sceneSlide.variant === 'activity';
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

function buildEditablePptx(draft, options = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'AI-Educate';
  pptx.company = 'AI-Educate';
  pptx.subject = 'Teaching Slides';
  pptx.title = 'Teaching Deck';

  const scene = getEffectiveScene(draft, options);
  const theme = getTheme(scene, draft);
  const designPreset = resolveDesignPreset(scene?.designPreset || draft?.designPreset);
  pptx.theme = {
    headFontFace: theme.font,
    bodyFontFace: theme.font,
    lang: 'zh-CN'
  };

  const slides = Array.isArray(scene?.slides) ? scene.slides : [];
  const SHAPE = pptx.ShapeType || PptxGenJS.ShapeType;
  slides.forEach((sceneSlide, index) => {
    const slide = pptx.addSlide();
    renderEditableSceneSlide(slide, sceneSlide, theme, designPreset, index + 1, slides.length, SHAPE);
  });

  return pptx;
}

module.exports = {
  buildEditablePptx
};
