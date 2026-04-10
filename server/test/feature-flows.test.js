const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const { Document, Packer, Paragraph } = require('docx');

const { shouldParseFile, extractDocumentText, enrichUploadedFile } = require('../upload/parser');
const { createSessionStore } = require('../store/session-store');
const { searchKnowledge } = require('../rag');
const { normalizeSlideRange, applyScopedEditFallback } = require('../ppt/edit');
const { exportDocx } = require('../export/docx');

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function writeDocx(filePath, paragraphs) {
  const document = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs.map((text) => new Paragraph(text))
      }
    ]
  });

  const buffer = await Packer.toBuffer(document);
  fs.writeFileSync(filePath, buffer);
}

async function writePptx(filePath, slides) {
  const zip = new JSZip();
  slides.forEach((slideText, index) => {
    zip.file(
      `ppt/slides/slide${index + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
        xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:txBody>
                <a:p><a:r><a:t>${slideText}</a:t></a:r></a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:sld>`
    );
  });

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(filePath, buffer);
}

function createSampleDraft() {
  return {
    designPreset: 'corporate',
    theme: {
      primary: '#1F3B73',
      accent: '#4C8BF5',
      background: '#F8FAFC',
      text: '#0F172A',
      font: 'Microsoft YaHei'
    },
    layoutHints: ['cover_right_panel'],
    lessonPlan: {
      goals: '理解光合作用的条件和过程',
      process: ['情境导入', '实验观察', '归纳总结'],
      methods: '讲授与探究结合',
      activities: '小组讨论',
      homework: '完成课后练习'
    },
    interactionIdea: {
      title: '课堂抢答',
      description: '围绕影响因素做分组抢答'
    },
    ppt: [
      {
        id: 'slide-1',
        title: '光合作用',
        type: 'cover',
        bullets: ['初二生物', '45 分钟'],
        example: '',
        question: '',
        visual: '',
        notes: '',
        teachingGoal: '',
        speakerNotes: '',
        commonMistakes: [],
        citations: []
      },
      {
        id: 'slide-2',
        title: '光合作用的条件',
        type: 'content',
        bullets: ['需要光', '需要二氧化碳', '叶绿体参与'],
        example: '',
        question: '',
        visual: '',
        notes: '',
        teachingGoal: '理解条件',
        speakerNotes: '',
        commonMistakes: [],
        citations: ['upload:lesson-doc']
      },
      {
        id: 'slide-3',
        title: '课堂总结',
        type: 'summary',
        bullets: ['回顾条件', '串联过程'],
        example: '',
        question: '',
        visual: '',
        notes: '',
        teachingGoal: '',
        speakerNotes: '',
        commonMistakes: [],
        citations: []
      }
    ],
    updatedAt: new Date().toISOString()
  };
}

test('upload parser extracts text from supported files and annotates upload metadata', async (t) => {
  const tempDir = createTempDir('ai-educate-parser-');
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  assert.equal(shouldParseFile({ name: 'lesson.docx' }), true);
  assert.equal(shouldParseFile({ name: 'slides.pptx' }), true);
  assert.equal(shouldParseFile({ name: 'image.png' }), false);

  const docxPath = path.join(tempDir, 'lesson.docx');
  await writeDocx(docxPath, ['光合作用需要光能', '叶绿体是进行光合作用的场所']);

  const docxText = await extractDocumentText({ name: 'lesson.docx', diskPath: docxPath });
  assert.match(docxText, /光合作用需要光能/);

  const enrichedDocx = await enrichUploadedFile({
    id: 'file-1',
    sourceId: 'upload:lesson-doc',
    name: 'lesson.docx',
    diskPath: docxPath
  });
  assert.equal(enrichedDocx.status, 'parsed');
  assert.ok(enrichedDocx.chunkCount >= 1);
  assert.match(enrichedDocx.parseSummary, /光合作用/);

  const pptxPath = path.join(tempDir, 'lesson.pptx');
  await writePptx(pptxPath, ['导入：复习旧知', '探究：观察叶片实验']);

  const pptxText = await extractDocumentText({ name: 'lesson.pptx', diskPath: pptxPath });
  assert.match(pptxText, /观察叶片实验/);

  const unsupported = await enrichUploadedFile({
    id: 'file-2',
    sourceId: 'upload:image',
    name: 'cover.png',
    diskPath: path.join(tempDir, 'cover.png')
  });
  assert.equal(unsupported.status, 'uploaded');
  assert.match(unsupported.parseSummary, /暂未自动解析/);
});

