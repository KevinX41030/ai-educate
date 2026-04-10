<template>
  <section class="ppt-live-page" :style="pageGridStyle">
    <!-- Sidebar wrapper with drag handle -->
    <aside
      class="ppt-live-sidebar-wrap"
      :class="{ 'is-collapsed': isCollapsed, 'is-dragging': isDragging }"
      :style="{ width: sidebarWidth + 'px' }"
    >
      <!-- Collapsed mini sidebar -->
      <div v-if="isCollapsed" class="ppt-live-minibar">
        <button class="minibar-btn" title="展开侧边栏" @click="expandSidebar">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 4l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="minibar-divider"></div>
        <button class="minibar-btn" title="刷新预览" :disabled="!draft" @click="handleRegenerateScene">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M15 9a6 6 0 11-1.5-3.96" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15 3v3.5h-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="minibar-btn" title="导出 PPT" :disabled="!(draft || displayClassroom)" @click="handleExport">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v9M5.5 8.5L9 12l3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 14h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <button class="minibar-btn" title="导出教案" :disabled="!draft" @click="handleExportDocx">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M5 3.5h5l3 3V14a1 1 0 01-1 1H5.8a.8.8 0 01-.8-.8V4.3a.8.8 0 01.8-.8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 3.5V7h3" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6.8 10.2h4.6M6.8 12.5h4.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </button>
        <div class="minibar-spacer"></div>
        <div class="minibar-page-count">{{ slideCount }}</div>
      </div>

      <!-- Full sidebar content -->
      <div v-else class="ppt-live-sidebar shell-card">
        <div class="sidebar-head-row">
          <span class="panel-kicker">生成页</span>
          <button class="sidebar-collapse-btn" title="收起侧边栏" @click="collapseSidebar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="ppt-live-intro">
          <h1>{{ pageTitle }}</h1>
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
            <div
              v-for="item in recognizedFields"
              :key="item.label"
              class="ppt-live-field-item"
              :class="{ 'field-full': isLongField(item) }"
            >
              <span>{{ item.label }}</span>
              <strong :title="item.value">{{ item.value }}</strong>
            </div>
          </div>
        </div>

        <div class="ppt-live-actions">
          <button class="ghost" type="button" @click="goBack">返回整理页</button>
          <button
            v-if="canResumeGeneration"
            class="primary"
            type="button"
            @click="handleResumeGeneration"
          >
            继续生成
          </button>
          <button class="secondary" type="button" :disabled="!draft" @click="handleRegenerateScene">
            刷新预览
          </button>
          <button class="secondary" type="button" :disabled="!draft" @click="handleExportDocx">
            导出教案
          </button>
        </div>

        <div v-if="draft" class="ppt-live-edit-grid">
          <label class="ppt-live-inline-field">
            <span class="ppt-live-label">修改范围</span>
            <select v-model="editScope">
              <option value="all">整套课件</option>
              <option value="toc">目录页</option>
              <option value="slides">指定页面</option>
              <option value="lesson_plan">教案</option>
              <option value="interaction">互动设计</option>
            </select>
          </label>

          <label v-if="editScope === 'slides'" class="ppt-live-inline-field">
            <span class="ppt-live-label">页码范围</span>
            <input v-model="editSlideRange" type="text" placeholder="如 3-5 或 4" />
          </label>
        </div>

        <label v-if="draft" class="ppt-live-section">
          <span class="ppt-live-label">继续调整</span>
          <textarea
            v-model="followup"
            rows="4"
            :placeholder="followupPlaceholder"
            @keydown.enter.exact.prevent="handleFollowup"
          ></textarea>
        </label>

        <button v-if="draft" class="secondary" type="button" :disabled="!canFollowup" @click="handleFollowup">
          应用定向修改
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
      </div>

      <!-- Drag handle -->
      <div
        class="sidebar-drag-handle"
        @mousedown.prevent="startDrag"
        @dblclick="toggleSidebar"
      >
        <div class="drag-handle-line"></div>
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
        :classroom="displayClassroom"
        :draft="displayDraft"
        :scene="displayScene"
        :preview-status="displaySceneStatus"
        :can-export="Boolean(draft || displayClassroom)"
        :fields="fields"
        :rag="rag"
        @update-block="handleUpdateBlock"
        @add-slide="handleAddSlide"
        @delete-slide="handleDeleteSlide"
        @duplicate-slide="handleDuplicateSlide"
        @regenerate-slide="handleRegenerateSlide"
        @ai-enhance-slide="handleAiEnhanceSlide"
        @export="handleExport"
      />

      <div v-if="slideAiDialog.visible" class="slide-ai-dialog-mask" @click="closeSlideAiDialog">
        <div class="slide-ai-dialog shell-card" @click.stop>
          <div class="slide-ai-dialog-head">
            <div>
              <span class="panel-kicker">单页 AI 修改</span>
              <h3>第 {{ slideAiDialog.index + 1 }} 页：{{ activeSlideTitle }}</h3>
            </div>
            <button class="slide-ai-close" type="button" @click="closeSlideAiDialog">✕</button>
          </div>

          <div class="slide-ai-dialog-body">
            <p class="slide-ai-helper">
              告诉 AI 这一页你想怎么改，我会只针对当前页做一次修改，不影响其他页面。
            </p>

            <div class="slide-ai-suggestions">
              <button type="button" @click="applySuggestion('把这一页改得更像公开课展示，层次更清楚。')">更像公开课</button>
              <button type="button" @click="applySuggestion('把这一页改成案例型页面，减少堆砌 bullet。')">改成案例型</button>
              <button type="button" @click="applySuggestion('给这一页补一个更自然的课堂提问和一个易错提醒。')">补提问和易错点</button>
            </div>

            <label class="slide-ai-input">
              <span>本次修改要求</span>
              <textarea
                v-model="slideAiDialog.instruction"
                rows="5"
                placeholder="例如：这一页不要太满，改成左侧核心概念 + 右侧案例提示；语气更像老师上课会说的话。"
                @keydown.enter.meta.prevent="submitSlideAiDialog"
                @keydown.enter.ctrl.prevent="submitSlideAiDialog"
              ></textarea>
            </label>
          </div>

          <div class="slide-ai-dialog-actions">
            <button class="ghost" type="button" @click="closeSlideAiDialog">取消</button>
            <button class="primary" type="button" :disabled="!canSubmitSlideAiDialog" @click="submitSlideAiDialog">
              {{ slideMutation.index === slideAiDialog.index ? '修改中…' : '执行本次单页修改' }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SlideCanvas from '../components/SlideCanvas.vue';
import { useWorkspace } from '../composables/useWorkspace';
import { createSceneFromDraft } from '../utils/pptScene';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const route = useRoute();
const router = useRouter();
const followup = ref('');
const editScope = ref('all');
const editSlideRange = ref('');
const autostartHandled = ref(false);
const slideAiDialog = ref({ visible: false, index: -1, instruction: '' });

// --- Draggable sidebar ---
const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 56;
const COLLAPSE_THRESHOLD = 120;
const MAX_WIDTH = 500;

const sidebarWidth = ref(DEFAULT_WIDTH);
const isDragging = ref(false);
const isCollapsed = computed(() => sidebarWidth.value <= COLLAPSE_THRESHOLD);

const pageGridStyle = computed(() => ({
  gridTemplateColumns: `${sidebarWidth.value}px minmax(0, 1fr)`
}));

const expandSidebar = () => { sidebarWidth.value = DEFAULT_WIDTH; };
const collapseSidebar = () => { sidebarWidth.value = MIN_WIDTH; };
const toggleSidebar = () => {
  sidebarWidth.value = isCollapsed.value ? DEFAULT_WIDTH : MIN_WIDTH;
};

const startDrag = (e) => {
  isDragging.value = true;
  const startX = e.clientX;
  const startW = sidebarWidth.value;

  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    let newW = startW + dx;
    if (newW < COLLAPSE_THRESHOLD) newW = MIN_WIDTH;
    else if (newW < 200) newW = 200;
    else if (newW > MAX_WIDTH) newW = MAX_WIDTH;
    sidebarWidth.value = newW;
  };

  const onUp = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
};

