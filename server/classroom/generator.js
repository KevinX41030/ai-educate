const { nanoid } = require('nanoid');
const {
  CLASSROOM_VIEWPORT_SIZE,
  CLASSROOM_VIEWPORT_RATIO,
  CLASSROOM_VIEWPORT_HEIGHT,
  RECT_PATH,
  DEFAULT_THEME,
  buildCanvasTheme,
  normalizeClassroom,
  normalizeColor,
  normalizeTheme
} = require('./schema');

function escapeHtml(value) {
  return `${value || ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uniqueList(value = []) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => `${item || ''}`.trim())
    .filter(Boolean))];
}

function trimText(value, max = 42) {
  const text = `${value || ''}`.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function titleHtml(text, size = 32, color = '#111827', align = 'left') {
  return `<p style="margin:0; font-size:${size}px; line-height:1.25; text-align:${align}; color:${color};"><strong>${escapeHtml(text)}</strong></p>`;
}

function bodyHtml(text, size = 18, color = '#334155', align = 'left', marginBottom = 10) {
  return `<p style="margin:0 0 ${marginBottom}px 0; font-size:${size}px; line-height:1.5; text-align:${align}; color:${color};">${escapeHtml(text)}</p>`;
}

function listHtml(items = [], options = {}) {
  const {
    size = 18,
    color = '#334155',
    align = 'left',
    marker = '•'
  } = options;
  return items
    .filter(Boolean)
    .map((item) => bodyHtml(`${marker} ${item}`, size, color, align, 8))
    .join('');
}

function buildMetaLine({ fields = {}, draft = {} }) {
  return [
    fields.grade,
    fields.duration,
    fields.style || draft?.lessonPlan?.methods
  ].filter(Boolean).join(' · ');
}

function createTextElement({
  left,
  top,
  width,
  height,
  content,
  defaultColor = DEFAULT_THEME.text,
  defaultFontName = DEFAULT_THEME.font,
  rotate = 0,
  textType = ''
}) {
  return {
    id: `text_${nanoid(8)}`,
    type: 'text',
    left,
    top,
    width,
    height,
    content,
    defaultFontName,
    defaultColor: normalizeColor(defaultColor, DEFAULT_THEME.text),
    rotate,
    textType
  };
}

function createShapeElement({
  left,
  top,
  width,
  height,
  fill,
  rotate = 0
}) {
  return {
    id: `shape_${nanoid(8)}`,
    type: 'shape',
    left,
    top,
    width,
    height,
    path: RECT_PATH,
    viewBox: [1, 1],
    fill: normalizeColor(fill, '#E5E7EB'),
    fixedRatio: false,
    rotate
  };
}

function createLineElement({
  left,
  top,
  start,
  end,
  width = 3,
  color = '#94A3B8',
  style = 'solid',
  points = ['', 'arrow'],
  rotate = 0
}) {
  return {
    id: `line_${nanoid(8)}`,
    type: 'line',
    left,
    top,
    width,
    start,
    end,
    style,
    color: normalizeColor(color, '#94A3B8'),
    points,
    rotate
  };
}

function createTableElement({
  left,
  top,
  width,
  height,
  colWidths,
  data,
  outline
}) {
  return {
    id: `table_${nanoid(8)}`,
    type: 'table',
    left,
    top,
    width,
    height,
    colWidths,
    data,
    outline: {
      width: outline?.width || 2,
      style: outline?.style || 'solid',
      color: normalizeColor(outline?.color, '#D9E2F3')
    },
    rotate: 0
  };
}

function createLatexElement({
  left,
  top,
  width,
  height,
  latex,
  html,
  color = DEFAULT_THEME.text,
  align = 'left'
}) {
  return {
    id: `latex_${nanoid(8)}`,
    type: 'latex',
    left,
    top,
    width,
    height,
    latex,
    html,
    color: normalizeColor(color, DEFAULT_THEME.text),
    align,
    fixedRatio: false,
    rotate: 0
  };
}

function createCardElements({
  left,
  top,
  width,
  height,
  fill,
  title,
  titleColor,
  body,
  bodyColor = '#334155',
  bodyAlign = 'left'
}) {
  return [
    createShapeElement({ left, top, width, height, fill }),
    createTextElement({
      left: left + 20,
      top: top + 18,
      width: width - 40,
      height: 36,
      content: titleHtml(title, 18, titleColor || '#111827'),
      defaultColor: titleColor || '#111827',
      textType: 'itemTitle'
    }),
    createTextElement({
      left: left + 20,
      top: top + 62,
      width: width - 40,
      height: height - 80,
      content: body,
      defaultColor: bodyColor,
      textType: 'content'
    })
  ];
}

function createBaseHeader(slide, palette, metaLine = '') {
  const elements = [
    createTextElement({
      left: 60,
      top: 48,
      width: 700,
      height: 78,
      content: titleHtml(slide.title || '未命名页面', 32, palette.title),
      defaultColor: palette.title,
      textType: 'title'
    }),
    createShapeElement({
      left: 60,
      top: 126,
      width: 880,
      height: 3,
      fill: palette.accent
    })
  ];

  if (metaLine) {
    elements.push(createTextElement({
      left: 60,
      top: 136,
      width: 620,
      height: 30,
      content: bodyHtml(metaLine, 14, palette.muted, 'left', 0),
      defaultColor: palette.muted,
      textType: 'subtitle'
    }));
  }

  return elements;
}

function buildKeypointRows(slide, fallback = []) {
  const fromBullets = uniqueList(slide?.bullets || []);
  if (fromBullets.length) return fromBullets.slice(0, 4);
  return uniqueList(fallback).slice(0, 4);
}

function buildAgendaItems(draft = {}, fields = {}) {
  const slides = Array.isArray(draft.ppt) ? draft.ppt : [];
  const contentTitles = slides
    .filter((item) => item?.type === 'content')
    .map((item) => trimText(item.title, 18));
  if (contentTitles.length) return contentTitles.slice(0, 6);
  return uniqueList(fields.keyPoints || []).slice(0, 6);
}

function buildTeachingMove(slide, index) {
  const mistakes = uniqueList(slide?.commonMistakes || []);
  if (mistakes[index]) return `提醒：${trimText(mistakes[index], 28)}`;
  if (slide?.question && index === 0) return `追问：${trimText(slide.question, 28)}`;
  if (slide?.example) return `示例：${trimText(slide.example, 28)}`;
  return '用一个生活化例子或课堂提问把它讲活。';
}

function buildTableRows(slide) {
  const bullets = buildKeypointRows(slide, []);
  const rows = bullets.slice(0, 4);
  return [
    [
      {
        id: 'r1c1',
        colspan: 1,
        rowspan: 1,
        text: '学习切片',
        style: { bold: true, color: '#ffffff', backcolor: '#5b9bd5', fontsize: 16, align: 'center' }
      },
      {
        id: 'r1c2',
        colspan: 1,
        rowspan: 1,
        text: '课堂处理',
        style: { bold: true, color: '#ffffff', backcolor: '#5b9bd5', fontsize: 16, align: 'center' }
      }
    ],
    ...rows.map((item, index) => ([
      {
        id: `r${index + 2}c1`,
        colspan: 1,
        rowspan: 1,
        text: trimText(item, 20),
        style: { bold: true, backcolor: '#eaf2fb', fontsize: 15, align: 'center' }
      },
      {
        id: `r${index + 2}c2`,
        colspan: 1,
        rowspan: 1,
        text: buildTeachingMove(slide, index),
        style: { fontsize: 15, align: 'left' }
      }
    ]))
  ];
}

function buildRelationshipLatex(slide, fields = {}) {
  const left = trimText(slide.title || fields.subject || '核心概念', 12);
  const right = trimText((slide.question || slide.example || '课堂迁移').replace(/[？?]/g, ''), 16);
  return {
    latex: `\\text{${left}} \\Rightarrow \\text{${right}}`,
    html: `<div style="font-size:24px; font-weight:700; color:#111827;">${escapeHtml(left)} → ${escapeHtml(right)}</div>`
  };
}

const CONTENT_LAYOUTS = new Set(['concept', 'process', 'compare', 'case', 'practice', 'misconception']);

function hashString(value = '') {
  const text = `${value || ''}`;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function chooseSceneVariant(slide = {}, order = 0, variants = [], seed = '') {
  const options = Array.isArray(variants) ? variants.filter(Boolean) : [];
  if (!options.length) return '';
  const key = [
    slide?.id,
    slide?.title,
    slide?.layout,
    slide?.type,
    slide?.question,
    order,
    seed
  ].filter(Boolean).join('|');
  return options[hashString(key) % options.length];
}

function compactText(value, fallback = '', max = 48) {
  const text = `${value || ''}`.trim();
  if (text) return trimText(text, max);
  return fallback ? trimText(fallback, max) : '';
}

function chunkList(value = [], size = 2) {
  const list = Array.isArray(value) ? value.filter(Boolean) : [];
  const chunks = [];
  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }
  return chunks;
}

function numberedListHtml(items = [], options = {}) {
  const {
    size = 16,
    color = '#334155',
    align = 'left'
  } = options;
  return items
    .filter(Boolean)
    .map((item, index) => bodyHtml(`${index + 1}. ${item}`, size, color, align, 8))
    .join('');
}

function buildSceneRecord({ slide, stageId, order, createdAt, palette, elements, layout, variant = '', title }) {
  return {
    id: `scene_${nanoid(10)}`,
    stageId,
    type: 'slide',
    title: title || slide.title || '内容',
    order,
    citations: uniqueList(slide.citations || []),
    slideMeta: {
      slideType: slide.type || 'content',
      layout,
      variant,
      notes: slide.notes || slide.speakerNotes || ''
    },
    content: {
      type: 'slide',
      canvas: {
        id: `canvas_${nanoid(10)}`,
        viewportSize: CLASSROOM_VIEWPORT_SIZE,
        viewportRatio: CLASSROOM_VIEWPORT_RATIO,
        theme: buildCanvasTheme(palette, palette.style),
        elements
      }
    },
    createdAt,
    updatedAt: createdAt
  };
}

function buildExampleText(slide, draft = {}) {
  return compactText(
    slide?.example,
    draft?.interactionIdea?.description || '结合一个贴近课堂的例子，把概念讲成学生能看见的现象。',
    58
  );
}

function buildQuestionText(slide, fields = {}, draft = {}) {
  return compactText(
    slide?.question,
    fields?.interactions || draft?.interactionIdea?.description || '如果换一个情境，这个结论还成立吗？',
    60
  );
}

function buildVisualText(slide) {
  return slide?.visual
    ? `建议图示：${compactText(slide.visual, '', 56)}`
    : '建议图示：用结构图、流程图或对照表承接这一页。';
}

function buildSupportLines(slide, draft = {}, fields = {}, max = 4) {
  return uniqueList([
    slide?.teachingGoal ? `目标：${slide.teachingGoal}` : '',
    slide?.example ? `案例：${slide.example}` : '',
    slide?.question ? `追问：${slide.question}` : '',
    slide?.visual ? `图示：${slide.visual}` : '',
    ...(Array.isArray(slide?.commonMistakes) ? slide.commonMistakes.map((item) => `提醒：${item}`) : []),
    draft?.interactionIdea?.description ? `互动：${draft.interactionIdea.description}` : '',
    fields?.interactions ? `练习：${fields.interactions}` : ''
  ])
    .map((item) => compactText(item, '', 42))
    .slice(0, max);
}

function buildConceptModules(slide, draft = {}, fields = {}) {
  const bullets = buildKeypointRows(slide, fields.keyPoints || []);
  return [
    {
      title: '核心概念',
      body: bodyHtml(
        compactText(bullets[0], slide.teachingGoal || '先说清这一页到底在讲什么。', 48),
        16,
        '#334155'
      )
    },
    {
      title: '关键条件',
      body: bodyHtml(
        bullets[1] || compactText(slide.notes, '说明成立条件、对象和边界。', 48),
        16,
        '#334155'
      )
    },
    {
      title: '结构关系',
      body: bodyHtml(
        bullets[2] || buildVisualText(slide),
        16,
        '#334155'
      )
    },
    {
      title: '课堂观察',
      body: `${bodyHtml(
        bullets[3] || compactText(slide.speakerNotes, buildTeachingMove(slide, 0), 48),
        16,
        '#334155'
      )}${bodyHtml(buildTeachingMove(slide, 0), 14, '#64748b')}`
    }
  ];
}

function buildProcessSteps(slide, draft = {}, fields = {}) {
  const fromSlide = buildKeypointRows(slide, fields.keyPoints || []);
  const fromLessonPlan = uniqueList(draft?.lessonPlan?.process || []);
  const defaults = ['提出问题', '抓住条件', '解释机制', '迁移验证'];
  return uniqueList([...fromSlide, ...fromLessonPlan, ...defaults])
    .map((item) => compactText(item, '', 30))
    .slice(0, 4);
}

function buildCompareRows(slide, fields = {}) {
  const rows = buildKeypointRows(slide, fields.keyPoints || []).slice(0, 4);
  return [
    [
      {
        id: 'r1c1',
        colspan: 1,
        rowspan: 1,
        text: '比较维度',
        style: { bold: true, color: '#ffffff', backcolor: '#5b9bd5', fontsize: 15, align: 'center' }
      },
      {
        id: 'r1c2',
        colspan: 1,
        rowspan: 1,
        text: '判断焦点',
        style: { bold: true, color: '#ffffff', backcolor: '#5b9bd5', fontsize: 15, align: 'center' }
      },
      {
        id: 'r1c3',
        colspan: 1,
        rowspan: 1,
        text: '课堂提醒',
        style: { bold: true, color: '#ffffff', backcolor: '#5b9bd5', fontsize: 15, align: 'center' }
      }
    ],
    ...rows.map((item, index) => ([
      {
        id: `r${index + 2}c1`,
        colspan: 1,
        rowspan: 1,
        text: compactText(item, '关键差异', 18),
        style: { bold: true, backcolor: '#eaf2fb', fontsize: 14, align: 'center' }
      },
      {
        id: `r${index + 2}c2`,
        colspan: 1,
        rowspan: 1,
        text: compactText(
          index === 0
            ? '先分清对象、条件和结论'
            : index === 1
              ? '再看共同点与真正的差异点'
              : index === 2
                ? '回到因果链与适用范围'
                : '用反例或追问做最后判断',
          '',
          20
        ),
        style: { fontsize: 14, align: 'left' }
      },
      {
        id: `r${index + 2}c3`,
        colspan: 1,
        rowspan: 1,
        text: compactText(buildTeachingMove(slide, index), '', 22),
        style: { fontsize: 14, align: 'left' }
      }
    ]))
  ];
}

function buildPracticeTasks(slide, fields = {}, draft = {}) {
  const bullets = buildKeypointRows(slide, fields.keyPoints || []);
  const fallbacks = [
    '先独立判断，再和同伴互相解释理由。',
    '把结论放回一个具体情境里重新说明。',
    '用一句话复述条件、过程和结果之间的关系。'
  ];
  return [0, 1, 2].map((index) => compactText(bullets[index], fallbacks[index], 42));
}

function buildMisconceptionCards(slide, fields = {}) {
  const mistakes = uniqueList(slide?.commonMistakes || []).slice(0, 2);
  const bullets = buildKeypointRows(slide, fields.keyPoints || []);
  return [
    {
      title: '误区一',
      body: bodyHtml(
        compactText(mistakes[0], `容易把“${bullets[0] || slide.title || '这一点'}”只记成结论。`, 46),
        16,
        '#334155'
      )
    },
    {
      title: '误区二',
      body: bodyHtml(
        compactText(mistakes[1], '容易忽略条件、对象或适用范围。', 46),
        16,
        '#334155'
      )
    },
    {
      title: '纠偏动作',
      body: listHtml([
        compactText(`回到“${bullets[0] || slide.title || '核心概念'}”的判断条件。`, '', 36),
        compactText(`结合“${slide.example || slide.question || '一个具体情境'}”重新解释。`, '', 36),
        compactText(buildTeachingMove(slide, 0), '', 36)
      ], { size: 15, color: '#334155' })
    }
  ];
}

function buildSummaryItems(slide, draft = {}, fields = {}) {
  const defaults = ['回到核心概念', '复盘关键方法', '迁移到新情境', '明确下一步动作'];
  return uniqueList([
    ...buildKeypointRows(slide, fields.keyPoints || []),
    draft?.lessonPlan?.goals,
    draft?.interactionIdea?.title,
    draft?.lessonPlan?.methods,
    ...defaults
  ])
    .map((item) => compactText(item, '', 42))
    .slice(0, 4);
}

function buildCoverScene({ slide, draft, fields, palette, stageId, order, createdAt }) {
  const metaLine = buildMetaLine({ fields, draft }) || uniqueList(slide.bullets || []).join(' · ');
  const goalsText = compactText(
    fields.goals || draft?.lessonPlan?.goals || slide.notes,
    '明确本节课的核心目标、关键问题和课堂输出。',
    66
  );
  const methodsText = compactText(
    draft?.lessonPlan?.methods || fields.style,
    '讲授 + 互动 + 示例推进',
    44
  );
  const interactionText = compactText(
    fields.interactions || draft?.interactionIdea?.description,
    '预留一个轻量互动环节，帮助学生快速进入主题。',
    60
  );
  const bottomItems = [
    compactText(slide?.question, '核心问题：本节课到底要解决什么？', 42),
    compactText(buildKeypointRows(slide, fields.keyPoints || [])[0], '关键概念：先搭起理解框架。', 42),
    compactText(interactionText, '课堂活动：用一个追问把学生带进来。', 42),
    compactText(draft?.lessonPlan?.homework, '预期输出：课后形成可迁移的知识结构。', 42)
  ];

  const elements = [
    createTextElement({
      left: 60,
      top: 44,
      width: 560,
      height: 88,
      content: titleHtml(slide.title || fields.subject || '教学课件', 40, palette.title),
      defaultColor: palette.title,
      textType: 'title'
    }),
    createTextElement({
      left: 60,
      top: 138,
      width: 520,
      height: 34,
      content: bodyHtml(metaLine || 'AI-Educate', 16, palette.muted, 'left', 0),
      defaultColor: palette.muted,
      textType: 'subtitle'
    }),
    createShapeElement({ left: 60, top: 180, width: 520, height: 222, fill: '#eef7ff' }),
    createShapeElement({ left: 608, top: 180, width: 332, height: 222, fill: '#f8fafc' }),
    createTextElement({
      left: 84,
      top: 206,
      width: 472,
      height: 34,
      content: titleHtml('本课主线', 20, palette.primary),
      defaultColor: palette.primary,
      textType: 'itemTitle'
    }),
    createTextElement({
      left: 84,
      top: 248,
      width: 460,
      height: 128,
      content: `${bodyHtml(goalsText, 18, '#334155')}${listHtml(buildKeypointRows(slide, fields.keyPoints || []).slice(0, 3), { size: 16, color: '#334155' })}`,
      defaultColor: '#334155',
      textType: 'content'
    }),
    createTextElement({
      left: 632,
      top: 206,
      width: 276,
      height: 30,
      content: titleHtml('课堂推进', 18, '#166534'),
      defaultColor: '#166534',
      textType: 'itemTitle'
    }),
    createTextElement({
      left: 632,
      top: 246,
      width: 276,
      height: 54,
      content: bodyHtml(methodsText, 16, '#0f172a'),
      defaultColor: '#0f172a',
      textType: 'content'
    }),
    createTextElement({
      left: 632,
      top: 312,
      width: 276,
      height: 64,
      content: `${bodyHtml(interactionText, 15, '#475569')}${bodyHtml(buildVisualText(slide), 14, '#64748b', 'left', 0)}`,
      defaultColor: '#475569',
      textType: 'content'
    })
  ];

  bottomItems.forEach((item, index) => {
    const x = 60 + index * 225;
    elements.push(...createCardElements({
      left: x,
      top: 430,
      width: 205,
      height: 92,
      fill: ['#ffffff', '#f3f4f6', '#fff7e8', '#eefbf1'][index] || '#ffffff',
      title: ['核心问题', '关键概念', '互动入口', '预期输出'][index] || `模块 ${index + 1}`,
      titleColor: [palette.primary, '#334155', '#92400e', '#166534'][index] || '#334155',
      body: bodyHtml(item, 14, '#334155', 'left', 0)
    }));
  });

  return buildSceneRecord({
    slide,
    stageId,
    order,
    createdAt,
    palette,
    elements,
    layout: 'cover',
    title: slide.title || fields.subject || '课程封面'
  });
}

function buildTocScene({ slide, draft, fields, palette, stageId, order, createdAt }) {
  const agendaItems = buildAgendaItems(draft, fields).slice(0, 6);
  const metaLine = buildMetaLine({ fields, draft });
  const elements = [
    ...createBaseHeader(slide, {
      title: palette.text,
      accent: palette.accent,
      muted: palette.muted
    }, metaLine),
    createShapeElement({ left: 60, top: 176, width: 560, height: 336, fill: '#f8fafc' }),
    createShapeElement({ left: 650, top: 176, width: 290, height: 336, fill: '#ffffff' })
  ];

  agendaItems.forEach((item, index) => {
    const y = 194 + index * 52;
    elements.push(createShapeElement({
      left: 82,
      top: y,
      width: 516,
      height: 40,
      fill: index % 2 === 0 ? '#ffffff' : '#eefbf1'
    }));
    elements.push(createTextElement({
      left: 100,
      top: y + 6,
      width: 42,
      height: 24,
      content: titleHtml(`0${index + 1}`, 18, palette.primary),
      defaultColor: palette.primary,
      textType: 'itemTitle'
    }));
    elements.push(createTextElement({
      left: 152,
      top: y + 6,
      width: 420,
      height: 26,
      content: bodyHtml(item, 16, '#334155', 'left', 0),
      defaultColor: '#334155',
      textType: 'content'
    }));
  });

  elements.push(...createCardElements({
    left: 672,
    top: 194,
    width: 246,
    height: 96,
    fill: '#eefbf1',
    title: '学习目标',
    titleColor: '#166534',
    body: bodyHtml(
      compactText(fields.goals || draft?.lessonPlan?.goals, '围绕核心问题推进学习并形成结构化理解。', 58),
      15,
      '#334155'
    )
  }));
  elements.push(...createCardElements({
    left: 672,
    top: 304,
    width: 246,
    height: 96,
    fill: '#f3f4f6',
    title: '课堂抓手',
    titleColor: '#334155',
    body: listHtml(uniqueList(fields.keyPoints || agendaItems).slice(0, 3).map((item) => compactText(item, '', 24)), { size: 14, color: '#334155' })
  }));
  elements.push(...createCardElements({
    left: 672,
    top: 414,
    width: 246,
    height: 98,
    fill: '#fff7e8',
    title: '输出任务',
    titleColor: '#92400e',
    body: `${bodyHtml(compactText(draft?.interactionIdea?.description, '最后用一个提问或小任务收束课堂。', 54), 14, '#334155')}${bodyHtml(compactText(draft?.lessonPlan?.homework, '课后把本课内容复述成自己的知识卡片。', 54), 14, '#64748b', 'left', 0)}`
  }));

  return buildSceneRecord({
    slide,
    stageId,
    order,
    createdAt,
    palette,
    elements,
    layout: 'toc',
    title: slide.title || '目录'
  });
}

function buildConceptScene({ slide, draft, fields, palette, stageId, order, createdAt }) {
  const modules = buildConceptModules(slide, draft, fields);
  const variant = chooseSceneVariant(slide, order, ['grid', 'rail'], 'concept');
  const elements = [
    ...createBaseHeader(slide, {
      title: palette.text,
      accent: palette.accent,
      muted: palette.muted
    }, slide.teachingGoal || draft?.lessonPlan?.goals || '')
  ];

  if (variant === 'rail') {
    elements.push(createShapeElement({ left: 60, top: 176, width: 410, height: 238, fill: '#eef7ff' }));
    elements.push(createShapeElement({ left: 492, top: 176, width: 448, height: 238, fill: '#ffffff' }));
    elements.push(...createCardElements({
      left: 84,
      top: 198,
      width: 362,
      height: 194,
      fill: '#ffffff',
      title: '核心定义',
      titleColor: palette.primary,
      body: `${modules[0]?.body || ''}${bodyHtml(buildVisualText(slide), 14, '#64748b', 'left', 0)}`
    }));
    elements.push(...createCardElements({
      left: 516,
      top: 198,
      width: 192,
      height: 90,
      fill: '#eefbf1',
      title: modules[1]?.title || '关键条件',
      titleColor: '#166534',
      body: modules[1]?.body || bodyHtml('说明成立条件、对象与边界。', 14, '#334155')
    }));
    elements.push(...createCardElements({
      left: 728,
      top: 198,
      width: 188,
      height: 90,
      fill: '#fff7e8',
      title: '课堂追问',
      titleColor: '#92400e',
      body: bodyHtml(buildQuestionText(slide, fields, draft), 14, '#334155')
    }));
    elements.push(...createCardElements({
      left: 516,
      top: 306,
      width: 400,
      height: 86,
      fill: '#f8fafc',
      title: modules[2]?.title || '结构关系',
      titleColor: '#334155',
      body: modules[2]?.body || bodyHtml('用结构图突出概念之间的连接。', 14, '#334155')
    }));
    [
      {
        title: modules[3]?.title || '课堂观察',
        fill: '#eefbf1',
        titleColor: '#166534',
        body: modules[3]?.body || bodyHtml(buildTeachingMove(slide, 0), 14, '#334155')
      },
      {
        title: '案例落点',
        fill: '#ffffff',
        titleColor: palette.primary,
        body: bodyHtml(buildExampleText(slide, draft), 14, '#334155')
      },
      {
        title: '提示边栏',
        fill: '#f8fafc',
        titleColor: '#334155',
        body: listHtml(buildSupportLines(slide, draft, fields, 3), { size: 13, color: '#334155' })
      }
    ].forEach((item, index) => {
      elements.push(...createCardElements({
        left: 60 + index * 300,
        top: 432,
        width: 270,
        height: 90,
        fill: item.fill,
        title: item.title,
        titleColor: item.titleColor,
        body: item.body
      }));
    });
  } else {
    modules.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 60 + col * 285;
      const y = 176 + row * 156;
      elements.push(...createCardElements({
        left: x,
        top: y,
        width: 255,
        height: 136,
        fill: ['#eefbf1', '#f8fafc', '#fff7e8', '#ffffff'][index] || '#ffffff',
        title: item.title,
        titleColor: [palette.primary, '#334155', '#92400e', '#166534'][index] || '#334155',
        body: item.body
      }));
    });

    elements.push(...createCardElements({
      left: 624,
      top: 176,
      width: 316,
      height: 136,
      fill: '#eefbf1',
      title: '课堂追问',
      titleColor: '#166534',
      body: `${bodyHtml(buildQuestionText(slide, fields, draft), 16, '#334155')}${bodyHtml(buildVisualText(slide), 14, '#64748b', 'left', 0)}`
    }));
    elements.push(...createCardElements({
      left: 624,
      top: 332,
      width: 316,
      height: 136,
      fill: '#fff7e8',
      title: '教师侧提示',
      titleColor: '#92400e',
      body: listHtml(buildSupportLines(slide, draft, fields, 4), { size: 14, color: '#334155' })
    }));
    elements.push(createShapeElement({ left: 60, top: 486, width: 880, height: 36, fill: '#f8fafc' }));
    elements.push(createTextElement({
      left: 80,
      top: 494,
      width: 840,
      height: 20,
      content: bodyHtml(`${buildExampleText(slide, draft)} ｜ ${compactText(buildTeachingMove(slide, 0), '用一个例子把概念落地。', 34)}`, 14, '#475569', 'left', 0),
      defaultColor: '#475569',
      textType: 'notes'
    }));
  }

  return buildSceneRecord({
    slide,
    stageId,
    order,
    createdAt,
    palette,
    elements,
    layout: 'concept',
    variant
  });
}

function buildProcessScene({ slide, draft, fields, palette, stageId, order, createdAt }) {
  const steps = buildProcessSteps(slide, draft, fields);
  const variant = chooseSceneVariant(slide, order, ['timeline', 'ladder'], 'process');
  const elements = [
    ...createBaseHeader(slide, {
      title: palette.text,
      accent: palette.accent,
      muted: palette.muted
    }, slide.teachingGoal || draft?.lessonPlan?.goals || '')
  ];

  if (variant === 'ladder') {
    elements.push(createShapeElement({ left: 76, top: 176, width: 92, height: 346, fill: '#eef7ff' }));
    steps.forEach((item, index) => {
      const top = 188 + index * 82;
      const left = 108 + index * 58;
      elements.push(...createCardElements({
        left,
        top,
        width: 278,
        height: 72,
        fill: ['#eefbf1', '#ffffff', '#fff7e8', '#f8fafc'][index] || '#ffffff',
        title: `步骤 ${index + 1}`,
        titleColor: [palette.primary, '#334155', '#92400e', '#166534'][index] || '#334155',
        body: bodyHtml(item, 14, '#334155', 'left', 0)
      }));
      if (index < steps.length - 1) {
        elements.push(createLineElement({
          left: left + 278,
          top: top + 34,
          start: [0, 0],
          end: [38, 34],
          width: 3,
          color: '#94A3B8'
        }));
      }
    });
    elements.push(...createCardElements({
      left: 470,
      top: 188,
      width: 470,
      height: 178,
      fill: '#f8fafc',
      title: '关键机制 / 转折点',
      titleColor: '#334155',
      body: `${listHtml(buildKeypointRows(slide, fields.keyPoints || []).slice(0, 4), { size: 15, color: '#334155' })}${bodyHtml(buildVisualText(slide), 14, '#64748b', 'left', 0)}`
    }));
    elements.push(...createCardElements({
      left: 470,
      top: 386,
      width: 220,
      height: 136,
      fill: '#eefbf1',
      title: '案例承接',
      titleColor: '#166534',
      body: bodyHtml(buildExampleText(slide, draft), 14, '#334155')
    }));
    elements.push(...createCardElements({
      left: 720,
      top: 386,
      width: 220,
      height: 136,
      fill: '#fff7e8',
      title: '追问检查',
      titleColor: '#92400e',
      body: bodyHtml(buildQuestionText(slide, fields, draft), 14, '#334155')
    }));
  } else {
    steps.forEach((item, index) => {
      const x = 60 + index * 225;
      elements.push(...createCardElements({
        left: x,
        top: 176,
        width: 205,
        height: 122,
        fill: ['#eefbf1', '#f8fafc', '#fff7e8', '#ffffff'][index] || '#ffffff',
        title: `步骤 ${index + 1}`,
        titleColor: [palette.primary, '#334155', '#92400e', '#166534'][index] || '#334155',
        body: `${bodyHtml(item, 15, '#334155')}${bodyHtml(buildTeachingMove(slide, index), 13, '#64748b', 'left', 0)}`
      }));
      if (index < steps.length - 1) {
        elements.push(createLineElement({
          left: x + 205,
          top: 236,
          start: [0, 0],
          end: [20, 0],
          width: 3,
          color: '#94A3B8'
        }));
      }
    });

    elements.push(...createCardElements({
      left: 60,
      top: 330,
      width: 560,
      height: 192,
      fill: '#f8fafc',
      title: '关键机制 / 转折点',
      titleColor: '#334155',
      body: `${listHtml(buildKeypointRows(slide, fields.keyPoints || []).slice(0, 4), { size: 15, color: '#334155' })}${bodyHtml(buildVisualText(slide), 14, '#64748b', 'left', 0)}`
    }));
    elements.push(...createCardElements({
      left: 650,
      top: 330,
      width: 290,
      height: 88,
      fill: '#eefbf1',
      title: '案例承接',
      titleColor: '#166534',
      body: bodyHtml(buildExampleText(slide, draft), 14, '#334155')
    }));
    elements.push(...createCardElements({
      left: 650,
      top: 434,
      width: 290,
      height: 88,
      fill: '#fff7e8',
      title: '追问检查',
      titleColor: '#92400e',
      body: bodyHtml(buildQuestionText(slide, fields, draft), 14, '#334155')
    }));
  }

  return buildSceneRecord({
    slide,
    stageId,
    order,
    createdAt,
    palette,
    elements,
    layout: 'process',
    variant
  });
}

function buildCompareScene({ slide, draft, fields, palette, stageId, order, createdAt }) {
  const latex = buildRelationshipLatex(slide, fields);
  const variant = chooseSceneVariant(slide, order, ['matrix', 'duo'], 'compare');
  const elements = [
    ...createBaseHeader(slide, {
      title: palette.text,
      accent: palette.accent,
      muted: palette.muted
    }, slide.teachingGoal || draft?.lessonPlan?.goals || '')
  ];

  if (variant === 'duo') {
    const bullets = buildKeypointRows(slide, fields.keyPoints || []);
    const halves = chunkList(bullets.slice(0, 4), 2);
    elements.push(...createCardElements({
      left: 60,
      top: 176,
      width: 420,
      height: 166,
      fill: '#eefbf1',
      title: '对照面 A',
      titleColor: '#166534',
      body: `${listHtml((halves[0] || bullets.slice(0, 2)).map((item) => compactText(item, '', 32)), { size: 15, color: '#334155' })}${bodyHtml(buildExampleText(slide, draft), 14, '#64748b', 'left', 0)}`
    }));
    elements.push(...createCardElements({
      left: 520,
      top: 176,
      width: 420,
      height: 166,
      fill: '#f8fafc',
      title: '对照面 B',
      titleColor: palette.primary,
      body: `${listHtml((halves[1] || bullets.slice(2, 4) || buildSupportLines(slide, draft, fields, 2)).map((item) => compactText(item, '', 32)), { size: 15, color: '#334155' })}${bodyHtml(buildQuestionText(slide, fields, draft), 14, '#64748b', 'left', 0)}`
    }));
    elements.push(createTableElement({
      left: 60,
      top: 364,
      width: 700,
      height: 112,
      colWidths: [0.28, 0.32, 0.40],
      data: buildCompareRows(slide, fields).slice(0, 3),
      outline: { width: 2, style: 'solid', color: '#d9e2f3' }
    }));
    elements.push(...createCardElements({
      left: 784,
      top: 364,
      width: 156,
      height: 112,
      fill: '#fff7e8',
      title: '提醒',
      titleColor: '#92400e',
      body: listHtml(buildSupportLines(slide, draft, fields, 3), { size: 12, color: '#334155' })
    }));
  } else {
    elements.push(
      createTableElement({
        left: 60,
        top: 176,
        width: 540,
        height: 288,
        colWidths: [0.28, 0.32, 0.40],
        data: buildCompareRows(slide, fields),
        outline: { width: 2, style: 'solid', color: '#d9e2f3' }
      }),
      ...createCardElements({
        left: 626,
        top: 176,
        width: 314,
        height: 136,
        fill: '#eefbf1',
        title: '情境提示',
        titleColor: '#166534',
        body: `${bodyHtml(buildExampleText(slide, draft), 15, '#334155')}${bodyHtml(buildVisualText(slide), 14, '#64748b', 'left', 0)}`
      }),
      ...createCardElements({
        left: 626,
        top: 328,
        width: 314,
        height: 136,
        fill: '#fff7e8',
        title: '辨析提醒',
        titleColor: '#92400e',
        body: listHtml(buildSupportLines(slide, draft, fields, 4), { size: 14, color: '#334155' })
      })
    );
  }

  elements.push(createLatexElement({
    left: 60,
    top: 482,
    width: 880,
    height: 36,
    latex: latex.latex,
    html: latex.html,
    color: '#111827'
  }));

  return buildSceneRecord({
    slide,
    stageId,
    order,
    createdAt,
    palette,
    elements,
    layout: 'compare',
    variant
  });
}

function buildCaseScene({ slide, draft, fields, palette, stageId, order, createdAt }) {
  const bulletChunks = chunkList(buildKeypointRows(slide, fields.keyPoints || []).slice(0, 4), 2);
  const leftItems = bulletChunks[0] || [];
  const rightItems = bulletChunks[1] || [];
  const variant = chooseSceneVariant(slide, order, ['split', 'evidence'], 'case');
  const elements = [
    ...createBaseHeader(slide, {
      title: palette.text,
      accent: palette.accent,
      muted: palette.muted
    }, slide.teachingGoal || draft?.lessonPlan?.goals || '')
  ];

  if (variant === 'evidence') {
    elements.push(...createCardElements({
      left: 60,
      top: 176,
      width: 330,
      height: 270,
      fill: '#eefbf1',
      title: '案例情境',
      titleColor: '#166534',
      body: `${bodyHtml(buildExampleText(slide, draft), 15, '#334155')}${listHtml(leftItems, { size: 14, color: '#334155' })}`
    }));
    elements.push(...createCardElements({
      left: 414,
      top: 176,
      width: 240,
      height: 270,
      fill: '#f8fafc',
      title: '证据 / 线索',
      titleColor: '#334155',
      body: listHtml((rightItems.length ? rightItems : buildSupportLines(slide, draft, fields, 3)).map((item) => compactText(item, '', 28)), { size: 14, color: '#334155' })
    }));
    elements.push(...createCardElements({
      left: 678,
      top: 176,
      width: 262,
      height: 124,
      fill: '#fff7e8',
      title: '关键判断',
      titleColor: '#92400e',
      body: bodyHtml(compactText(slide.notes, buildTeachingMove(slide, 0), 54), 14, '#334155')
    }));
    elements.push(...createCardElements({
      left: 678,
      top: 322,
      width: 262,
      height: 124,
      fill: '#ffffff',
      title: '迁移提问',
      titleColor: palette.primary,
      body: bodyHtml(buildQuestionText(slide, fields, draft), 14, '#334155')
    }));
    elements.push(createShapeElement({ left: 60, top: 470, width: 880, height: 42, fill: '#f8fafc' }));
    elements.push(createTextElement({
      left: 82,
      top: 480,
      width: 836,
      height: 22,
      content: bodyHtml(`${buildVisualText(slide)} ｜ ${compactText(draft?.interactionIdea?.description, '最后让学生复述案例中的因果链。', 44)}`, 14, '#475569', 'left', 0),
      defaultColor: '#475569',
      textType: 'notes'
    }));
  } else {
    elements.push(...createCardElements({
      left: 60,
      top: 176,
      width: 420,
      height: 206,
      fill: '#eefbf1',
      title: '案例情境',
      titleColor: '#166534',
      body: `${bodyHtml(buildExampleText(slide, draft), 16, '#334155')}${listHtml(leftItems, { size: 15, color: '#334155' })}`
    }));
    elements.push(...createCardElements({
      left: 520,
      top: 176,
      width: 420,
      height: 206,
      fill: '#f8fafc',
      title: '分析抓手',
      titleColor: '#334155',
      body: `${listHtml(rightItems.length ? rightItems : buildSupportLines(slide, draft, fields, 3), { size: 15, color: '#334155' })}${bodyHtml(buildVisualText(slide), 14, '#64748b', 'left', 0)}`
    }));

    [
      {
        title: '关键判断',
        fill: '#fff7e8',
        titleColor: '#92400e',
        body: bodyHtml(compactText(slide.notes, buildTeachingMove(slide, 0), 54), 14, '#334155')
      },
      {
        title: '迁移应用',
        fill: '#ffffff',
        titleColor: palette.primary,
        body: bodyHtml(buildQuestionText(slide, fields, draft), 14, '#334155')
      },
      {
        title: '课堂收口',
        fill: '#eefbf1',
        titleColor: '#166534',
        body: bodyHtml(compactText(draft?.interactionIdea?.description, '最后让学生复述案例中的因果链。', 54), 14, '#334155')
      }
    ].forEach((item, index) => {
      const x = 60 + index * 305;
      elements.push(...createCardElements({
        left: x,
        top: 402,
        width: 270,
        height: 112,
        fill: item.fill,
        title: item.title,
        titleColor: item.titleColor,
        body: item.body
      }));
    });
  }

  return buildSceneRecord({
    slide,
    stageId,
    order,
    createdAt,
    palette,
    elements,
    layout: 'case',
    variant
  });
}

function buildPracticeScene({ slide, draft, fields, palette, stageId, order, createdAt }) {
  const tasks = buildPracticeTasks(slide, fields, draft);
  const tips = uniqueList([
    ...(Array.isArray(slide?.commonMistakes) ? slide.commonMistakes : []),
    compactText(buildTeachingMove(slide, 0), '', 38),
    compactText(buildVisualText(slide), '', 38)
  ]).slice(0, 4);
  const variant = chooseSceneVariant(slide, order, ['rail', 'board'], 'practice');
  const elements = [
    ...createBaseHeader(slide, {
      title: palette.text,
      accent: palette.accent,
      muted: palette.muted
    }, slide.teachingGoal || draft?.lessonPlan?.goals || '')
  ];

  if (variant === 'board') {
    const boardItems = [
      { title: '独立判断', text: tasks[0], fill: '#eefbf1', color: '#166534' },
      { title: '同伴互问', text: tasks[1], fill: '#ffffff', color: palette.primary },
      { title: '全班复述', text: tasks[2], fill: '#fff7e8', color: '#92400e' },
      { title: '追问补强', text: buildQuestionText(slide, fields, draft), fill: '#f8fafc', color: '#334155' }
    ];
    boardItems.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      elements.push(...createCardElements({
        left: 60 + col * 440,
        top: 176 + row * 146,
        width: 400,
        height: 122,
        fill: item.fill,
        title: item.title,
        titleColor: item.color,
        body: bodyHtml(item.text, 15, '#334155')
      }));
    });
    elements.push(...createCardElements({
      left: 60,
      top: 478,
      width: 420,
      height: 44,
      fill: '#ffffff',
      title: '达成标准',
      titleColor: '#334155',
      body: bodyHtml('说清条件、对象、结论，并能改写不准确表达。', 13, '#334155', 'left', 0)
    }));
    elements.push(...createCardElements({
      left: 520,
      top: 478,
      width: 420,
      height: 44,
      fill: '#eefbf1',
      title: '教师提醒',
      titleColor: '#166534',
      body: bodyHtml(tips.join('；') || buildTeachingMove(slide, 0), 13, '#334155', 'left', 0)
    }));
  } else {
    tasks.forEach((task, index) => {
      elements.push(...createCardElements({
        left: 60,
        top: 176 + index * 110,
        width: 580,
        height: 96,
        fill: ['#eefbf1', '#f8fafc', '#fff7e8'][index] || '#ffffff',
        title: `任务 ${index + 1}`,
        titleColor: [palette.primary, '#334155', '#92400e'][index] || '#334155',
        body: bodyHtml(task, 15, '#334155')
      }));
    });

    elements.push(...createCardElements({
      left: 672,
      top: 176,
      width: 268,
      height: 148,
      fill: '#ffffff',
      title: '达成标准',
      titleColor: '#334155',
      body: numberedListHtml([
        '说清条件、对象和结论。',
        '能用本页概念解释一个新情境。',
        '能指出一个常见误区并修正。'
      ], { size: 14, color: '#334155' })
    }));
    elements.push(...createCardElements({
      left: 672,
      top: 340,
      width: 268,
      height: 182,
      fill: '#eefbf1',
      title: '教师提醒',
      titleColor: '#166534',
      body: `${bodyHtml(buildQuestionText(slide, fields, draft), 14, '#334155')}${listHtml(tips, { size: 13, color: '#64748b' })}`
    }));
  }

  return buildSceneRecord({
    slide,
    stageId,
    order,
    createdAt,
    palette,
    elements,
    layout: 'practice',
    variant
  });
}

function buildMisconceptionScene({ slide, draft, fields, palette, stageId, order, createdAt }) {
  const cards = buildMisconceptionCards(slide, fields);
  const variant = chooseSceneVariant(slide, order, ['triad', 'contrast'], 'misconception');
  const elements = [
    ...createBaseHeader(slide, {
      title: palette.text,
      accent: palette.accent,
      muted: palette.muted
    }, slide.teachingGoal || draft?.lessonPlan?.goals || ''),
    createShapeElement({ left: 60, top: 176, width: 880, height: 56, fill: '#fff7e8' }),
    createTextElement({
      left: 84,
      top: 190,
      width: 832,
      height: 26,
      content: bodyHtml('这一页用于辨析最容易混淆的判断点，重点是“为什么错、怎么改”。', 16, '#92400e', 'left', 0),
      defaultColor: '#92400e',
      textType: 'notes'
    })
  ];

  if (variant === 'contrast') {
    elements.push(...createCardElements({
      left: 60,
      top: 250,
      width: 264,
      height: 214,
      fill: '#fff7e8',
      title: '错误直觉',
      titleColor: '#92400e',
      body: cards[0]?.body || bodyHtml('先说出学生最容易冒出来的错误判断。', 15, '#334155')
    }));
    elements.push(...createCardElements({
      left: 368,
      top: 250,
      width: 264,
      height: 214,
      fill: '#ffffff',
      title: '正确路径',
      titleColor: palette.primary,
      body: cards[1]?.body || bodyHtml('把条件、对象和过程重新摆正。', 15, '#334155')
    }));
    elements.push(...createCardElements({
      left: 676,
      top: 250,
      width: 264,
      height: 214,
      fill: '#eefbf1',
      title: '修正表达',
      titleColor: '#166534',
      body: `${cards[2]?.body || ''}${bodyHtml(buildQuestionText(slide, fields, draft), 13, '#64748b', 'left', 0)}`
    }));
  } else {
    cards.forEach((item, index) => {
      const x = 60 + index * 305;
      elements.push(...createCardElements({
        left: x,
        top: 250,
        width: 270,
        height: 214,
        fill: ['#ffffff', '#f8fafc', '#eefbf1'][index] || '#ffffff',
        title: item.title,
        titleColor: [ '#92400e', '#334155', '#166534'][index] || '#334155',
        body: item.body
      }));
    });
  }

  elements.push(createShapeElement({ left: 60, top: 482, width: 880, height: 40, fill: '#f8fafc' }));
  elements.push(createTextElement({
    left: 82,
    top: 490,
    width: 836,
    height: 22,
    content: bodyHtml(`${buildQuestionText(slide, fields, draft)} ｜ ${buildExampleText(slide, draft)}`, 14, '#475569', 'left', 0),
    defaultColor: '#475569',
    textType: 'notes'
  }));

  return buildSceneRecord({
    slide,
    stageId,
    order,
    createdAt,
    palette,
    elements,
    layout: 'misconception',
    variant
  });
}

function buildSummaryScene({ slide, draft, fields, palette, stageId, order, createdAt }) {
  const items = buildSummaryItems(slide, draft, fields);
  const titles = ['核心概念', '关键方法', '迁移场景', '行动提醒'];
  const homework = compactText(draft?.lessonPlan?.homework, '课后把本课要点整理成自己的知识卡片。', 58);
  const interaction = compactText(
    draft?.interactionIdea?.description || fields.interactions,
    '预留 3 分钟同伴互问，快速检验是否真正理解。',
    58
  );
  const variant = chooseSceneVariant(slide, order, ['grid', 'hub'], 'summary');
  const elements = [
    ...createBaseHeader(slide, {
      title: palette.text,
      accent: palette.accent,
      muted: palette.muted
    }, '把本课内容压缩成可复述、可迁移、可执行的四个锚点。')
  ];

  if (variant === 'hub') {
    elements.push(createShapeElement({ left: 60, top: 184, width: 300, height: 244, fill: '#eef7ff' }));
    elements.push(...createCardElements({
      left: 84,
      top: 208,
      width: 252,
      height: 196,
      fill: '#ffffff',
      title: '一句话收束',
      titleColor: palette.primary,
      body: `${bodyHtml(items[0] || '回到核心概念，完成完整复述。', 17, '#334155')}${bodyHtml(items[1] || '再用方法和条件支撑结论。', 15, '#64748b', 'left', 0)}`
    }));
    [
      { left: 390, top: 184, title: titles[0], text: items[0], fill: '#eefbf1', color: '#166534' },
      { left: 666, top: 184, title: titles[1], text: items[1], fill: '#ffffff', color: '#334155' },
      { left: 390, top: 316, title: titles[2], text: items[2], fill: '#fff7e8', color: '#92400e' },
      { left: 666, top: 316, title: titles[3], text: items[3], fill: '#f8fafc', color: palette.primary }
    ].forEach((item) => {
      elements.push(...createCardElements({
        left: item.left,
        top: item.top,
        width: 250,
        height: 112,
        fill: item.fill,
        title: item.title,
        titleColor: item.color,
        body: bodyHtml(item.text || '带走一个能复述、能迁移的要点。', 14, '#334155')
      }));
    });
    elements.push(...createCardElements({
      left: 60,
      top: 450,
      width: 420,
      height: 72,
      fill: '#eefbf1',
      title: '课后延伸',
      titleColor: '#166534',
      body: bodyHtml(homework, 13, '#334155', 'left', 0)
    }));
    elements.push(...createCardElements({
      left: 520,
      top: 450,
      width: 420,
      height: 72,
      fill: '#f8fafc',
      title: '课堂收口动作',
      titleColor: palette.primary,
      body: bodyHtml(interaction, 13, '#334155', 'left', 0)
    }));
  } else {
    items.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 60 + col * 460;
      const y = 176 + row * 142;
      elements.push(...createCardElements({
        left: x,
        top: y,
        width: 420,
        height: 122,
        fill: ['#eefbf1', '#f8fafc', '#fff7e8', '#ffffff'][index] || '#ffffff',
        title: titles[index] || `带走 ${index + 1}`,
        titleColor: [ '#166534', '#334155', '#92400e', palette.primary ][index] || '#334155',
        body: bodyHtml(item, 16, '#334155')
      }));
    });

    elements.push(...createCardElements({
      left: 60,
      top: 462,
      width: 420,
      height: 60,
      fill: '#eefbf1',
      title: '课后延伸',
      titleColor: '#166534',
      body: bodyHtml(homework, 13, '#334155', 'left', 0)
    }));
    elements.push(...createCardElements({
      left: 520,
      top: 462,
      width: 420,
      height: 60,
      fill: '#f8fafc',
      title: '课堂收口动作',
      titleColor: palette.primary,
      body: bodyHtml(interaction, 13, '#334155', 'left', 0)
    }));
  }

  return buildSceneRecord({
    slide,
    stageId,
    order,
    createdAt,
    palette,
    elements,
    layout: 'summary',
    variant,
    title: slide.title || '总结与反思'
  });
}

function chooseContentLayout(slide, index) {
  const explicit = `${slide?.layout || ''}`.trim().toLowerCase();
  if (CONTENT_LAYOUTS.has(explicit)) return explicit;

  const text = [
    slide?.title,
    ...(Array.isArray(slide?.bullets) ? slide.bullets : []),
    slide?.question,
    slide?.example,
    slide?.notes
  ]
    .filter(Boolean)
    .join(' ');

  if (/(流程|步骤|过程|机制|路径|循环|顺序|链路|演变)/.test(text)) return 'process';
  if (uniqueList(slide?.commonMistakes || []).length >= 2 || /(易错|误区|纠偏|陷阱)/.test(text)) return 'misconception';
  if (/(案例|应用|实验|场景|实例|素材|拓展|综合|分析)/.test(text)) return 'case';
  if (/(练习|任务|讨论|互动|探究|思考|自测|抢答|活动|提问)/.test(text)) return 'practice';
  if (/(比较|对比|异同|区别|分类|优缺点|相同|不同|辨析)/.test(text)) return 'compare';
  if (slide?.example && index % 2 === 1) return 'case';
  if (slide?.question && index % 3 === 2) return 'practice';
  return index % 4 === 1 ? 'case' : 'concept';
}

function buildSceneFromSlide(slide, context) {
  if (slide?.type === 'cover') return buildCoverScene(context);
  if (slide?.type === 'toc') return buildTocScene(context);
  if (slide?.type === 'summary') return buildSummaryScene(context);

  const layout = chooseContentLayout(slide, context.order - 1);
  if (layout === 'process') return buildProcessScene(context);
  if (layout === 'compare') return buildCompareScene(context);
  if (layout === 'case') return buildCaseScene(context);
  if (layout === 'practice') return buildPracticeScene(context);
  if (layout === 'misconception') return buildMisconceptionScene(context);
  return buildConceptScene(context);
}

function buildClassroomFromDraft(draft, options = {}) {
  if (!draft || !Array.isArray(draft.ppt) || draft.ppt.length === 0) return null;

  const state = options.state || {};
  const fields = state.fields || {};
  const createdAt = Date.now();
  const stageId = options.stageId || `classroom_${nanoid(10)}`;
  const palette = {
    ...normalizeTheme(draft.theme || {}, draft.designPreset || ''),
    style: draft.designPreset || ''
  };

  const raw = {
    id: stageId,
    name: fields.subject || draft.ppt[0]?.title || '教学课件',
    description: fields.goals || draft?.lessonPlan?.goals || '',
    language: 'zh-CN',
    style: draft.designPreset || '',
    createdAt,
    updatedAt: createdAt,
    stage: {
      id: stageId,
      name: fields.subject || draft.ppt[0]?.title || '教学课件',
      description: fields.goals || draft?.lessonPlan?.goals || '',
      language: 'zh-CN',
      style: draft.designPreset || '',
      createdAt,
      updatedAt: createdAt,
      theme: buildCanvasTheme(palette, palette.style),
      fields: { ...fields },
      lessonPlan: draft.lessonPlan || null,
      interactionIdea: draft.interactionIdea || null
    },
    scenes: draft.ppt.map((slide, index) => {
      const order = index + 1;
      const sceneCreatedAt = createdAt + index;
      return buildSceneFromSlide(slide, {
        slide,
        draft,
        fields,
        palette,
        stageId,
        order,
        createdAt: sceneCreatedAt
      });
    })
  };

  return normalizeClassroom(raw, {
    draft,
    state,
    source: options.source || 'local'
  });
}

function buildClassroomFromState(state, options = {}) {
  if (!state?.draft) return null;
  return buildClassroomFromDraft(state.draft, {
    ...options,
    state
  });
}

module.exports = {
  buildClassroomFromDraft,
  buildClassroomFromState,
  escapeHtml,
  CLASSROOM_VIEWPORT_SIZE,
  CLASSROOM_VIEWPORT_HEIGHT
};
