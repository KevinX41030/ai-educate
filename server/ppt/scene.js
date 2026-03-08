const { nanoid } = require('nanoid');

const DEFAULT_THEME = {
  primary: '#1F3B73',
  accent: '#4C8BF5',
  background: '#F8FAFC',
  text: '#0F172A',
  font: 'Microsoft YaHei'
};

const VALID_ROLES = new Set(['cover', 'toc', 'content', 'summary']);
const VALID_VARIANTS = new Set(['cover', 'toc', 'concept', 'process', 'case', 'activity', 'summary']);
const VALID_BLOCK_TYPES = new Set(['title', 'subtitle', 'bullets', 'callout', 'question', 'summaryCards']);

const BOX_PRESETS = {
  title: { x: 0.8, y: 0.5, w: 11.8, h: 0.9 },
  subtitle: { x: 0.8, y: 1.45, w: 11.2, h: 0.6 },
  bullets: { x: 0.9, y: 1.8, w: 7.0, h: 4.8 },
  callout: { x: 8.2, y: 1.8, w: 4.1, h: 1.8 },
  question: { x: 8.2, y: 3.9, w: 4.1, h: 1.3 },
  summaryCards: { x: 0.9, y: 1.8, w: 11.4, h: 3.9 }
};

function normalizeColor(color, fallback) {
  if (!color) return fallback;
  const normalized = String(color).trim();
  if (!normalized) return fallback;
  return normalized.startsWith('#') ? normalized.toUpperCase() : `#${normalized.toUpperCase()}`;
}

function normalizeTheme(theme = {}) {
  return {
    primary: normalizeColor(theme.primary, DEFAULT_THEME.primary),
    accent: normalizeColor(theme.accent, DEFAULT_THEME.accent),
    background: normalizeColor(theme.background, DEFAULT_THEME.background),
    text: normalizeColor(theme.text, DEFAULT_THEME.text),
    font: theme.font || DEFAULT_THEME.font
  };
}

function normalizeNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeBox(box, fallback) {
  const base = fallback || BOX_PRESETS.bullets;
  const raw = box && typeof box === 'object' ? box : {};
  return {
    x: normalizeNumber(raw.x, base.x),
    y: normalizeNumber(raw.y, base.y),
    w: normalizeNumber(raw.w, base.w),
    h: normalizeNumber(raw.h, base.h)
  };
}