test('session store persists sessions to json files and reloads them', (t) => {
  const tempDir = createTempDir('ai-educate-sessions-');
  t.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  let counter = 0;
  const createInitialState = () => ({
    id: `session-${counter += 1}`,
    fields: { subject: '', keyPoints: [] },
    brief: {},
    aiDecision: {},
    uploadedFiles: [],
    rag: []
  });

  const store = createSessionStore(createInitialState, { sessionsDir: tempDir });
  const session = store.getSession();
  session.state.fields.subject = '光合作用';
  session.state.fields.keyPoints = ['光反应'];
  session.messages.push({ role: 'user', text: '生成一份课件', ts: Date.now() });
  store.saveSession(session);
  const filePath = path.join(tempDir, `${session.id}.json`);
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  raw.state.openmaic = { status: 'running', classroomUrl: 'http://127.0.0.1:3001/classroom/1' };
  fs.writeFileSync(filePath, JSON.stringify(raw, null, 2));

  const reloadedStore = createSessionStore(createInitialState, { sessionsDir: tempDir });
  const loaded = reloadedStore.getById(session.id);

  assert.ok(loaded);
  assert.equal(loaded.id, session.id);
  assert.equal(loaded.state.fields.subject, '光合作用');
  assert.deepEqual(loaded.state.fields.keyPoints, ['光反应']);
  assert.equal(Object.prototype.hasOwnProperty.call(loaded.state, 'openmaic'), false);
  assert.equal(loaded.messages.length, 1);
  assert.equal(loaded.messages[0].text, '生成一份课件');
  assert.ok(fs.existsSync(filePath));
});

test('searchKnowledge includes parsed uploaded files in rag results', () => {
  const results = searchKnowledge('蓝鲸方程', 4, [
    {
      id: 'upload-1',
      sourceId: 'upload:blue-whale',
      name: '自定义资料.docx',
      status: 'parsed',
      parsedText: '课堂暗号 蓝鲸方程 用于验证上传资料检索是否生效。'
    }
  ]);

  assert.ok(results.length >= 1);
  assert.equal(results[0].sourceType, 'upload');
  assert.equal(results[0].sourceId, 'upload:blue-whale');
  assert.equal(results[0].source, '自定义资料.docx');
  assert.match(results[0].summary, /蓝鲸方程/);
});

test('normalizeSlideRange and scoped fallback edits only affect requested slides', () => {
  const draft = createSampleDraft();

  assert.deepEqual(normalizeSlideRange('2-2', draft.ppt.length), { start: 1, end: 1 });
  assert.deepEqual(normalizeSlideRange([1, 3], draft.ppt.length), { start: 0, end: 2 });
  assert.equal(normalizeSlideRange('0-2', draft.ppt.length), null);
  assert.equal(normalizeSlideRange('abc', draft.ppt.length), null);

  const edited = applyScopedEditFallback(draft, {
    scope: 'slides',
    instruction: '补一个案例并增加互动提问',
    slideRange: { start: 1, end: 1 }
  });

  assert.equal(edited.ppt[0].example, '');
  assert.match(edited.ppt[1].example, /案例/);
  assert.match(edited.ppt[1].question, /互动提问/);
  assert.equal(edited.ppt[2].question, '');
});

test('exportDocx writes a non-empty lesson plan document', async (t) => {
  const draft = createSampleDraft();
  const result = await exportDocx(draft, 'lesson-plan-smoke', {
    fields: {
      subject: '光合作用',
      grade: '初二',
      duration: '45 分钟',
      goals: '理解光合作用条件',
      keyPoints: ['光照', '叶绿体']
    },
    rag: [
      {
        sourceId: 'upload:lesson-doc',
        source: 'lesson.docx',
        summary: '讲义摘要：强调光照、二氧化碳和叶绿体。'
      }
    ]
  });

  assert.ok(result);
  assert.match(result.fileName, /^lesson-plan-smoke-.*\.docx$/);
  assert.ok(fs.existsSync(result.filePath));
  assert.ok(fs.statSync(result.filePath).size > 0);

  t.after(() => {
    fs.rmSync(result.filePath, { force: true });
  });
});