const {
  draft,
  displayDraft,
  displayClassroom,
  displayScene,
  displaySceneStatus,
  ensureLocalScene,
  canResumeGeneration,
  fields,
  files,
  handleConfirm,
  handleEnhanceSlide,
  handleExport,
  handleExportDocx,
  handleRegenerateScene,
  handleResumeGeneration,
  handleScopedEdit,
  handleSend,
  initWorkspace,
  isAutoGenerating,
  isBusy,
  mergeDraftWithScene,
  messages,
  rag,
  scene,
  sceneStatus,
  slideMutation,
  summary,
  intent,
  workspacePhase
} = useWorkspace();

initWorkspace();

const slideCount = computed(() => {
  return displayClassroom.value?.scenes?.length
    || displayScene.value?.slides?.length
    || displayDraft.value?.ppt?.length
    || 0;
});
const canFollowup = computed(() => {
  if (!followup.value.trim() || isBusy.value || isAutoGenerating.value) return false;
  if (editScope.value !== 'slides') return true;
  return editSlideRange.value.trim().length > 0;
});
const showEmptyState = computed(() => {
  if (displayClassroom.value?.scenes?.length) return false;
  return !displayDraft.value
    && !intent.value?.ready
    && !isBusy.value
    && !isAutoGenerating.value;
});
const followupPlaceholder = computed(() => {
  if (editScope.value === 'toc') return '例如：把目录页改成更像章节导航，标题更短一些。';
  if (editScope.value === 'slides') return '例如：第 3-5 页改成案例驱动结构，每页只保留 3 个要点。';
  if (editScope.value === 'lesson_plan') return '例如：补上教学过程分步安排和课后作业。';
  if (editScope.value === 'interaction') return '例如：增加一个 5 分钟的小组互动和评价方式。';
  return '继续补充课堂风格、页面重点或要调整的内容。';
});
const pageDescription = computed(() => {
  if (showEmptyState.value) return '请先返回整理页，把需求整理完整后再发起生成。';
  if (displayClassroom.value?.scenes?.length) return '右侧画布展示的是与导出同源的课件结构。';
  if (isAutoGenerating.value && displayDraft.value) return '右侧画布会随着生成进度逐页更新预览。';
  if (draft.value) return '右侧画布中的每个页面都可以直接点击编辑。';
  return '正在根据整理页中的课程信息生成 PPT，请稍候。';
});
const pageTitle = computed(() => {
  if (displayClassroom.value?.scenes?.length) return 'PPT 已生成';
  if (canResumeGeneration.value) return '继续完成 PPT 生成';
  if (draft.value) return 'PPT 已生成';
  return '正在生成 PPT';
});
const stageStatusText = computed(() => {
  if (slideMutation.value.index >= 0) {
    return slideMutation.value.action === 'enhance'
      ? `正在优化第 ${slideMutation.value.index + 1} 页`
      : `正在重排第 ${slideMutation.value.index + 1} 页`;
  }
  if (isAutoGenerating.value && displayDraft.value?.ppt?.length) return '正在逐页生成';
  if (isAutoGenerating.value || isBusy.value) return '正在生成 PPT';
  if (displayClassroom.value?.scenes?.length) return 'PPT 已生成';
  if (displaySceneStatus.value === 'drafting') return '正在逐页生成';
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
const activeSlideForDialog = computed(() => {
  if (displayClassroom.value?.scenes?.length) {
    return displayClassroom.value.scenes[slideAiDialog.value.index] || null;
  }
  const slides = displayScene.value?.slides?.length ? displayScene.value.slides : (displayDraft.value?.ppt || []);
  return slides[slideAiDialog.value.index] || null;
});
const activeSlideTitle = computed(() => activeSlideForDialog.value?.title || '未命名页面');
const canSubmitSlideAiDialog = computed(() => {
  if (slideAiDialog.value.index < 0) return false;
  if (!slideAiDialog.value.instruction.trim()) return false;
  if (slideMutation.value.index >= 0) return false;
  return true;
});

const isLongField = (item) => {
  const val = `${item.value || ''}`;
  return val.length > 20 || item.label === '目标' || item.label === '知识点';
};

// --- Slide editing handlers ---

const syncDraftFromScene = () => {
  if (!draft.value || !scene.value?.slides?.length) return;
  draft.value = mergeDraftWithScene(draft.value, scene.value);
};

const handleUpdateBlock = (data) => {
  const slides = ensureLocalScene()?.slides;
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

  syncDraftFromScene();
};

const handleAddSlide = ({ after, type }) => {
  const slides = ensureLocalScene()?.slides;
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
  syncDraftFromScene();
};

const handleDeleteSlide = (index) => {
  const slides = ensureLocalScene()?.slides;
  if (!slides || slides.length <= 1) return;
  slides.splice(index, 1);
  syncDraftFromScene();
};

const handleDuplicateSlide = (index) => {
  const slides = ensureLocalScene()?.slides;
  if (!slides || !slides[index]) return;

  const source = slides[index];
  const duplicate = JSON.parse(JSON.stringify(source));
  duplicate.id = uid();
  duplicate.title = `${source.title}（副本）`;
  if (duplicate.blocks) {
    duplicate.blocks.forEach((b) => { b.id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; });
  }
  slides.splice(index + 1, 0, duplicate);
  syncDraftFromScene();
};

const handleRegenerateSlide = (index) => {
  if (slideMutation.value.index >= 0) return;
  syncDraftFromScene();
  if (!draft.value) return;

  const regeneratedScene = createSceneFromDraft(draft.value);
  if (!regeneratedScene?.slides?.[index]) return;

  if (!scene.value?.slides?.length) {
    scene.value = regeneratedScene;
    return;
  }

  scene.value = {
    ...scene.value,
    slides: scene.value.slides.map((slide, slideIndex) => {
      if (slideIndex !== index) return slide;
      return {
        ...regeneratedScene.slides[index],
        id: slide?.id || regeneratedScene.slides[index].id
      };
    }),
    updatedAt: new Date().toISOString()
  };

  syncDraftFromScene();
};

const openSlideAiDialog = (index) => {
  if (slideMutation.value.index >= 0) return;
  slideAiDialog.value = {
    visible: true,
    index,
    instruction: ''
  };
};

const closeSlideAiDialog = () => {
  if (slideMutation.value.index >= 0) return;
  slideAiDialog.value = { visible: false, index: -1, instruction: '' };
};

const applySuggestion = (text) => {
  slideAiDialog.value = {
    ...slideAiDialog.value,
    instruction: text
  };
};

const submitSlideAiDialog = async () => {
  const instruction = slideAiDialog.value.instruction.trim();
  const index = slideAiDialog.value.index;
  if (!instruction || index < 0 || slideMutation.value.index >= 0) return;

  syncDraftFromScene();
  const result = await handleEnhanceSlide(index, instruction);
  if (result) {
    closeSlideAiDialog();
  }
};

const handleAiEnhanceSlide = async (index) => {
  openSlideAiDialog(index);
};

const handleFollowup = async () => {
  const text = followup.value.trim();
  if (!text || isBusy.value || isAutoGenerating.value) return;
  if (editScope.value === 'slides' && !editSlideRange.value.trim()) return;
  followup.value = '';
  await handleScopedEdit({
    scope: editScope.value,
    instruction: text,
    slideRange: editScope.value === 'slides' ? editSlideRange.value.trim() : null
  });
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
  gap: 0;
  min-height: 100vh;
}

/* Sidebar wrapper */
.ppt-live-sidebar-wrap {
  position: relative;
  display: flex;
  min-width: 56px;
  max-width: 500px;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.ppt-live-sidebar-wrap.is-dragging {
  transition: none;
  user-select: none;
}

/* Drag handle */
.sidebar-drag-handle {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-drag-handle:hover .drag-handle-line,
.is-dragging .drag-handle-line {
  opacity: 1;
  width: 3px;
  background: #658AE4;
}

.drag-handle-line {
  width: 2px;
  height: 40px;
  border-radius: 4px;
  background: #c4cad8;
  opacity: 0;
  transition: opacity 0.2s, width 0.2s, background 0.2s;
}
.ppt-live-minibar {
  position: sticky;
  top: 0;
  height: 100vh;
  width: 100%;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.ppt-live-edit-grid {
  display: grid;
  gap: 10px;
}

.ppt-live-inline-field {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(40, 49, 78, 0.08);
  background: rgba(255, 255, 255, 0.78);
}

.ppt-live-inline-field select,
.ppt-live-inline-field input {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(40, 49, 78, 0.1);
  background: rgba(247, 247, 248, 0.92);
  padding: 10px 12px;
  font: inherit;
  color: var(--ink);
}

.ppt-live-inline-field select:focus,
.ppt-live-inline-field input:focus {
  outline: none;
  border-color: rgba(101, 138, 228, 0.38);
  box-shadow: 0 0 0 4px rgba(101, 138, 228, 0.12);
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
  min-width: 0;
  overflow: hidden;
}

.ppt-live-field-item strong {
  word-break: break-word;
  overflow-wrap: break-word;
  line-height: 1.5;
  max-height: 4.5em;
  overflow-y: auto;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.ppt-live-field-item.field-full {
  grid-column: 1 / -1;
}

.ppt-live-field-item.field-full strong {
  max-height: 6em;
  -webkit-line-clamp: 4;
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

.slide-ai-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.38);
  backdrop-filter: blur(6px);
}

.slide-ai-dialog {
  width: min(680px, 100%);
  padding: 22px;
  display: grid;
  gap: 18px;
}

.slide-ai-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.slide-ai-dialog-head h3 {
  margin: 6px 0 0;
  font-size: 22px;
}

.slide-ai-close {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}

.slide-ai-dialog-body {
  display: grid;
  gap: 14px;
}

.slide-ai-helper {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.65;
}

.slide-ai-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.slide-ai-suggestions button {
  border: 1px solid rgba(101, 138, 228, 0.18);
  background: rgba(101, 138, 228, 0.06);
  color: #3d5fb7;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 13px;
}

.slide-ai-input {
  display: grid;
  gap: 8px;
}

.slide-ai-input span {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
}

.slide-ai-input textarea {
  width: 100%;
  resize: vertical;
  min-height: 120px;
  border-radius: 14px;
  border: 1px solid rgba(40, 49, 78, 0.1);
  background: rgba(247, 247, 248, 0.92);
  padding: 14px 16px;
  font: inherit;
  line-height: 1.6;
}

.slide-ai-input textarea:focus {
  outline: none;
  border-color: rgba(101, 138, 228, 0.38);
  box-shadow: 0 0 0 4px rgba(101, 138, 228, 0.12);
}

.slide-ai-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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

  .slide-ai-dialog-mask {
    padding: 14px;
  }

  .slide-ai-dialog-actions {
    flex-direction: column-reverse;
  }
}
</style>
