<template>
  <section class="panel intent">
    <div class="panel-title">
      <div>
        <h2>教学需求</h2>
        <p class="panel-subtitle">结构化填写后同步到对话，便于模型理解</p>
      </div>
      <div class="intent-status" :class="statusClass">
        {{ statusText }}
      </div>
    </div>

    <div class="intent-alert" v-if="missingFieldLabels.length">
      待补充：{{ missingFieldLabels.join('、') }}
    </div>

    <form class="form-grid" @submit.prevent>
      <label class="field">
        <span>主题/章节</span>
        <input v-model="form.subject" type="text" placeholder="例如：光合作用" />
      </label>
      <label class="field">
        <span>年级/学段</span>
        <input v-model="form.grade" type="text" placeholder="例如：初二" />
      </label>
      <label class="field">
        <span>课堂时长</span>
        <input v-model="form.duration" type="text" placeholder="例如：45分钟" />
      </label>
      <label class="field">
        <span>教学目标</span>
        <input v-model="form.goals" type="text" placeholder="例如：理解光合作用原理" />
      </label>
      <label class="field field-full">
        <span>核心知识点</span>
        <textarea v-model="form.keyPoints" rows="2" placeholder="例如：光反应，暗反应"></textarea>
      </label>
      <label class="field">
        <span>教学风格（可选）</span>
        <input v-model="form.style" type="text" placeholder="例如：探究式/案例式" />
      </label>
      <label class="field">
        <span>互动设计（可选）</span>
        <input v-model="form.interactions" type="text" placeholder="例如：分组讨论/抢答" />
      </label>
    </form>

    <div class="form-actions">
      <button class="primary" @click="submit">同步到对话</button>
      <button class="secondary" @click="reset">清空表单</button>
    </div>
  </section>
</template>

<script setup>
import { computed, reactive, watch } from 'vue';

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
  },
  onReset: {
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

const form = reactive({
  subject: '',
  grade: '',
  duration: '',
  goals: '',
  keyPoints: '',
  style: '',
  interactions: ''
});

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

const submit = () => {
  if (!props.onSubmit) return;
  const payload = buildPayloadText();
  if (!payload) return;
  props.onSubmit(payload);
};

const reset = () => {
  form.subject = '';
  form.grade = '';
  form.duration = '';
  form.goals = '';
  form.keyPoints = '';
  form.style = '';
  form.interactions = '';
  if (props.onReset) props.onReset();
};
</script>
