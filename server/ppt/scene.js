const { nanoid } = require('nanoid');
const {
  inferDesignPreset,
  resolveDesignPreset,
  mergeThemeWithPreset,
  getDesignPresetHints,
  normalizeColor
} = require('./design');

const VALID_ROLES = new Set(['cover', 'toc', 'content', 'summary']);
const VALID_VARIANTS = new Set(['cover', 'toc', 'concept', 'process', 'case', 'activity', 'summary']);
const VALID_BLOCK_TYPES = new Set(['title', 'subtitle', 'bullets', 'callout', 'question', 'summaryCards']);

const BOX_PRESET_FAMILIES = {
  corporate: {
    cover: {
      title: { x: 0.8, y: 0.5, w: 8.8, h: 0.9 },
      subtitle: { x: 0.8, y: 1.45, w: 8.2, h: 0.6 },
      callout: { x: 8.2, y: 1.8, w: 4.1, h: 1.8 }
    },
    toc: {
      title: { x: 0.8, y: 0.5, w: 11.8, h: 0.9 },
      bullets: { x: 0.9, y: 1.8, w: 11.0, h: 4.8 }
    },
    content: {
      title: { x: 0.8, y: 0.5, w: 11.8, h: 0.9 },
      bullets: { x: 0.9, y: 1.8, w: 7.0, h: 4.8 },
      callout: { x: 8.2, y: 1.8, w: 4.1, h: 1.8 },
      question: { x: 8.2, y: 3.9, w: 4.1, h: 1.3 }
    },
    summary: {
      title: { x: 0.8, y: 0.5, w: 11.8, h: 0.9 },
      summaryCards: { x: 0.9, y: 1.8, w: 11.4, h: 3.9 },
      callout: { x: 0.9, y: 5.1, w: 11.0, h: 1.2 }
    }
  },
  editorial: {
    cover: {
      title: { x: 0.95, y: 0.8, w: 8.2, h: 1.0 },
      subtitle: { x: 0.95, y: 2.0, w: 7.2, h: 0.5 },
      callout: { x: 0.95, y: 5.45, w: 5.0, h: 1.05 }
    },
    toc: {
      title: { x: 0.95, y: 0.65, w: 10.8, h: 0.8 },
      bullets: { x: 1.1, y: 1.9, w: 10.3, h: 4.6 }
    },
    content: {
      title: { x: 0.95, y: 0.65, w: 10.8, h: 0.8 },
      bullets: { x: 0.95, y: 1.9, w: 7.9, h: 3.35 },
      callout: { x: 0.95, y: 5.55, w: 7.3, h: 0.8 },
      question: { x: 9.0, y: 1.95, w: 2.9, h: 2.25 }
    },
    summary: {
      title: { x: 0.95, y: 0.65, w: 10.8, h: 0.8 },
      summaryCards: { x: 0.95, y: 2.0, w: 11.2, h: 3.2 },
      callout: { x: 0.95, y: 5.65, w: 11.2, h: 0.75 }
    }
  },
  classroom: {
    cover: {
      title: { x: 0.9, y: 0.8, w: 7.4, h: 0.95 },
      subtitle: { x: 0.95, y: 1.95, w: 6.4, h: 0.5 },
      callout: { x: 7.9, y: 1.9, w: 4.15, h: 1.95 }
    },
    toc: {
      title: { x: 0.9, y: 0.65, w: 10.8, h: 0.8 },
      bullets: { x: 1.0, y: 1.85, w: 10.7, h: 4.75 }
    },
    content: {
      title: { x: 0.9, y: 0.65, w: 10.8, h: 0.8 },
      bullets: { x: 0.95, y: 1.95, w: 6.15, h: 4.35 },
      callout: { x: 7.55, y: 1.9, w: 4.35, h: 1.95 },
      question: { x: 7.55, y: 4.2, w: 4.35, h: 1.45 }
    },
    summary: {
      title: { x: 0.9, y: 0.65, w: 10.8, h: 0.8 },
      summaryCards: { x: 0.85, y: 1.95, w: 11.6, h: 3.55 },
      callout: { x: 1.0, y: 5.85, w: 10.9, h: 0.8 }
    }
  }
};

const DEFAULT_BOX_PRESETS = BOX_PRESET_FAMILIES.corporate.content;

function normalizeTheme(theme = {}, designPreset = 'corporate') {
  return mergeThemeWithPreset(theme, designPreset);
}

function normalizeNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function resolveBoxPreset(designPreset, role, type) {
  const preset = BOX_PRESET_FAMILIES[resolveDesignPreset(designPreset)] || BOX_PRESET_FAMILIES.corporate;
  const family = preset[role] || preset.content;
  return family[type] || preset.content[type] || DEFAULT_BOX_PRESETS[type] || { x: 0.9, y: 1.8, w: 7.0, h: 4.8 };
}

