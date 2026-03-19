<template>
  <section class="ppt-live-page" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- Collapsed mini sidebar -->
    <aside v-if="sidebarCollapsed" class="ppt-live-minibar">
      <button class="minibar-btn" title="展开侧边栏" @click="sidebarCollapsed = false">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 4l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="minibar-divider"></div>
      <button class="minibar-btn" title="返回整理页" @click="goBack">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 14l-5-5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="minibar-btn" title="重新排版" :disabled="!draft" @click="handleRegenerateScene">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M15 9a6 6 0 11-1.5-3.96" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15 3v3.5h-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <button class="minibar-btn" title="导出 PPT" @click="handleExport">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v9M5.5 8.5L9 12l3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 14h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
      <div class="minibar-spacer"></div>
      <div class="minibar-page-count">{{ slideCount }}</div>
    </aside>

    <!-- Full sidebar -->
    <aside v-else class="ppt-live-sidebar shell-card">
      <div class="sidebar-head-row">
        <span class="panel-kicker">生成页</span>
        <button class="sidebar-collapse-btn" title="收起侧边栏" @click="sidebarCollapsed = true">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="ppt-live-intro">
        <h1>{{ draft ? 'PPT 已生成' : '正在生成 PPT' }}</h1>
        <p>{{ pageDescription }}</p>
      </div>

      <div class="ppt-live-status-card">
        <div class="ppt-live-status-row">
          <span>当前状态</span>
          <strong>{{ stageStatusText }}</strong>
        </div>
        <div class="ppt-live-status-grid">
          <div>
            <span>页面数量</span>
            <strong>{{ slideCount }} 页</strong>
          </div>
          <div>
            <span>资料数量</span>
            <strong>{{ files.length }} 份</strong>
          </div>
        </div>
        <p>{{ summarySnippet }}</p>
      </div>

      <div v-if="recognizedFields.length" class="ppt-live-fields-card">
        <span class="ppt-live-label">课程信息</span>
        <div class="ppt-live-fields-list">
          <div v-for="item in recognizedFields" :key="item.label" class="ppt-live-field-item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </div>

      <div class="ppt-live-actions">
        <button class="ghost" type="button" @click="goBack">返回整理页</button>
        <button class="secondary" type="button" :disabled="!draft" @click="handleRegenerateScene">
          重新排版
        </button>
      </div>

      <label v-if="draft" class="ppt-live-section">
        <span class="ppt-live-label">继续调整</span>
        <textarea
          v-model="followup"
          rows="4"
          placeholder="继续补充课堂风格、页面重点或要调整的内容。"
          @keydown.enter.exact.prevent="handleFollowup"
        ></textarea>
      </label>

      <button v-if="draft" class="secondary" type="button" :disabled="!canFollowup" @click="handleFollowup">
        调整当前 PPT
      </button>

      <div class="ppt-live-feed">
        <div class="ppt-live-feed-head">
          <span class="ppt-live-label">处理记录</span>
          <strong>{{ recentMessages.length }} 条</strong>
        </div>
        <div class="ppt-live-feed-list">
          <article
            v-for="(message, index) in recentMessages"
            :key="message.id || `${message.role}-${index}`"
            class="ppt-live-feed-item"
            :class="message.role"
          >
            <span>{{ message.role === 'user' ? '你' : 'AI' }}</span>
            <p>{{ message.text }}</p>
          </article>
        </div>
      </div>
    </aside>

    <section class="ppt-live-stage">
      <div v-if="showEmptyState" class="ppt-live-empty shell-card">
        <strong>请先在整理页完成需求整理，再点击"生成PPT"。</strong>
        <p>生成页只负责展示 PPT 生成过程和最终预览，不负责整理课程需求。</p>
        <button class="primary" type="button" @click="goBack">返回整理页</button>
      </div>

      <SlideCanvas
        v-else
        :draft="draft"
        :scene="scene"
        :scene-status="sceneStatus"
        :fields="fields"
        @update-block="handleUpdateBlock"
        @add-slide="handleAddSlide"
        @delete-slide="handleDeleteSlide"
        @duplicate-slide="handleDuplicateSlide"
        @regenerate-slide="handleRegenerateSlide"
        @export="handleExport"
      />
    </section>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SlideCanvas from '../components/SlideCanvas.vue';
import { useWorkspace } from '../composables/useWorkspace';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const route = useRoute();
const router = useRouter();
const followup = ref('');
const sidebarCollapsed = ref(false);
const autostartHandled = ref(false);