function normalizeBackground(background, fallback, theme) {
  const base = fallback && typeof fallback === 'object'
    ? fallback
    : { type: 'solid', color: theme.background };
  const raw = background && typeof background === 'object' ? background : {};
  return {
    type: raw.type === 'image' ? 'image' : 'solid',
    color: normalizeColor(raw.color, base.color || theme.background),
    image: raw.image || base.image || ''
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function createBlock(type, data = {}, fallbackBox) {
  return {
    id: data.id || nanoid(),
    type,
    title: typeof data.title === 'string' ? data.title : '',
    text: typeof data.text === 'string' ? data.text : '',
    items: normalizeItems(data.items),
    box: normalizeBox(data.box, fallbackBox || BOX_PRESETS[type] || BOX_PRESETS.bullets)
  };
}

function inferVariant(slide) {
  const title = String(slide?.title || '');
  const bullets = Array.isArray(slide?.bullets) ? slide.bullets : [];
  const text = [title, ...bullets].join(' ');
  if (/(流程|步骤|过程|机制|路径|循环)/.test(text)) return 'process';
  if (/(案例|应用|实验|场景|实例|拓展|综合)/.test(text)) return 'case';
  if (/(练习|互动|讨论|小测|活动|任务|探究)/.test(text)) return 'activity';
  return 'concept';
}

function pickSummaryItems(draft, slide) {
  const base = normalizeItems(slide?.bullets);
  if (base.length) return base.slice(0, 6);

  const summary = [];
  if (Array.isArray(draft?.ppt)) {
    draft.ppt
      .filter((item) => item.type === 'content')
      .slice(0, 6)
      .forEach((item) => {
        if (item?.title) summary.push(item.title);
      });
  }
  return summary;
}

function buildBlocksForSlide(slide, draft) {
  const role = VALID_ROLES.has(slide?.type) ? slide.type : 'content';
  const variant = role === 'content' ? inferVariant(slide) : role;
  const bullets = normalizeItems(slide?.bullets);
  const blocks = [];

  blocks.push(createBlock('title', { text: slide?.title || '内容' }, BOX_PRESETS.title));

  if (role === 'cover') {
    const subtitle = bullets.join(' · ');
    if (subtitle) {
      blocks.push(createBlock('subtitle', { text: subtitle }, BOX_PRESETS.subtitle));
    }
    if (draft?.lessonPlan?.goals) {
      blocks.push(createBlock('callout', {
        title: '教学目标',
        text: draft.lessonPlan.goals
      }, BOX_PRESETS.callout));
    }
    return { blocks, variant };
  }

  if (role === 'toc') {
    blocks.push(createBlock('bullets', { items: bullets }, { x: 0.9, y: 1.8, w: 11.0, h: 4.8 }));
    return { blocks, variant };
  }

  if (role === 'summary') {
    blocks.push(createBlock('summaryCards', { items: pickSummaryItems(draft, slide) }, BOX_PRESETS.summaryCards));
    if (draft?.lessonPlan?.homework) {
      blocks.push(createBlock('callout', {
        title: '课后延伸',
        text: draft.lessonPlan.homework
      }, { x: 0.9, y: 5.1, w: 11.0, h: 1.2 }));
    }
    return { blocks, variant };
  }

  blocks.push(createBlock('bullets', { items: bullets }, BOX_PRESETS.bullets));

  if (variant === 'process' && Array.isArray(draft?.lessonPlan?.process) && draft.lessonPlan.process.length) {
    blocks.push(createBlock('callout', {
      title: '教学流程',
      text: draft.lessonPlan.process.slice(0, 3).join('；')
    }, BOX_PRESETS.callout));
  } else if (variant === 'case' && draft?.lessonPlan?.activities) {
    blocks.push(createBlock('callout', {
      title: '应用案例',
      text: draft.lessonPlan.activities
    }, BOX_PRESETS.callout));
  } else {
    blocks.push(createBlock('callout', {
      title: '课堂提示',
      text: bullets[1] || bullets[0] || '补充教学案例或误区提醒。'
    }, BOX_PRESETS.callout));
  }

  if (variant === 'activity' && draft?.interactionIdea?.description) {
    blocks.push(createBlock('question', {
      text: draft.interactionIdea.description
    }, BOX_PRESETS.question));
  } else if (draft?.interactionIdea?.title) {
    blocks.push(createBlock('question', {
      text: `互动建议：${draft.interactionIdea.title}`
    }, BOX_PRESETS.question));
  }

  return { blocks, variant };
}

function buildPptSceneFromDraft(draft) {
  if (!draft || !Array.isArray(draft.ppt) || draft.ppt.length === 0) return null;

  const theme = normalizeTheme(draft.theme || {});
  const slides = draft.ppt.map((slide) => {
    const role = VALID_ROLES.has(slide?.type) ? slide.type : 'content';
    const { blocks, variant } = buildBlocksForSlide(slide, draft);
    return {
      id: slide?.id || nanoid(),
      title: slide?.title || '内容',
      role,
      variant,
      background: { type: 'solid', color: theme.background },
      blocks,
      notes: slide?.notes || ''
    };
  });

  return {
    theme,
    layoutHints: Array.isArray(draft.layoutHints) ? draft.layoutHints : [],
    slides,
    updatedAt: new Date().toISOString()
  };
}

function getBlockByType(blocks, type) {
  return (Array.isArray(blocks) ? blocks : []).find((block) => block?.type === type) || null;
}

function getTitleFromBlocks(blocks, fallbackTitle = '内容') {
  const titleBlock = getBlockByType(blocks, 'title');
  return titleBlock?.text || fallbackTitle;
}

function normalizeBlocks(blocks, fallbackBlocks = []) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return fallbackBlocks.map((block) => createBlock(block.type, block, block.box));
  }

  const normalized = blocks
    .map((block, index) => {
      if (!VALID_BLOCK_TYPES.has(block?.type)) return null;
      const fallback = fallbackBlocks.find((item) => item.type === block.type) || fallbackBlocks[index];
      return createBlock(block.type, block, fallback?.box || BOX_PRESETS[block.type]);
    })
    .filter(Boolean);

  return normalized.length
    ? normalized
    : fallbackBlocks.map((block) => createBlock(block.type, block, block.box));
}

