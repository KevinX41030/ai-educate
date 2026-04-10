const { nanoid } = require('nanoid');

const VALID_EDIT_SCOPES = new Set(['all', 'toc', 'slides', 'lesson_plan', 'interaction']);

function cloneDraft(draft) {
  return draft ? JSON.parse(JSON.stringify(draft)) : null;
}

function normalizeSlideRange(slideRange, totalSlides = 0) {
  if (slideRange == null || slideRange === '') return null;

  let start;
  let end;
  if (Array.isArray(slideRange)) {
    start = Number(slideRange[0]);
    end = Number(slideRange[1] ?? slideRange[0]);
  } else if (typeof slideRange === 'object') {
    start = Number(slideRange.start);
    end = Number(slideRange.end ?? slideRange.start);
  } else {
    const text = String(slideRange).trim();
    const match = text.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
    if (!match) return null;
    start = Number(match[1]);
    end = Number(match[2] || match[1]);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 1 || end < 1 || start > end) return null;

  const normalizedStart = Math.min(start, totalSlides);
  const normalizedEnd = Math.min(end, totalSlides);
  if (normalizedStart < 1 || normalizedEnd < normalizedStart) return null;

  return {
    start: normalizedStart - 1,
    end: normalizedEnd - 1
  };
}

function enhanceSlideLocally(slide = {}, instruction = '') {
  const nextSlide = { ...slide };
  if (/简化|精简/.test(instruction) && Array.isArray(nextSlide.bullets)) {
    nextSlide.bullets = nextSlide.bullets.slice(0, 2);
  }
  if (/案例/.test(instruction)) {
    nextSlide.example = nextSlide.example || `补充案例：${instruction}`;
  }
  if (/提问|互动/.test(instruction)) {
    nextSlide.question = nextSlide.question || instruction;
  }
  nextSlide.notes = [nextSlide.notes, instruction].filter(Boolean).join('；');
  return nextSlide;
}

function applyScopedEditFallback(draft, { scope, instruction = '', slideRange = null }) {
  const nextDraft = cloneDraft(draft);
  if (!nextDraft) return null;

  if (scope === 'all') {
    if (/调整顺序/.test(instruction)) {
      const cover = nextDraft.ppt.find((slide) => slide.type === 'cover');
      const toc = nextDraft.ppt.find((slide) => slide.type === 'toc');
      const summary = nextDraft.ppt.find((slide) => slide.type === 'summary');
      const contentSlides = nextDraft.ppt.filter((slide) => slide.type === 'content').reverse();
      nextDraft.ppt = [cover, toc, ...contentSlides, summary].filter(Boolean);
    }
    if (/增加.*案例/.test(instruction)) {
      nextDraft.ppt.splice(Math.max(nextDraft.ppt.length - 1, 0), 0, {
        id: nanoid(),
        title: '案例拓展',
        type: 'content',
        bullets: ['案例背景', '分析过程', '迁移应用'],
        example: instruction,
        question: '',
        visual: '',
        notes: '',
        teachingGoal: '',
        speakerNotes: '',
        commonMistakes: [],
        citations: []
      });
    }
  }

  if (scope === 'toc') {
    const tocSlide = nextDraft.ppt.find((slide) => slide.type === 'toc');
    if (tocSlide) {
      tocSlide.bullets = nextDraft.ppt
        .filter((slide) => slide.type === 'content')
        .map((slide) => slide.title)
        .filter(Boolean);
      tocSlide.notes = [tocSlide.notes, instruction].filter(Boolean).join('；');
    }
  }

  if (scope === 'slides' && slideRange) {
    nextDraft.ppt = nextDraft.ppt.map((slide, index) => {
      if (index < slideRange.start || index > slideRange.end) return slide;
      return enhanceSlideLocally(slide, instruction);
    });
  }

  if (scope === 'lesson_plan') {
    nextDraft.lessonPlan = {
      ...nextDraft.lessonPlan,
      activities: [nextDraft.lessonPlan?.activities, instruction].filter(Boolean).join('；')
    };
  }

  if (scope === 'interaction') {
    nextDraft.interactionIdea = {
      title: nextDraft.interactionIdea?.title || '课堂互动设计',
      description: instruction || nextDraft.interactionIdea?.description || ''
    };
  }

  nextDraft.updatedAt = new Date().toISOString();
  return nextDraft;
}

module.exports = {
  VALID_EDIT_SCOPES,
  normalizeSlideRange,
  applyScopedEditFallback
};
