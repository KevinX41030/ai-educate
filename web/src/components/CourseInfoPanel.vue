<template>
  <section class="course-panel">
    <div class="course-overview-grid">
      <label
        v-for="item in overviewItems"
        :key="item.key"
        class="overview-card course-field"
        :class="{ featured: item.featured, wide: item.wide }"
      >
        <span>{{ item.label }}</span>
        <textarea
          v-if="item.multiline"
          :value="getFieldValue(item.key)"
          :rows="item.rows || 3"
          :placeholder="item.placeholder"
          @input="updateField(item.key, $event.target.value)"
        ></textarea>
        <input
          v-else
          type="text"
          :value="getFieldValue(item.key)"
          :placeholder="item.placeholder"
          @input="updateField(item.key, $event.target.value)"
        />
      </label>
    </div>

    <div class="course-summary-card">
      <div class="course-section-title">课程摘要</div>
      <p v-for="line in summaryLines" :key="line">{{ line }}</p>
    </div>

    <div class="course-files-card">
      <div class="course-section-title">资料</div>
      <div v-if="files.length" class="course-file-list">
        <div v-for="file in files" :key="file.id" class="course-file-item">
          <strong>{{ file.name }}</strong>
          <small>{{ formatStatus(file.status) }} · {{ formatSize(file.size) }}<template v-if="file.chunkCount"> · {{ file.chunkCount }} 段</template></small>
          <small>{{ file.parseSummary || '已上传，等待后续处理。' }}</small>
        </div>
      </div>
      <p v-else class="course-empty-text">还没有上传资料，可以在中间对话区拖入文档。</p>
    </div>

    <div class="course-actions">
      <button class="ghost" type="button" @click="handleReset">重新开始</button>
      <button
        v-if="(draft || classroom) && onExport"
        class="secondary"
        type="button"
        @click="handleExportClick"
      >
        {{ exportLabel }}
      </button>
      <button
        v-if="draft && onExportDocx"
        class="secondary"
        type="button"
        @click="handleExportDocxClick"
      >
        导出教案
      </button>
      <button class="primary" type="button" :disabled="!canGenerate" @click="handleGenerateClick">{{ generateLabel }}</button>
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
  draft: {
    type: Object,
    default: null
  },
  classroom: {
    type: Object,
    default: null
  },
  exportLabel: {
    type: String,
    default: '导出PPT'
  },
  canGenerate: {
    type: Boolean,
    default: false
  },
  generateLabel: {
    type: String,
    default: '生成PPT'
  },
  onReset: {
    type: Function,
    default: null
  },
  onGenerate: {
    type: Function,
    default: null
  },
  onExport: {
    type: Function,
    default: null
  },
  onExportDocx: {
    type: Function,
    default: null
  },
  onUpdateField: {
    type: Function,
    default: null
  }
});

const overviewItems = computed(() => [
  { key: 'subject', label: '课程主题', placeholder: '输入课程主题', featured: true },
  { key: 'grade', label: '年级 / 学段', placeholder: '如：五年级 / 初二' },
  { key: 'duration', label: '课堂时长', placeholder: '如：40 分钟' },
  { key: 'goals', label: '教学目标', placeholder: '输入本节课希望达成的目标', multiline: true, wide: true },
  { key: 'keyPoints', label: '核心知识点', placeholder: '输入知识点，用逗号或换行分隔', multiline: true, wide: true },
  { key: 'style', label: '教学风格', placeholder: '如：启发式、案例式、轻松一些' },
  { key: 'interactions', label: '互动设计', placeholder: '如：分组讨论、随堂提问、小游戏' }
]);

const summaryLines = computed(() =>
  `${props.summary || '暂无'}`
    .split('\n')
    .filter(Boolean)
    .slice(0, 4)
);

const handleReset = () => {
  if (props.onReset) props.onReset();
};

const handleGenerateClick = () => {
  if (props.onGenerate) props.onGenerate();
};

const handleExportClick = () => {
  if (props.onExport) props.onExport();
};

const handleExportDocxClick = () => {
  if (props.onExportDocx) props.onExportDocx();
};

const getFieldValue = (key) => {
  const value = props.fields?.[key];
  if (key === 'keyPoints') {
    return Array.isArray(value) ? value.join('、') : `${value || ''}`;
  }
  return `${value || ''}`;
};

const updateField = (key, value) => {
  if (props.onUpdateField) props.onUpdateField(key, value);
};

const formatSize = (size = 0) => {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const formatStatus = (status = '') => {
  if (status === 'parsed') return '已解析';
  if (status === 'failed') return '解析失败';
  return '已上传';
};
</script>

<style scoped>
.course-panel {
  display: grid;
  gap: 16px;
}

.course-overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.overview-card.featured {
  grid-column: 1 / -1;
}

.course-field.wide {
  grid-column: 1 / -1;
}

.overview-card,
.course-summary-card,
.course-files-card {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.overview-card span,
.course-section-title {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.course-field input,
.course-field textarea {
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  color: #172033;
}

.course-field textarea {
  min-height: 70px;
  resize: none;
  overflow-y: auto;
}

.course-field input::placeholder,
.course-field textarea::placeholder {
  color: #9aa6bb;
}

.course-field input:focus,
.course-field textarea:focus {
  border: none;
  background: transparent;
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
  display: grid;
  gap: 4px;
  padding: 11px 12px;
  border-radius: 8px;
  background: rgba(241, 245, 249, 0.9);
}

.course-file-item strong,
.course-file-item small {
  line-height: 1.45;
}

.course-file-item strong {
  font-size: 14px;
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
