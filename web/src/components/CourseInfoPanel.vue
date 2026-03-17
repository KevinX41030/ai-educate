<template>
  <section class="course-panel">
    <div class="course-panel-head">
      <span class="panel-kicker">当前课程</span>
      <h2>{{ fields.subject || '等待输入课程主题' }}</h2>
      <p>{{ hintText }}</p>
    </div>

    <div class="course-overview-grid">
      <article v-for="item in overviewItems" :key="item.label" class="overview-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </article>
    </div>

    <div v-if="missingFieldLabels.length" class="course-warning-card">
      <span>待补全</span>
      <div class="course-warning-tags">
        <strong v-for="label in missingFieldLabels" :key="label">{{ label }}</strong>
      </div>
    </div>

    <div class="course-summary-card">
      <div class="course-section-title">课程摘要</div>
      <p v-for="line in summaryLines" :key="line">{{ line }}</p>
    </div>

    <div class="course-files-card">
      <div class="course-section-title">资料</div>
      <div v-if="files.length" class="course-file-list">
        <div v-for="file in files" :key="file.id" class="course-file-item">
          <span>{{ file.name }}</span>
          <small>{{ formatSize(file.size) }}</small>
        </div>
      </div>
      <p v-else class="course-empty-text">还没有上传资料，可以在中间对话区拖入文档。</p>
    </div>

    <div class="course-actions">
      <button class="ghost" type="button" @click="handleReset">重新开始</button>
      <button class="primary" type="button" :disabled="!draft" @click="handleExportClick">{{ exportLabel }}</button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  fields: {
    type: Object,
    default: () => ({})
  },
  summary: {
    type: String,
    default: '暂无'
  },
  files: {
    type: Array,
    default: () => []
  },
  missingFieldLabels: {
    type: Array,
    default: () => []
  },
  draft: {
    type: Object,
    default: null
  },
  exportLabel: {
    type: String,
    default: '导出可编辑版'
  },
  onReset: {
    type: Function,
    default: null
  },
  onExport: {
    type: Function,
    default: null
  }
});

const overviewItems = computed(() => [
  { label: '年级 / 学段', value: props.fields.grade || '待补充' },
  { label: '课堂时长', value: props.fields.duration || '待补充' },
  { label: '教学风格', value: props.fields.style || '待补充' },
  { label: '互动设计', value: props.fields.interactions || '待补充' }
]);

const summaryLines = computed(() =>
  `${props.summary || '暂无'}`
    .split('\n')
    .filter(Boolean)
    .slice(0, 4)
);

const hintText = computed(() => {
  if (props.fields.goals) return props.fields.goals;
  return '左侧持续同步课程关键信息，方便你随时确认当前备课上下文。';
});

const handleReset = () => {
  if (props.onReset) props.onReset();
};

const handleExportClick = () => {
  if (props.onExport) props.onExport();
};

const formatSize = (size = 0) => {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};
</script>

<style scoped>
.course-panel {
  display: grid;
  gap: 16px;
}

.course-panel-head {
  display: grid;
  gap: 8px;
}

.course-panel-head :deep(.panel-kicker) {
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.course-panel-head h2 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.course-panel-head p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

.course-overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.overview-card,
.course-summary-card,
.course-files-card,
.course-warning-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.overview-card span,
.course-section-title,
.course-warning-card span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.overview-card strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
}

.course-warning-card {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.16);
}

.course-warning-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.course-warning-tags strong {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: #b45309;
  font-size: 11px;
}

.course-summary-card p,
.course-empty-text {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

.course-file-list {
  display: grid;
  gap: 8px;
}

.course-file-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 12px;
  border-radius: 8px;
  background: rgba(241, 245, 249, 0.9);
}

.course-file-item span,
.course-file-item small {
  line-height: 1.45;
}

.course-file-item small {
  color: var(--muted);
  font-size: 12px;
}

.course-actions {
  display: grid;
  gap: 8px;
}

@media (max-width: 720px) {
  .course-overview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
