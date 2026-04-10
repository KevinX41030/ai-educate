const DEFAULT_THEME = {
  primary: '#1F3B73',
  accent: '#4C8BF5',
  background: '#F8FAFC',
  text: '#0F172A',
  font: 'Microsoft YaHei'
};

const VALID_ROLES = new Set(['cover', 'toc', 'content', 'summary']);

const uid = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item) => `${item || ''}`.trim()).filter(Boolean);
};

const normalizeCitations = (citations) => {
  if (!Array.isArray(citations)) return [];
  return [...new Set(citations.map((item) => `${item || ''}`.trim()).filter(Boolean))];
};

const createBlock = (type, data = {}) => ({
  id: data.id || uid(`block-${type}`),
  type,
  title: typeof data.title === 'string' ? data.title : '',
  text: typeof data.text === 'string' ? data.text : '',
  items: normalizeItems(data.items),
  box: data.box && typeof data.box === 'object' ? data.box : {}
});

const inferVariant = (slide) => {
  const explicit = `${slide?.layout || ''}`.trim().toLowerCase();
  if (explicit === 'process') return 'process';
  if (explicit === 'case' || explicit === 'compare') return 'case';
  if (explicit === 'practice') return 'activity';
  if (explicit === 'misconception' || explicit === 'concept') return 'concept';
  const text = [slide?.title, ...(Array.isArray(slide?.bullets) ? slide.bullets : [])].join(' ');
  if (/(流程|步骤|过程|机制|路径|循环)/.test(text)) return 'process';
  if (/(练习|互动|讨论|小测|活动|任务|探究|闯关|抢答|游戏)/.test(text)) return 'activity';
  if (/(案例|应用|实验|场景|实例|拓展|综合)/.test(text)) return 'case';
  return 'concept';
};

const findBlock = (blocks, type) => (Array.isArray(blocks) ? blocks : []).find((block) => block?.type === type) || null;

const joinTextParts = (parts = []) => parts.map((item) => `${item || ''}`.trim()).filter(Boolean).join('；');

const buildCalloutTitle = (slide, fallback = '课堂提示') => {
  if (Array.isArray(slide?.commonMistakes) && slide.commonMistakes.length) return '易错提醒';
  if (slide?.example) return '案例提示';
  if (slide?.visual) return '视觉提示';
  return fallback;
};

const buildCalloutText = (slide, fallbackTexts = []) => {
  const mistakes = Array.isArray(slide?.commonMistakes)
    ? slide.commonMistakes.slice(0, 3).map((item) => `易错：${item}`)
    : [];

  return joinTextParts([
    slide?.example,
    slide?.notes,
    slide?.visual ? `视觉提示：${slide.visual}` : '',
    ...mistakes,
    ...fallbackTexts
  ]);
};

const buildQuestionText = (slide, fallbackTexts = []) => joinTextParts([slide?.question, ...fallbackTexts]);