const {
  draft,
  fields,
  files,
  handleConfirm,
  handleExport,
  handleRegenerateScene,
  handleSend,
  initWorkspace,
  isAutoGenerating,
  isBusy,
  messages,
  scene,
  sceneStatus,
  summary,
  intent,
  workspacePhase
} = useWorkspace();

initWorkspace();

const slideCount = computed(() => scene.value?.slides?.length || draft.value?.ppt?.length || 0);
const canFollowup = computed(() => followup.value.trim().length > 0 && !isBusy.value && !isAutoGenerating.value);
const showEmptyState = computed(() => !draft.value && !intent.value?.ready && !isBusy.value && !isAutoGenerating.value);
const pageDescription = computed(() => {
  if (showEmptyState.value) return '请先返回整理页，把需求整理完整后再发起生成。';
  if (draft.value) return '右侧画布中的每个页面都可以直接点击编辑。';
  return '正在根据整理页中的课程信息生成 PPT，请稍候。';
});
const stageStatusText = computed(() => {
  if (isAutoGenerating.value || isBusy.value) return '正在生成 PPT';
  if (sceneStatus.value === 'generating') return '正在补全页面';
  if (draft.value) return 'PPT 已生成';
  return workspacePhase.value;
});
const summarySnippet = computed(() => {
  if (!summary.value || summary.value === '暂无') return '生成前会在这里显示当前课程摘要。';
  return summary.value.split('\n').slice(0, 3).join(' · ');
});
const recentMessages = computed(() => messages.value.slice(-6));
const recognizedFields = computed(() => {
  const items = [
    { label: '主题', value: fields.value.subject },
    { label: '年级', value: fields.value.grade },
    { label: '时长', value: fields.value.duration },
    { label: '目标', value: fields.value.goals },
    {
      label: '知识点',
      value: Array.isArray(fields.value.keyPoints) ? fields.value.keyPoints.join('、') : fields.value.keyPoints
    }
  ];
  return items.filter((item) => `${item.value || ''}`.trim());
});

// --- Slide editing handlers ---

const handleUpdateBlock = (data) => {
  const slides = scene.value?.slides || draft.value?.ppt;
  if (!slides || !slides[data.slideIndex]) return;

  const slide = slides[data.slideIndex];
  const blocks = slide.blocks || [];
  const block = blocks.find((b) => b.id === data.blockId);
  if (!block) return;

  if (data.field === 'items') {
    block.items = data.value;
  } else {
    block[data.field] = data.value;
  }

  // Update slide title if the title block was edited
  if (block.type === 'title' && data.field === 'text') {
    slide.title = data.value;
  }
};

const handleAddSlide = ({ after, type }) => {
  const slides = scene.value?.slides || draft.value?.ppt;
  if (!slides) return;

  const newSlide = {
    id: uid(),
    title: '新页面',
    role: 'content',
    variant: 'concept',
    background: { type: 'solid', color: '#F8FAFC' },
    blocks: [
      { id: `b-${Date.now()}-1`, type: 'title', title: '', text: '新页面', items: [], box: {} },
      { id: `b-${Date.now()}-2`, type: 'bullets', title: '', text: '', items: ['要点一', '要点二', '要点三'], box: {} }
    ],
    notes: ''
  };

  slides.splice(after + 1, 0, newSlide);
};

const handleDeleteSlide = (index) => {
  const slides = scene.value?.slides || draft.value?.ppt;
  if (!slides || slides.length <= 1) return;
  slides.splice(index, 1);
};

const handleDuplicateSlide = (index) => {
  const slides = scene.value?.slides || draft.value?.ppt;
  if (!slides || !slides[index]) return;

  const source = slides[index];
  const duplicate = JSON.parse(JSON.stringify(source));
  duplicate.id = uid();
  duplicate.title = `${source.title}（副本）`;
  if (duplicate.blocks) {
    duplicate.blocks.forEach((b) => { b.id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; });
  }
  slides.splice(index + 1, 0, duplicate);
};

const handleRegenerateSlide = (index) => {
  // For now, triggers full scene regeneration
  handleRegenerateScene();
};

const handleFollowup = async () => {
  const text = followup.value.trim();
  if (!text || isBusy.value || isAutoGenerating.value) return;
  followup.value = '';
  await handleSend(text, { autoGenerate: false });
};

