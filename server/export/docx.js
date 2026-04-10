const fs = require('fs');
const path = require('path');
const {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} = require('docx');

const EXPORT_DIR = path.join(__dirname, '..', '..', 'data', 'exports');

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

function text(value = '') {
  return `${value || ''}`.trim();
}

function bulletList(items = []) {
  return items
    .filter(Boolean)
    .map((item) => new Paragraph({
      text: item,
      bullet: { level: 0 }
    }));
}

function heading(title, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    text: title,
    heading: level,
    spacing: { before: 240, after: 120 }
  });
}

function bodyText(value) {
  return new Paragraph({
    text: value || '暂无',
    spacing: { after: 120 }
  });
}

function buildReferenceParagraphs(rag = []) {
  if (!Array.isArray(rag) || !rag.length) {
    return [bodyText('暂无引用资料')];
  }

  return rag.map((item, index) => new Paragraph({
    children: [
      new TextRun({ text: `${index + 1}. ${item.source}`, bold: true }),
      new TextRun({ text: `\n${item.summary || item.content || ''}` })
    ],
    spacing: { after: 140 }
  }));
}

function buildSlideOutlineParagraphs(slides = []) {
  if (!Array.isArray(slides) || !slides.length) {
    return [bodyText('暂无课件页概览')];
  }

  return slides.map((slide, index) => new Paragraph({
    children: [
      new TextRun({ text: `${index + 1}. ${slide.title || '未命名页面'}`, bold: true }),
      new TextRun({
        text: slide.bullets?.length
          ? `\n${slide.bullets.join('；')}`
          : '\n暂无要点'
      })
    ],
    spacing: { after: 140 }
  }));
}

async function exportDocx(draft, fileBaseName = 'lesson', options = {}) {
  if (!draft || !Array.isArray(draft.ppt) || !draft.ppt.length) return null;
  ensureExportDir();

  const fields = options.fields || {};
  const rag = Array.isArray(options.rag) ? options.rag : [];
  const fileName = `${fileBaseName}-${Date.now()}.docx`;
  const filePath = path.join(EXPORT_DIR, fileName);

  const sections = [
    heading(fields.subject || draft.ppt[0]?.title || '教学教案', HeadingLevel.TITLE),
    bodyText(`年级/学段：${text(fields.grade) || '未填写'}`),
    bodyText(`课堂时长：${text(fields.duration) || '未填写'}`),

    heading('教学目标'),
    bodyText(text(draft.lessonPlan?.goals || fields.goals) || '待补充'),

    heading('核心知识点'),
    ...bulletList(Array.isArray(fields.keyPoints) ? fields.keyPoints : []),

    heading('教学过程'),
    ...bulletList(Array.isArray(draft.lessonPlan?.process) ? draft.lessonPlan.process : []),

    heading('课堂活动'),
    bodyText(text(draft.lessonPlan?.activities) || '待补充'),

    heading('课后作业'),
    bodyText(text(draft.lessonPlan?.homework) || '待补充'),

    heading('互动设计'),
    bodyText(text(draft.interactionIdea?.title) || '待补充'),
    bodyText(text(draft.interactionIdea?.description) || '待补充'),

    heading('课件页概览'),
    ...buildSlideOutlineParagraphs(draft.ppt),

    heading('参考资料'),
    ...buildReferenceParagraphs(rag)
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: sections
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
  return { filePath, fileName };
}

module.exports = {
  exportDocx
};
