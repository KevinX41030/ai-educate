const DEFAULT_PRESET = 'corporate';

const DESIGN_PRESETS = {
  corporate: {
    label: '现代商务',
    theme: {
      primary: '#1F3B73',
      accent: '#4C8BF5',
      background: '#F8FAFC',
      text: '#0F172A',
      font: 'Microsoft YaHei'
    },
    layoutHints: ['cover_right_panel', 'content_two_column', 'summary_cards']
  },
  editorial: {
    label: '杂志叙事',
    theme: {
      primary: '#24304F',
      accent: '#F59E0B',
      background: '#FFFBF5',
      text: '#172033',
      font: 'Microsoft YaHei'
    },
    layoutHints: ['cover_right_panel', 'summary_cards']
  },
  classroom: {
    label: '课堂互动',
    theme: {
      primary: '#0F766E',
      accent: '#F97316',
      background: '#F0FDFA',
      text: '#0F172A',
      font: 'Microsoft YaHei'
    },
    layoutHints: ['content_two_column', 'summary_cards']
  }
};

const VALID_DESIGN_PRESETS = new Set(Object.keys(DESIGN_PRESETS));

function normalizeColor(color, fallback) {
  if (!color) return fallback;
  const normalized = String(color).trim();
  if (!normalized) return fallback;
  return normalized.startsWith('#') ? normalized.toUpperCase() : `#${normalized.toUpperCase()}`;
}

function resolveDesignPreset(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_DESIGN_PRESETS.has(normalized) ? normalized : DEFAULT_PRESET;
}

function inferDesignPreset(input = {}) {
  const explicit = resolveDesignPreset(input.designPreset);
  if (explicit !== DEFAULT_PRESET || String(input.designPreset || '').trim().toLowerCase() === DEFAULT_PRESET) {
    return explicit;
  }

  const text = [
    input.style,
    input.subject,
    input.grade,
    input.interactions,
    input.methods,
    input.title
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(活泼|趣味|互动|游戏|启发|闯关|抢答|投票|小学|幼儿|低龄|课堂活动|班会)/.test(text)) {
    return 'classroom';
  }

  if (/(极简|高级|叙事|杂志|文艺|人文|语文|历史|地理|文学|阅读|写作|表达|审美)/.test(text)) {
    return 'editorial';
  }

  return DEFAULT_PRESET;
}

function getDesignPresetTheme(preset) {
  return DESIGN_PRESETS[resolveDesignPreset(preset)].theme;
}

function mergeThemeWithPreset(theme = {}, preset) {
  const base = getDesignPresetTheme(preset);
  return {
    primary: normalizeColor(theme.primary, base.primary),
    accent: normalizeColor(theme.accent, base.accent),
    background: normalizeColor(theme.background, base.background),
    text: normalizeColor(theme.text, base.text),
    font: theme.font || base.font
  };
}

function getDesignPresetHints(preset) {
  return [...DESIGN_PRESETS[resolveDesignPreset(preset)].layoutHints];
}

module.exports = {
  DESIGN_PRESETS,
  VALID_DESIGN_PRESETS,
  resolveDesignPreset,
  inferDesignPreset,
  getDesignPresetTheme,
  mergeThemeWithPreset,
  getDesignPresetHints,
  normalizeColor
};