function normalizeBox(box, fallback) {
  const base = fallback || DEFAULT_BOX_PRESETS.bullets;
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
    box: normalizeBox(data.box, fallbackBox)
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

function buildBlocksForSlide(slide, draft, designPreset) {
  const role = VALID_ROLES.has(slide?.type) ? slide.type : 'content';
  const variant = role === 'content' ? inferVariant(slide) : role;
  const bullets = normalizeItems(slide?.bullets);
  const blocks = [];

  blocks.push(createBlock('title', { text: slide?.title || '内容' }, resolveBoxPreset(designPreset, role, 'title')));

  if (role === 'cover') {
    const subtitle = bullets.join(' · ');
    if (subtitle) {
      blocks.push(createBlock('subtitle', { text: subtitle }, resolveBoxPreset(designPreset, role, 'subtitle')));
    }
    if (draft?.lessonPlan?.goals) {
      blocks.push(createBlock('callout', {
        title: '教学目标',
        text: draft.lessonPlan.goals
      }, resolveBoxPreset(designPreset, role, 'callout')));
    }
    return { blocks, variant };
  }

  if (role === 'toc') {
    blocks.push(createBlock('bullets', { items: bullets }, resolveBoxPreset(designPreset, role, 'bullets')));
    return { blocks, variant };
  }

  if (role === 'summary') {
    blocks.push(createBlock('summaryCards', { items: pickSummaryItems(draft, slide) }, resolveBoxPreset(designPreset, role, 'summaryCards')));
    if (draft?.lessonPlan?.homework) {
      blocks.push(createBlock('callout', {
        title: '课后延伸',
        text: draft.lessonPlan.homework
      }, resolveBoxPreset(designPreset, role, 'callout')));
    }
    return { blocks, variant };
  }

  blocks.push(createBlock('bullets', { items: bullets }, resolveBoxPreset(designPreset, role, 'bullets')));

  if (variant === 'process' && Array.isArray(draft?.lessonPlan?.process) && draft.lessonPlan.process.length) {
    blocks.push(createBlock('callout', {
      title: '教学流程',
      text: draft.lessonPlan.process.slice(0, 3).join('；')
    }, resolveBoxPreset(designPreset, role, 'callout')));
  } else if (variant === 'case' && draft?.lessonPlan?.activities) {
    blocks.push(createBlock('callout', {
      title: '应用案例',
      text: draft.lessonPlan.activities
    }, resolveBoxPreset(designPreset, role, 'callout')));
  } else {
    blocks.push(createBlock('callout', {
      title: '课堂提示',
      text: bullets[1] || bullets[0] || '补充教学案例或误区提醒。'
    }, resolveBoxPreset(designPreset, role, 'callout')));
  }

  if (variant === 'activity' && draft?.interactionIdea?.description) {
    blocks.push(createBlock('question', {
      text: draft.interactionIdea.description
    }, resolveBoxPreset(designPreset, role, 'question')));
  } else if (draft?.interactionIdea?.title) {
    blocks.push(createBlock('question', {
      text: `互动建议：${draft.interactionIdea.title}`
    }, resolveBoxPreset(designPreset, role, 'question')));
  }

  return { blocks, variant };
}

function resolveSceneDesignPreset(draft = {}) {
  return inferDesignPreset({
    designPreset: draft.designPreset,
    style: draft.style || draft.lessonPlan?.methods,
    subject: draft.ppt?.[0]?.title,
    grade: Array.isArray(draft.ppt?.[0]?.bullets) ? draft.ppt[0].bullets.join(' ') : '',
    interactions: [draft.interactionIdea?.title, draft.interactionIdea?.description].filter(Boolean).join(' '),
    methods: draft.lessonPlan?.methods,
    title: draft.ppt?.[0]?.title
  });
}

function buildPptSceneFromDraft(draft) {
  if (!draft || !Array.isArray(draft.ppt) || draft.ppt.length === 0) return null;

  const designPreset = resolveSceneDesignPreset(draft);
  const theme = normalizeTheme(draft.theme || {}, designPreset);
  const slides = draft.ppt.map((slide) => {
    const role = VALID_ROLES.has(slide?.type) ? slide.type : 'content';
    const { blocks, variant } = buildBlocksForSlide(slide, draft, designPreset);
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
    designPreset,
    theme,
    layoutHints: Array.isArray(draft.layoutHints) && draft.layoutHints.length ? draft.layoutHints : getDesignPresetHints(designPreset),
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
      return createBlock(block.type, block, fallback?.box);
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

  const designPreset = resolveDesignPreset(scene.designPreset || fallbackScene.designPreset);
  const theme = normalizeTheme({ ...fallbackScene.theme, ...(scene.theme || {}) }, designPreset);
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
      blocks.unshift(createBlock('title', { text: slide?.title || fallbackSlide.title || '内容' }, resolveBoxPreset(designPreset, role, 'title')));
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
    designPreset,
    theme,
    layoutHints: Array.isArray(scene.layoutHints) && scene.layoutHints.length ? scene.layoutHints : fallbackScene.layoutHints,
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
    designPreset: resolveDesignPreset(scene.designPreset),
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
  inferVariant,
  resolveSceneDesignPreset
};
