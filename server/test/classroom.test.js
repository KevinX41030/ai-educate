const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildClassroomFromDraft } = require('../classroom/generator');
const { writeClassroomPptx } = require('../classroom/export');

function createDraftFixture() {
  return {
    designPreset: 'classroom',
    theme: {
      primary: '#5B9BD5',
      accent: '#22C55E',
      background: '#FFFFFF',
      text: '#1F2937',
      muted: '#475569',
      font: 'Microsoft YaHei'
    },
    lessonPlan: {
      goals: '理解光合作用的过程与课堂讲法',
      process: ['导入', '建构', '练习', '总结'],
      methods: '讲授 + 互动',
      activities: '随堂追问',
      homework: '整理课堂笔记并完成练习'
    },
    interactionIdea: {
      title: '快速抢答',
      description: '围绕核心问题做 3 轮追问。'
    },
    ppt: [
      {
        id: 'slide-cover',
        title: '光合作用',
        type: 'cover',
        bullets: ['初二', '45分钟'],
        notes: '从植物为什么能制造食物切入。'
      },
      {
        id: 'slide-toc',
        title: '目录',
        type: 'toc',
        bullets: ['导入问题', '概念辨析', '核心过程', '案例分析', '课堂任务', '常见误区']
      },
      {
        id: 'slide-content-concept',
        title: '导入问题',
        type: 'content',
        layout: 'concept',
        bullets: ['植物为何能制造有机物', '阳光在这里起什么作用', '叶片为什么重要'],
        example: '从一盆绿植的生长变化切入。',
        question: '如果没有阳光，植物还能持续制造有机物吗？'
      },
      {
        id: 'slide-content-compare',
        title: '概念辨析',
        type: 'content',
        layout: 'compare',
        bullets: ['原料与产物不能混淆', '能量变化和物质变化要分开看', '条件与结果要成对判断'],
        example: '拿“施肥”和“见光”做对比提问。',
        question: '学生最容易把哪两组概念混在一起？',
        citations: ['upload:1']
      },
      {
        id: 'slide-content-process',
        title: '核心过程',
        type: 'content',
        layout: 'process',
        bullets: ['原料进入叶片', '光能转化', '合成有机物并释放氧气'],
        example: '结合叶绿体结构图讲解。',
        question: '哪个环节最适合停下来追问学生？'
      },
      {
        id: 'slide-content-case',
        title: '案例分析',
        type: 'content',
        layout: 'case',
        bullets: ['温室大棚为什么要控制光照', '叶片颜色变化说明了什么', '如何把现象和概念对上'],
        example: '用大棚蔬菜生长情况做情境分析。',
        question: '如果学生只会背结论，怎么把他拉回现象？'
      },
      {
        id: 'slide-content-practice',
        title: '课堂任务',
        type: 'content',
        layout: 'practice',
        bullets: ['先独立判断材料中的条件', '再和同伴解释推理过程', '最后用一句话复述完整链路'],
        question: '哪一个步骤最能暴露学生是否真的理解？'
      },
      {
        id: 'slide-content-misconception',
        title: '常见误区',
        type: 'content',
        layout: 'misconception',
        bullets: ['把土壤当成食物来源', '只记结论不看条件', '会说名词但不会解释过程'],
        commonMistakes: ['把土壤当成食物来源', '只记结论不看条件', '会说名词但不会解释过程'],
        question: '如果学生答对结论但说不清原因，应该怎么追问？'
      },
      {
        id: 'slide-summary',
        title: '总结与反思',
        type: 'summary',
        bullets: ['回到核心问题', '复述完整过程', '迁移到新情境'],
        notes: '最后留一个课后观察任务。'
      }
    ]
  };
}

