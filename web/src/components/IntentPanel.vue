<template>
  <section class="intent-panel">
    <div class="panel-head">
      <div>
        <span class="panel-kicker">Step 1 · 需求采集</span>
        <h2>先把这节课的核心信息告诉我</h2>
        <p>不必像填后台表单那样拘谨，按真实备课思路输入即可，系统会自动整理成结构化需求。</p>
      </div>

      <div class="intent-status-card" :class="statusClass">
        <small>当前状态</small>
        <strong>{{ statusText }}</strong>
        <span>{{ statusHint }}</span>
      </div>
    </div>

    <div v-if="missingFieldLabels.length" class="intent-alert-card">
      <span>待补全</span>
      <div class="missing-tags">
        <strong v-for="label in missingFieldLabels" :key="label">{{ label }}</strong>
      </div>
    </div>

    <div class="intent-layout">
      <div class="intent-main">
        <label class="field-card field-card-hero">
          <span>这节课想讲什么？</span>
          <input v-model="form.subject" type="text" placeholder="例如：光合作用 / 水的蒸发现象 / 人工智能基础" />
        </label>

        <div class="field-grid">
          <div class="field-card">
            <div class="field-heading">
              <span>适用年级</span>
              <small>先选常用范围，也可以继续自定义</small>
            </div>
            <div class="chip-group">
              <button
                v-for="option in gradeOptions"
                :key="option"
                type="button"
                class="choice-chip"
                :class="{ active: form.grade === option }"
                @click="form.grade = option"
              >
                {{ option }}
              </button>
            </div>
            <input v-model="form.grade" type="text" placeholder="例如：小学三年级 / 初二" />
          </div>

          <div class="field-card">
            <div class="field-heading">
              <span>课堂时长</span>
              <small>优先用标准课时，便于后续自动拆页</small>
            </div>
            <div class="chip-group">
              <button
                v-for="option in durationOptions"
                :key="option"
                type="button"
                class="choice-chip"
                :class="{ active: form.duration === option }"
                @click="form.duration = option"
              >
                {{ option }}
              </button>
            </div>
            <input v-model="form.duration" type="text" placeholder="例如：45分钟 / 1课时" />
          </div>
        </div>

        <label class="field-card field-card-full">
          <div class="field-heading">
            <span>教学目标</span>
            <small>说清学生学完后要“理解什么、会做什么、能表达什么”</small>
          </div>
          <textarea
            v-model="form.goals"
            rows="4"
            placeholder="例如：理解蒸发的基本原理；能完成对比实验并记录现象；能总结影响蒸发快慢的因素"
          ></textarea>
        </label>

        <div class="field-card field-card-full">
          <div class="field-heading">
            <span>核心知识点</span>
            <small>先点选常用提示词，再补充你的专属知识点</small>
          </div>
          <div class="chip-group wrap">
            <button
              v-for="option in keyPointOptions"
              :key="option"
              type="button"
              class="choice-chip"
              :class="{ active: listIncludes(form.keyPoints, option) }"
              @click="toggleMultiField('keyPoints', option)"
            >
              {{ option }}
            </button>
          </div>
          <textarea v-model="form.keyPoints" rows="2" placeholder="例如：蒸发条件，对比实验，变量控制"></textarea>
        </div>

        <div class="field-grid">
          <div class="field-card">
            <div class="field-heading">
              <span>教学风格</span>
              <small>系统会据此调整语气、版式和案例组织方式</small>
            </div>
            <div class="chip-group wrap">
              <button
                v-for="option in styleOptions"
                :key="option"
                type="button"
                class="choice-chip"
                :class="{ active: form.style === option }"
                @click="form.style = option"
              >
                {{ option }}
              </button>
            </div>
            <input v-model="form.style" type="text" placeholder="例如：实验探究 / 案例式 / 轻互动" />
          </div>

          <div class="field-card">
            <div class="field-heading">
              <span>互动设计</span>
              <small>可以多选，系统会在教案和页面中一起体现</small>
            </div>
            <div class="chip-group wrap">
              <button
                v-for="option in interactionOptions"
                :key="option"
                type="button"
                class="choice-chip"
                :class="{ active: listIncludes(form.interactions, option) }"
                @click="toggleMultiField('interactions', option)"
              >
                {{ option }}
              </button>
            </div>
            <input v-model="form.interactions" type="text" placeholder="例如：分组讨论，课堂投票，成果展示" />
          </div>
        </div>
      </div>

      <aside class="intent-side">
        <div class="insight-card">
          <div class="insight-card-head">
            <strong>快速模板</strong>
            <span>一键带入示例</span>
          </div>
          <button
            v-for="template in templates"
            :key="template.name"
            type="button"
            class="template-card"
            @click="applyTemplate(template)"
          >
            <strong>{{ template.name }}</strong>
            <small>{{ template.note }}</small>
          </button>
        </div>

        <div class="insight-card">
          <div class="insight-card-head">
            <strong>结构化预览</strong>
            <span>同步前先确认一下</span>
          </div>
          <div class="snapshot-list">
            <div v-for="item in snapshotItems" :key="item.label" class="snapshot-item">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <div class="form-actions">
      <button class="secondary" type="button" @click="applyTemplate(templates[0])">试试示例</button>
      <div class="action-group">
        <button class="ghost" type="button" @click="clearLocal">清空当前填写</button>
        <button class="primary" type="button" @click="submit">同步给 AI 助手</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, watch } from 'vue';