const goBack = async () => {
  await router.push({ name: 'workspace' });
};

watch(
  () => [route.query.autostart, intent.value?.ready, Boolean(draft.value), isBusy.value],
  async ([autostart, ready, hasDraft, busy]) => {
    if (autostart !== '1' || autostartHandled.value || !ready || hasDraft || busy) return;
    autostartHandled.value = true;
    await handleConfirm();
    await router.replace({ name: 'ppt-live' });
  },
  { immediate: true }
);
</script>

<style scoped>
.ppt-live-page {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 0;
  min-height: 100vh;
}

.ppt-live-page.sidebar-collapsed {
  grid-template-columns: 56px minmax(0, 1fr);
}

/* Collapsed mini sidebar */
.ppt-live-minibar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  gap: 4px;
  background: rgba(255, 255, 255, 0.95);
  border-right: 1px solid rgba(40, 49, 78, 0.08);
  backdrop-filter: blur(16px);
}

.minibar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, color 0.15s;
}

.minibar-btn:hover {
  background: rgba(101, 138, 228, 0.1);
  color: #658AE4;
  transform: none;
}

.minibar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.minibar-divider {
  width: 24px;
  height: 1px;
  background: rgba(40, 49, 78, 0.1);
  margin: 4px 0;
}

.minibar-spacer {
  flex: 1;
}

.minibar-page-count {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  padding-bottom: 4px;
}

/* Full sidebar */
.sidebar-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, color 0.15s;
}

.sidebar-collapse-btn:hover {
  background: rgba(101, 138, 228, 0.1);
  color: #658AE4;
  transform: none;
}

.ppt-live-sidebar {
  display: grid;
  align-content: start;
  gap: 14px;
  border-radius: 0;
  border-right: 1px solid rgba(40, 49, 78, 0.08);
  position: sticky;
  top: 0;
  max-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  min-width: 0;
}

.ppt-live-stage {
  min-height: 100vh;
  background: #f1f3f8;
  overflow-y: auto;
}

.ppt-live-intro {
  display: grid;
  gap: 8px;
}

.ppt-live-intro h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
}

.ppt-live-intro p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.ppt-live-section,
.ppt-live-status-card,
.ppt-live-fields-card,
.ppt-live-feed,
.ppt-live-empty {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid rgba(40, 49, 78, 0.08);
  background: rgba(255, 255, 255, 0.78);
}

.ppt-live-label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.ppt-live-section textarea {
  min-height: 0;
  resize: none;
  font-size: 14px;
  line-height: 1.6;
}

.ppt-live-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.ppt-live-status-row,
.ppt-live-feed-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ppt-live-status-row span,
.ppt-live-status-grid span,
.ppt-live-field-item span,
.ppt-live-feed-head strong {
  color: var(--muted);
  font-size: 12px;
}

.ppt-live-status-row strong,
.ppt-live-status-grid strong,
.ppt-live-field-item strong {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}

.ppt-live-status-grid,
.ppt-live-fields-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ppt-live-status-grid div,
.ppt-live-field-item {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(247, 247, 248, 0.92);
}

.ppt-live-status-card p,
.ppt-live-empty p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.ppt-live-feed {
  min-height: 0;
  overflow: hidden;
}

.ppt-live-feed-list {
  min-height: 0;
  max-height: 200px;
  overflow-y: auto;
  display: grid;
  gap: 10px;
}

.ppt-live-feed-item {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(247, 247, 248, 0.92);
}

.ppt-live-feed-item.user {
  background: rgba(161, 254, 239, 0.2);
}

.ppt-live-feed-item span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

.ppt-live-feed-item p,
.ppt-live-empty strong {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
}

@media (max-width: 1180px) {
  .ppt-live-page,
  .ppt-live-page.sidebar-collapsed {
    grid-template-columns: 1fr;
  }

  .ppt-live-minibar {
    display: none;
  }

  .sidebar-collapse-btn {
    display: none;
  }

  .ppt-live-sidebar {
    position: static;
    max-height: none;
    border-right: none;
    border-bottom: 1px solid rgba(40, 49, 78, 0.08);
  }

  .ppt-live-stage {
    min-height: auto;
  }
}

@media (max-width: 720px) {
  .ppt-live-status-grid,
  .ppt-live-fields-list,
  .ppt-live-actions {
    grid-template-columns: 1fr;
  }

  .ppt-live-feed-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