const extractBullets = (slide, fallbackSlide = {}) => {
  const blockTypes = ['bullets', 'factCards', 'steps', 'columns', 'taskCards', 'summaryCards'];
  for (const type of blockTypes) {
    const block = findBlock(slide?.blocks, type);
    if (block?.items?.length) return block.items;
  }

  const subtitleBlock = findBlock(slide?.blocks, 'subtitle');
  if (subtitleBlock?.text) {
    return subtitleBlock.text
      .split(/[·•｜|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return normalizeItems(fallbackSlide?.bullets);
};

export function createSceneFromDraft(draft) {
  if (!draft || !Array.isArray(draft.ppt) || draft.ppt.length === 0) return null;

  const theme = {
    ...DEFAULT_THEME,
    ...(draft.theme || {})
  };

  return {
    designPreset: draft.designPreset || 'corporate',
    theme,
    layoutHints: Array.isArray(draft.layoutHints) ? [...draft.layoutHints] : [],
    slides: draft.ppt.map((slide, index) => {
      const role = VALID_ROLES.has(slide?.type) ? slide.type : 'content';
      const bullets = normalizeItems(slide?.bullets);
      const blocks = [
        createBlock('title', {
          id: `${slide?.id || `slide-${index}`}-title`,
          text: slide?.title || '内容'
        })
      ];

      if (role === 'cover') {
        if (bullets.length) {
          blocks.push(createBlock('subtitle', {
            id: `${slide?.id || `slide-${index}`}-subtitle`,
            text: bullets.join(' · ')
          }));
        }
      } else if (role === 'toc') {
        blocks.push(createBlock('bullets', {
          id: `${slide?.id || `slide-${index}`}-bullets`,
          items: bullets
        }));
      } else if (role === 'summary') {
        blocks.push(createBlock('summaryCards', {
          id: `${slide?.id || `slide-${index}`}-summary`,
          items: bullets
        }));
      } else {
        const variant = inferVariant(slide);
        const primaryType = {
          concept: 'factCards',
          process: 'steps',
          case: 'columns',
          activity: 'taskCards'
        }[variant] || 'bullets';

        blocks.push(createBlock(primaryType, {
          id: `${slide?.id || `slide-${index}`}-${primaryType}`,
          title: primaryType === 'factCards'
            ? '核心认识'
            : primaryType === 'steps'
              ? '学习步骤'
              : primaryType === 'columns'
                ? '案例拆解'
                : primaryType === 'taskCards'
                  ? '课堂任务板'
                  : '',
          items: bullets.length ? bullets : ['待补充内容']
        }));

        const calloutText = buildCalloutText(slide, [bullets[1], bullets[0]]);
        if (calloutText) {
          blocks.push(createBlock('callout', {
            id: `${slide?.id || `slide-${index}`}-callout`,
            title: buildCalloutTitle(slide),
            text: calloutText
          }));
        }

        const questionText = buildQuestionText(slide, []);
        if (questionText) {
          blocks.push(createBlock('question', {
            id: `${slide?.id || `slide-${index}`}-question`,
            title: '互动提问',
            text: questionText
          }));
        }
      }

      return {
        id: slide?.id || uid('slide'),
        title: slide?.title || '内容',
        role,
        variant: role === 'content' ? inferVariant(slide) : role,
        background: { type: 'solid', color: theme.background },
        blocks,
        notes: joinTextParts([slide?.speakerNotes, slide?.notes, slide?.teachingGoal]),
        citations: normalizeCitations(slide?.citations)
      };
    }),
    updatedAt: draft.updatedAt || new Date().toISOString()
  };
}

export function mergeDraftWithScene(draft, scene) {
  if (!draft || !scene || !Array.isArray(scene.slides) || scene.slides.length === 0) return draft;

  const fallbackSlides = Array.isArray(draft.ppt) ? draft.ppt : [];
  const ppt = scene.slides.map((slide, index) => {
    const fallbackSlide = fallbackSlides[index] || {};
    const titleBlock = findBlock(slide.blocks, 'title');
    const calloutBlock = findBlock(slide.blocks, 'callout');
    const questionBlock = findBlock(slide.blocks, 'question');
    return {
      id: slide?.id || fallbackSlide.id || uid('slide'),
      title: slide?.title || titleBlock?.text || fallbackSlide.title || '内容',
      type: VALID_ROLES.has(slide?.role) ? slide.role : (fallbackSlide.type || 'content'),
      layout: slide?.variant || fallbackSlide.layout || '',
      bullets: extractBullets(slide, fallbackSlide),
      example: calloutBlock?.text || fallbackSlide.example || '',
      question: questionBlock?.text || fallbackSlide.question || '',
      visual: fallbackSlide.visual || '',
      notes: slide?.notes || fallbackSlide.notes || '',
      teachingGoal: fallbackSlide.teachingGoal || '',
      speakerNotes: fallbackSlide.speakerNotes || '',
      commonMistakes: Array.isArray(fallbackSlide.commonMistakes) ? fallbackSlide.commonMistakes : [],
      citations: normalizeCitations(slide?.citations).length
        ? normalizeCitations(slide?.citations)
        : normalizeCitations(fallbackSlide?.citations)
    };
  });

  return {
    ...draft,
    designPreset: scene.designPreset || draft.designPreset || 'corporate',
    brief: draft.brief || null,
    theme: {
      ...(draft.theme || {}),
      ...(scene.theme || {})
    },
    layoutHints: Array.isArray(scene.layoutHints) && scene.layoutHints.length
      ? [...scene.layoutHints]
      : (Array.isArray(draft.layoutHints) ? [...draft.layoutHints] : []),
    ppt,
    updatedAt: new Date().toISOString()
  };
}