import { lessonPresets } from '../constants/lessonPresets';

const props = defineProps({
  fields: {
    type: Object,
    default: () => ({})
  },
  intent: {
    type: Object,
    default: null
  },
  onSubmit: {
    type: Function,
    default: null
  }
});

const FIELD_LABELS = {
  subject: '主题/章节',
  grade: '年级/学段',
  duration: '课堂时长',
  goals: '教学目标',
  keyPoints: '核心知识点',
  style: '教学风格',
  interactions: '互动设计'
};

const gradeOptions = ['小学低段', '小学中段', '小学高段', '初中', '高中'];
const durationOptions = ['20分钟', '30分钟', '40分钟', '45分钟', '60分钟'];
const keyPointOptions = ['核心概念', '过程步骤', '案例迁移', '实验观察', '易错辨析'];
const styleOptions = ['实验探究', '案例讲解', '项目式学习', '趣味互动', '公开课表达'];
const interactionOptions = ['分组讨论', '课堂提问', '实验操作', '成果展示', '课堂投票'];
const templates = lessonPresets;

const form = reactive({
  subject: '',
  grade: '',
  duration: '',
  goals: '',
  keyPoints: '',
  style: '',
  interactions: ''
});

const toList = (value) => `${value || ''}`
  .split(/[，,、\n]/)
  .map((item) => item.trim())
  .filter(Boolean);

const listIncludes = (value, token) => toList(value).includes(token);

const syncFromFields = (fields = {}) => {
  form.subject = fields.subject || '';
  form.grade = fields.grade || '';
  form.duration = fields.duration || '';
  form.goals = fields.goals || '';
  form.keyPoints = Array.isArray(fields.keyPoints) ? fields.keyPoints.join('，') : fields.keyPoints || '';
  form.style = fields.style || '';
  form.interactions = fields.interactions || '';
};

watch(
  () => props.fields,
  (value) => syncFromFields(value),
  { immediate: true, deep: true }
);

const missingFieldLabels = computed(() =>
  (props.intent?.missingFields || []).map((field) => FIELD_LABELS[field] || field)
);

const statusText = computed(() => {
  if (props.intent?.confirmed) return '已确认';
  if (props.intent?.ready) return '待确认';
  return '待补充';
});

const statusClass = computed(() => {
  if (props.intent?.confirmed) return 'success';
  if (props.intent?.ready) return 'warn';
  return 'muted';
});

const statusHint = computed(() => {
  if (props.intent?.confirmed) return '课件可继续预览和导出';
  if (props.intent?.ready) return '关键信息齐全，可以去右侧确认生成';
  return '继续补足目标、知识点和互动方式';
});

const snapshotItems = computed(() => [
  { label: '主题', value: form.subject || '待填写' },
  { label: '年级', value: form.grade || '待填写' },
  { label: '课时', value: form.duration || '待填写' },
  { label: '目标', value: form.goals || '待填写' },
  { label: '知识点', value: form.keyPoints || '待填写' },
  { label: '互动', value: form.interactions || '待填写' }
]);