function normalizeScene(scene, draft) {
  const fallbackScene = buildPptSceneFromDraft(draft);
  if (!fallbackScene) return null;
  if (!scene || !Array.isArray(scene.slides) || scene.slides.length === 0) {
    return fallbackScene;
  }

  const theme = normalizeTheme({ ...fallbackScene.theme, ...(scene.theme || {}) });
  const slideCount = Math.max(scene.slides.length, fallbackScene.slides.length);

  const slides = Array.from({ length: slideCount }, (_, index) => {
    const slide = scene.slides[index] || fallbackScene.slides[index] || fallbackScene.slides[0];
    const fallbackSlide = fallbackScene.slides[index] || fallbackScene.slides.find((item) => item.role === slide?.role) || fallbackScene.slides[0];
    const role = VALID_ROLES.has(slide?.role) ? slide.role : fallbackSlide.role;
    const variant = VALID_VARIANTS.has(slide?.variant)
      ? slide.variant
      : (role === 'content' ? fallbackSlide.variant || inferVariant(slide) : fallbackSlide.variant || role);
    const blocks = normalizeBlocks(slide?.blocks, fallbackSlide.blocks);
    if (!getBlockByType(blocks, 'title')) {
      blocks.unshift(createBlock('title', { text: slide?.title || fallbackSlide.title || '内容' }, BOX_PRESETS.title));
    }

    return {
      id: slide?.id || fallbackSlide.id || nanoid(),
      title: slide?.title || getTitleFromBlocks(blocks, fallbackSlide.title),
      role,
      variant,
      background: normalizeBackground(slide?.background, fallbackSlide.background, theme),
      blocks,
      notes: typeof slide?.notes === 'string' ? slide.notes : (fallbackSlide.notes || '')
    };
  });

  return {
    theme,
    layoutHints: Array.isArray(scene.layoutHints) ? scene.layoutHints : fallbackScene.layoutHints,
    slides,
    updatedAt: new Date().toISOString()
  };
}

function extractBullets(slide, fallbackSlide) {
  const bulletBlock = getBlockByType(slide?.blocks, 'bullets');
  if (bulletBlock?.items?.length) return bulletBlock.items;

  const summaryCards = getBlockByType(slide?.blocks, 'summaryCards');
  if (summaryCards?.items?.length) return summaryCards.items;

  const subtitleBlock = getBlockByType(slide?.blocks, 'subtitle');
  if (subtitleBlock?.text) {
    return subtitleBlock.text
      .split(/[·•｜|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return Array.isArray(fallbackSlide?.bullets) ? fallbackSlide.bullets : [];
}

function sceneToPptSpec(scene, fallbackSlides = []) {
  if (!scene || !Array.isArray(scene.slides) || scene.slides.length === 0) return null;

  return {
    theme: scene.theme || null,
    layoutHints: Array.isArray(scene.layoutHints) ? scene.layoutHints : [],
    slides: scene.slides.map((slide, index) => {
      const fallbackSlide = Array.isArray(fallbackSlides) ? fallbackSlides[index] : null;
      const calloutBlock = getBlockByType(slide.blocks, 'callout');
      const questionBlock = getBlockByType(slide.blocks, 'question');
      return {
        title: slide.title || getTitleFromBlocks(slide.blocks, fallbackSlide?.title || '内容'),
        type: VALID_ROLES.has(slide.role) ? slide.role : (fallbackSlide?.type || 'content'),
        bullets: extractBullets(slide, fallbackSlide),
        example: calloutBlock?.text || '',
        question: questionBlock?.text || '',
        visual: '',
        notes: slide.notes || '',
        layout: slide.variant || ''
      };
    })
  };
}

module.exports = {
  buildPptSceneFromDraft,
  normalizeScene,
  sceneToPptSpec,
  inferVariant
};
