const { nanoid } = require('nanoid');
const { inferDesignPreset, mergeThemeWithPreset } = require('../ppt/design');

const CLASSROOM_VIEWPORT_SIZE = 1000;
const CLASSROOM_VIEWPORT_RATIO = 0.5625;
const CLASSROOM_VIEWPORT_HEIGHT = CLASSROOM_VIEWPORT_SIZE * CLASSROOM_VIEWPORT_RATIO;
const RECT_PATH = 'M 0 0 L 1 0 L 1 1 L 0 1 Z';
const DEFAULT_FONT = 'Microsoft YaHei';
const DEFAULT_THEME = {
  primary: '#5B9BD5',
  accent: '#22C55E',
  background: '#FFFFFF',
  text: '#1F2937',
  muted: '#475569',
  font: DEFAULT_FONT
};

function normalizeColor(value, fallback) {
  if (!value) return fallback;
  const color = `${value}`.trim();
  if (!color) return fallback;
  return color.startsWith('#') ? color : `#${color}`;
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTimestamp(value, fallback = Date.now()) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cloneList(value) {
  return Array.isArray(value) ? [...value] : [];
}

function normalizeTheme(theme = {}, styleHint = '') {
  const preset = inferDesignPreset({
    designPreset: styleHint,
    style: theme?.style || styleHint
  });
  const seedTheme = {
    ...theme,
    primary: theme?.primary || theme?.themeColors?.[0],
    accent: theme?.accent || theme?.themeColors?.[1] || theme?.outline?.color,
    background: theme?.background || theme?.backgroundColor,
    text: theme?.text || theme?.fontColor,
    font: theme?.font || theme?.fontName
  };
  const merged = mergeThemeWithPreset(seedTheme || {}, preset);
  return {
    primary: normalizeColor(merged.primary, DEFAULT_THEME.primary),
    accent: normalizeColor(merged.accent, DEFAULT_THEME.accent),
    background: normalizeColor(merged.background, DEFAULT_THEME.background),
    text: normalizeColor(merged.text, DEFAULT_THEME.text),
    muted: normalizeColor(merged.muted, DEFAULT_THEME.muted),
    font: merged.font || DEFAULT_THEME.font
  };
}

function buildCanvasTheme(theme = {}, styleHint = '') {
  const merged = normalizeTheme(theme, styleHint);
  return {
    backgroundColor: merged.background,
    themeColors: [
      merged.primary,
      merged.accent,
      '#A5A5A5',
      '#FFC000',
      '#4472C4'
    ],
    fontColor: merged.text,
    fontName: merged.font || DEFAULT_FONT,
    outline: {
      color: merged.accent,
      width: 2,
      style: 'solid'
    },
    shadow: {
      h: 0,
      v: 0,
      blur: 10,
      color: '#000000'
    }
  };
}

function normalizeCellStyle(style = {}) {
  return {
    bold: Boolean(style.bold),
    color: normalizeColor(style.color, '#111827'),
    backcolor: normalizeColor(style.backcolor, ''),
    fontsize: normalizeNumber(style.fontsize, 15),
    align: ['left', 'center', 'right'].includes(style.align) ? style.align : 'left'
  };
}

function normalizeTableData(data = []) {
  if (!Array.isArray(data)) return [];
  return data.map((row, rowIndex) => (
    Array.isArray(row)
      ? row.map((cell, cellIndex) => ({
          id: cell?.id || `r${rowIndex + 1}c${cellIndex + 1}`,
          colspan: normalizeNumber(cell?.colspan, 1),
          rowspan: normalizeNumber(cell?.rowspan, 1),
          text: `${cell?.text || ''}`.trim(),
          style: normalizeCellStyle(cell?.style || {})
        }))
      : []
  ));
}

function normalizeElement(element = {}, index = 0) {
  const base = {
    id: element.id || `${element.type || 'element'}_${nanoid(8)}`,
    type: `${element.type || ''}`.trim(),
    left: normalizeNumber(element.left, 0),
    top: normalizeNumber(element.top, 0),
    width: normalizeNumber(element.width, 0),
    height: normalizeNumber(element.height, 0),
    rotate: normalizeNumber(element.rotate, 0)
  };

  switch (base.type) {
    case 'text':
      return {
        ...base,
        content: typeof element.content === 'string' ? element.content : '',
        defaultFontName: element.defaultFontName || DEFAULT_FONT,
        defaultColor: normalizeColor(element.defaultColor, DEFAULT_THEME.text),
        fill: normalizeColor(element.fill, ''),
        opacity: normalizeNumber(element.opacity, 1),
        textType: element.textType || ''
      };
    case 'shape':
      return {
        ...base,
        path: typeof element.path === 'string' && element.path.trim() ? element.path : RECT_PATH,
        viewBox: Array.isArray(element.viewBox) && element.viewBox.length === 2
          ? [normalizeNumber(element.viewBox[0], 1), normalizeNumber(element.viewBox[1], 1)]
          : [1, 1],
        fill: normalizeColor(element.fill, '#E5E7EB'),
        fixedRatio: Boolean(element.fixedRatio)
      };
    case 'line':
      return {
        ...base,
        width: normalizeNumber(element.width, 2),
        start: Array.isArray(element.start) ? [normalizeNumber(element.start[0], 0), normalizeNumber(element.start[1], 0)] : [0, 0],
        end: Array.isArray(element.end) ? [normalizeNumber(element.end[0], 0), normalizeNumber(element.end[1], 0)] : [0, 0],
        style: ['solid', 'dashed', 'dotted'].includes(element.style) ? element.style : 'solid',
        color: normalizeColor(element.color, '#94A3B8'),
        points: cloneList(element.points)
      };
    case 'table':
      return {
        ...base,
        colWidths: Array.isArray(element.colWidths)
          ? element.colWidths.map((item) => normalizeNumber(item, 0)).filter((item) => item > 0)
          : [],
        data: normalizeTableData(element.data),
        outline: {
          width: normalizeNumber(element.outline?.width, 1),
          style: ['solid', 'dashed', 'dotted'].includes(element.outline?.style) ? element.outline.style : 'solid',
          color: normalizeColor(element.outline?.color, '#D9E2F3')
        }
      };
    case 'latex':
      return {
        ...base,
        latex: typeof element.latex === 'string' ? element.latex : '',
        html: typeof element.html === 'string' ? element.html : '',
        color: normalizeColor(element.color, DEFAULT_THEME.text),
        align: ['left', 'center', 'right'].includes(element.align) ? element.align : 'left',
        fixedRatio: Boolean(element.fixedRatio)
      };
    case 'image':
      return {
        ...base,
        src: typeof element.src === 'string' ? element.src : '',
        fixedRatio: element.fixedRatio !== false,
        radius: normalizeNumber(element.radius, 0)
      };
    default:
      return {
        ...base,
        type: base.type || `unknown_${index}`,
        content: typeof element.content === 'string' ? element.content : ''
      };
  }
}

function normalizeCanvas(canvas = {}, fallbackTheme = null, styleHint = '') {
  const viewportSize = normalizeNumber(canvas.viewportSize, CLASSROOM_VIEWPORT_SIZE);
  const viewportRatio = normalizeNumber(canvas.viewportRatio, CLASSROOM_VIEWPORT_RATIO);
  const elements = Array.isArray(canvas.elements)
    ? canvas.elements.map((element, index) => normalizeElement(element, index)).filter(Boolean)
    : [];

  return {
    id: canvas.id || `canvas_${nanoid(10)}`,
    viewportSize,
    viewportRatio,
    theme: canvas.theme && typeof canvas.theme === 'object'
      ? {
          ...buildCanvasTheme(fallbackTheme || {}, styleHint),
          ...canvas.theme,
          backgroundColor: normalizeColor(canvas.theme.backgroundColor, buildCanvasTheme(fallbackTheme || {}, styleHint).backgroundColor),
          fontColor: normalizeColor(canvas.theme.fontColor, buildCanvasTheme(fallbackTheme || {}, styleHint).fontColor),
          fontName: canvas.theme.fontName || buildCanvasTheme(fallbackTheme || {}, styleHint).fontName
        }
      : buildCanvasTheme(fallbackTheme || {}, styleHint),
    elements
  };
}

function normalizeScene(scene = {}, index = 0, stage = {}, fallbackTheme = null) {
  const sourceCanvas = scene?.content?.type === 'slide'
    ? scene.content.canvas
    : (scene.canvas || scene?.content?.canvas || null);
  if (!sourceCanvas) return null;

  const createdAt = normalizeTimestamp(scene.createdAt, stage.createdAt || Date.now());
  const updatedAt = normalizeTimestamp(scene.updatedAt, createdAt);
  const title = `${scene.title || `第 ${index + 1} 页`}`.trim();

  return {
    id: scene.id || `scene_${nanoid(10)}`,
    stageId: scene.stageId || stage.id || '',
    type: scene.type || 'slide',
    title,
    order: normalizeNumber(scene.order, index + 1),
    content: {
      type: 'slide',
      canvas: normalizeCanvas(sourceCanvas, fallbackTheme, stage.style || '')
    },
    citations: Array.isArray(scene.citations) ? scene.citations.map((item) => `${item || ''}`.trim()).filter(Boolean) : [],
    slideMeta: scene.slideMeta && typeof scene.slideMeta === 'object' ? scene.slideMeta : null,
    createdAt,
    updatedAt
  };
}

function normalizeClassroom(raw = null, options = {}) {
  if (!raw || typeof raw !== 'object') return null;

  const draft = options.draft || {};
  const state = options.state || {};
  const fields = state.fields || {};
  const stageSource = raw.stage && typeof raw.stage === 'object' ? raw.stage : raw;
  const createdAt = normalizeTimestamp(stageSource.createdAt || raw.createdAt, Date.now());
  const updatedAt = normalizeTimestamp(stageSource.updatedAt || raw.updatedAt, createdAt);
  const style = inferDesignPreset({
    designPreset: stageSource.style || raw.style || draft.designPreset,
    style: fields.style || draft?.lessonPlan?.methods,
    subject: fields.subject || stageSource.name || raw.name || draft?.ppt?.[0]?.title,
    grade: fields.grade,
    interactions: fields.interactions || draft?.interactionIdea?.description
  });
  const stageTheme = normalizeTheme(
    stageSource.theme || raw.theme || draft.theme || {},
    style
  );

  const stage = {
    id: stageSource.id || raw.id || `classroom_${nanoid(10)}`,
    name: `${stageSource.name || raw.name || fields.subject || draft?.ppt?.[0]?.title || '教学课件'}`.trim(),
    description: `${stageSource.description || raw.description || fields.goals || draft?.lessonPlan?.goals || ''}`.trim(),
    language: stageSource.language || raw.language || 'zh-CN',
    style,
    createdAt,
    updatedAt,
    theme: buildCanvasTheme(stageTheme, style),
    fields: fields && typeof fields === 'object' ? { ...fields } : {},
    lessonPlan: draft?.lessonPlan || stageSource.lessonPlan || raw.lessonPlan || null,
    interactionIdea: draft?.interactionIdea || stageSource.interactionIdea || raw.interactionIdea || null,
    generatedAgentConfigs: Array.isArray(stageSource.generatedAgentConfigs)
      ? [...stageSource.generatedAgentConfigs]
      : []
  };

  const scenes = Array.isArray(raw.scenes)
    ? raw.scenes.map((scene, index) => normalizeScene(scene, index, stage, stageTheme)).filter(Boolean)
    : [];

  return {
    id: stage.id,
    name: stage.name,
    description: stage.description,
    language: stage.language,
    style: stage.style,
    createdAt: stage.createdAt,
    updatedAt: stage.updatedAt,
    source: options.source || raw.source || '',
    stage,
    scenes,
    scenesCount: scenes.length
  };
}

module.exports = {
  CLASSROOM_VIEWPORT_SIZE,
  CLASSROOM_VIEWPORT_RATIO,
  CLASSROOM_VIEWPORT_HEIGHT,
  RECT_PATH,
  DEFAULT_FONT,
  DEFAULT_THEME,
  normalizeColor,
  normalizeNumber,
  normalizeTimestamp,
  normalizeTheme,
  buildCanvasTheme,
  normalizeClassroom
};