const toggleMultiField = (field, option) => {
  const values = toList(form[field]);
  form[field] = values.includes(option)
    ? values.filter((item) => item !== option).join('，')
    : [...values, option].join('，');
};

const buildPayloadText = () => {
  const lines = [];
  if (form.subject) lines.push(`主题: ${form.subject}`);
  if (form.grade) lines.push(`年级: ${form.grade}`);
  if (form.duration) lines.push(`时长: ${form.duration}`);
  if (form.goals) lines.push(`目标: ${form.goals}`);
  if (form.keyPoints) lines.push(`知识点: ${form.keyPoints}`);
  if (form.style) lines.push(`风格: ${form.style}`);
  if (form.interactions) lines.push(`互动: ${form.interactions}`);
  return lines.join('\n');
};

const clearLocal = () => {
  form.subject = '';
  form.grade = '';
  form.duration = '';
  form.goals = '';
  form.keyPoints = '';
  form.style = '';
  form.interactions = '';
};

const applyTemplate = (template) => {
  if (!template) return;
  syncFromFields(template.fields);
};

const submit = () => {
  if (!props.onSubmit) return;
  const payload = buildPayloadText();
  if (!payload) return;
  props.onSubmit(payload);
};
</script>

<style scoped>
.intent-panel {
  display: grid;
  gap: 22px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}

.panel-head h2 {
  margin: 8px 0 8px;
  font-size: 28px;
  line-height: 1.2;
}

.panel-head p {
  margin: 0;
  max-width: 620px;
  color: var(--muted);
  line-height: 1.7;
}

.intent-status-card {
  min-width: 200px;
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 20px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
}

.intent-status-card small {
  color: var(--muted);
}

.intent-status-card strong {
  font-size: 18px;
}

.intent-status-card span {
  color: var(--muted);
  line-height: 1.6;
  font-size: 13px;
}

.intent-status-card.success {
  background: rgba(36, 200, 165, 0.12);
  border-color: rgba(36, 200, 165, 0.28);
}

.intent-status-card.warn {
  background: rgba(255, 184, 77, 0.15);
  border-color: rgba(255, 184, 77, 0.3);
}

.intent-alert-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 184, 77, 0.12);
  border: 1px solid rgba(255, 184, 77, 0.26);
}

.intent-alert-card > span {
  font-weight: 700;
  color: var(--ink);
}

.intent-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 18px;
}

.intent-main {
  display: grid;
  gap: 18px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.field-card {
  display: grid;
  gap: 14px;
  padding: 20px;
  border-radius: 24px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.field-card-hero span {
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}

.field-card-hero input {
  min-height: 56px;
  font-size: 18px;
}

.field-card-full {
  width: 100%;
}

.field-heading {
  display: grid;
  gap: 6px;
}

.field-heading span {
  font-weight: 700;
}

.field-heading small {
  color: var(--muted);
  line-height: 1.5;
}

.chip-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.choice-chip {
  padding: 10px 14px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid rgba(91, 108, 255, 0.16);
  color: var(--ink);
  font-size: 13px;
  box-shadow: none;
}

.choice-chip.active {
  background: linear-gradient(135deg, rgba(91, 108, 255, 0.12), rgba(124, 77, 255, 0.15));
  border-color: rgba(91, 108, 255, 0.34);
  color: var(--primary-strong);
}

.intent-side {
  display: grid;
  gap: 18px;
}

.insight-card {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(245, 247, 255, 0.92));
  border: 1px solid var(--border);
}

.insight-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.insight-card-head strong {
  font-size: 16px;
}

.insight-card-head span {
  color: var(--muted);
  font-size: 12px;
}

.template-card {
  display: grid;
  gap: 6px;
  text-align: left;
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  box-shadow: none;
}

.template-card strong {
  font-size: 14px;
}

.template-card small {
  color: var(--muted);
  line-height: 1.5;
}

.snapshot-list {
  display: grid;
  gap: 10px;
}

.snapshot-item {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(91, 108, 255, 0.06);
}

.snapshot-item span {
  color: var(--muted);
  font-size: 12px;
}

.snapshot-item strong {
  line-height: 1.5;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
}

.action-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

@media (max-width: 1120px) {
  .intent-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .panel-head,
  .form-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }

  .action-group {
    width: 100%;
    justify-content: stretch;
  }

  .action-group > * {
    flex: 1;
  }
}
</style>