test('buildClassroomFromDraft produces classroom-native scenes and elements', () => {
  const classroom = buildClassroomFromDraft(createDraftFixture(), {
    state: {
      fields: {
        subject: '光合作用',
        grade: '初二',
        duration: '45分钟',
        goals: '理解光合作用的过程与课堂讲法',
        keyPoints: ['导入问题', '核心过程']
      }
    }
  });

  assert.ok(classroom);
  assert.equal(classroom.stage.name, '光合作用');
  assert.equal(classroom.scenes.length, 9);
  assert.ok(classroom.scenes.every((scene) => scene.content?.canvas?.elements?.length > 0));
  assert.ok(classroom.scenes.some((scene) => scene.slideMeta?.layout === 'compare'));
  assert.ok(classroom.scenes.some((scene) => scene.slideMeta?.layout === 'process'));
  assert.ok(classroom.scenes.some((scene) => scene.slideMeta?.layout === 'case'));
  assert.ok(classroom.scenes.some((scene) => scene.slideMeta?.layout === 'practice'));
  assert.ok(classroom.scenes.some((scene) => scene.slideMeta?.layout === 'misconception'));
  assert.ok(classroom.scenes.filter((scene) => scene.slideMeta?.layout && !['cover', 'toc', 'summary'].includes(scene.slideMeta.layout)).every((scene) => typeof scene.slideMeta?.variant === 'string' && scene.slideMeta.variant));
  const compareScene = classroom.scenes.find((scene) => scene.slideMeta?.layout === 'compare');
  const processScene = classroom.scenes.find((scene) => scene.slideMeta?.layout === 'process');
  assert.ok(compareScene?.content.canvas.elements.some((element) => element.type === 'table'));
  assert.ok(compareScene?.content.canvas.elements.some((element) => element.type === 'latex'));
  assert.ok(processScene?.content.canvas.elements.some((element) => element.type === 'line'));
});

test('writeClassroomPptx writes a non-empty pptx file from classroom', async () => {
  const classroom = buildClassroomFromDraft(createDraftFixture(), {
    state: {
      fields: {
        subject: '光合作用',
        grade: '初二',
        duration: '45分钟',
        goals: '理解光合作用的过程与课堂讲法',
        keyPoints: ['导入问题', '核心过程']
      }
    }
  });
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-educate-classroom-'));
  const filePath = path.join(tempDir, 'classroom-export.pptx');

  try {
    const result = await writeClassroomPptx(classroom, filePath);
    assert.ok(result);
    assert.equal(fs.existsSync(filePath), true);
    assert.ok(fs.statSync(filePath).size > 0);
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('buildClassroomFromDraft distributes repeated practice slides across visual variants', () => {
  const draft = {
    designPreset: 'classroom',
    theme: {
      primary: '#5B9BD5',
      accent: '#22C55E',
      background: '#FFFFFF',
      text: '#1F2937',
      muted: '#475569',
      font: 'Microsoft YaHei'
    },
    lessonPlan: {
      goals: '理解并表达',
      process: ['导入', '判断', '互问', '复述'],
      methods: '讲授 + 互动',
      activities: '互问',
      homework: '复盘'
    },
    interactionIdea: {
      title: '互问复述',
      description: '先判断，再互问，再复述。'
    },
    ppt: [
      { id: 'cover', title: '封面', type: 'cover', bullets: ['初二'] },
      { id: 'toc', title: '目录', type: 'toc', bullets: ['任务一', '任务二', '任务三'] },
      { id: 'p1', title: '课堂任务一', type: 'content', layout: 'practice', bullets: ['任务1', '任务2', '任务3'], question: 'q1' },
      { id: 'p2', title: '课堂任务二', type: 'content', layout: 'practice', bullets: ['任务1', '任务2', '任务3'], question: 'q2' },
      { id: 'p3', title: '课堂任务三', type: 'content', layout: 'practice', bullets: ['任务1', '任务2', '任务3'], question: 'q3' },
      { id: 'summary', title: '总结', type: 'summary', bullets: ['回顾'] }
    ]
  };

  const classroom = buildClassroomFromDraft(draft, {
    state: {
      fields: {
        subject: '测试主题',
        grade: '初二',
        duration: '45分钟',
        goals: '理解并表达',
        keyPoints: ['任务'],
        interactions: '互问'
      }
    }
  });

  const practiceVariants = classroom.scenes
    .filter((scene) => scene.slideMeta?.layout === 'practice')
    .map((scene) => scene.slideMeta?.variant)
    .filter(Boolean);

  assert.ok(practiceVariants.length >= 3);
  assert.ok(new Set(practiceVariants).size >= 2);
});
