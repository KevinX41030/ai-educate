<template>
  <div class="page-stack">
    <HeroHeader
      :status="status"
      :progress-text="progressText"
      :active-step-label="activeStepLabel"
      :files-count="files.length"
      :slides-count="outlineSlides.length"
    />

    <section class="shell-card home-launch-card">
      <div>
        <span class="panel-kicker">开始创作</span>
        <h2>面向真实教学场景的课件创作工作台</h2>
        <p>从需求采集、资料补充到课件预览与导出，所有内容围绕当前课件持续保存，适合直接投入正式使用。</p>
      </div>

      <div class="home-launch-actions">
        <RouterLink class="button-link primary-link" to="/create">开始创建</RouterLink>
        <RouterLink class="button-link secondary-link" to="/copilot">进入共创</RouterLink>
        <RouterLink class="button-link ghost-link" to="/preview">查看预览</RouterLink>
      </div>
    </section>

    <div class="home-grid">
      <section class="shell-card home-card">
        <div class="home-card-head">
          <div>
            <span class="panel-kicker">当前课件</span>
            <h3>{{ lessonTitle }}</h3>
          </div>
          <p>{{ progressText }}</p>
        </div>

        <p v-if="!hasWorkspaceContent" class="home-empty-note">
          当前还没有开始整理课件内容，建议先进入创建页填写课程信息。
        </p>

        <div class="home-summary-list">
          <div class="home-summary-item">
            <span>主题</span>
            <strong>{{ fields.subject || '未设置' }}</strong>
          </div>
          <div class="home-summary-item">
            <span>年级</span>
            <strong>{{ fields.grade || '未设置' }}</strong>
          </div>
          <div class="home-summary-item">
            <span>资料</span>
            <strong>{{ files.length ? `${files.length} 份` : '暂无资料' }}</strong>
          </div>
          <div class="home-summary-item">
            <span>页数</span>
            <strong>{{ outlineSlides.length ? `${outlineSlides.length} 页` : '尚未生成' }}</strong>
          </div>
        </div>

        <div class="home-inline-actions">
          <RouterLink class="button-link secondary-link" to="/create">完善需求</RouterLink>
          <RouterLink class="button-link primary-link" to="/preview">继续预览</RouterLink>
        </div>
      </section>

      <section class="shell-card home-card">
        <div class="home-card-head">
          <div>
            <span class="panel-kicker">平台能力</span>
            <h3>围绕正式教学产出设计</h3>
          </div>
        </div>

        <div class="capability-grid">
          <div class="capability-card">
            <strong>结构化需求采集</strong>
            <p>把主题、目标、知识点和互动方式整理成可直接生成课件的输入。</p>
          </div>
          <div class="capability-card">
            <strong>资料协同整理</strong>
            <p>支持上传参考资料并在共创阶段持续补充上下文，减少重复描述。</p>
          </div>
          <div class="capability-card">
            <strong>预览与导出闭环</strong>
            <p>在独立预览页查看课件结构、教案草稿和导出结果，便于最终交付。</p>
          </div>
        </div>
      </section>

      <section class="shell-card home-card home-card-wide">
        <div class="home-card-head">
          <div>
            <span class="panel-kicker">创作流程</span>
            <h3>围绕课件交付的三阶段流程</h3>
          </div>
        </div>

        <div class="flow-grid">
          <div class="flow-card">
            <strong>创建课件</strong>
            <p>先完成课程信息、教学目标和重点内容采集，建立统一需求基础。</p>
          </div>
          <div class="flow-card">
            <strong>AI 共创</strong>
            <p>继续补充课堂要求、资料、风格和互动方式，让系统获得更完整的上下文。</p>
          </div>
          <div class="flow-card">
            <strong>预览导出</strong>
            <p>查看页面结构和教案内容，确认无误后导出到正式交付格式。</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import HeroHeader from '../components/HeroHeader.vue';
import { useWorkspace } from '../composables/useWorkspace';

const {
  activeStepLabel,
  fields,
  files,
  lessonTitle,
  outlineSlides,
  progressText,
  status
} = useWorkspace();

const hasWorkspaceContent = computed(() => (
  Boolean(fields.value.subject || fields.value.goals || files.value.length || outlineSlides.value.length)
));
</script>

<style scoped>
.home-launch-card {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
}

.home-launch-card h2 {
  margin: 12px 0 10px;
  font-size: 30px;
  line-height: 1.2;
}

.home-launch-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.7;
}

.home-launch-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.home-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 20px;
}

.home-card {
  display: grid;
  gap: 18px;
}

.home-card-wide {
  grid-column: span 2;
}

.home-card-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.home-card-head h3 {
  margin: 12px 0 0;
  font-size: 24px;
}

.home-card-head p,
.home-empty-note,
.capability-card p,
.flow-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.home-summary-list,
.capability-grid,
.flow-grid {
  display: grid;
  gap: 14px;
}

.home-summary-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.capability-grid,
.flow-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.home-summary-item,
.capability-card,
.flow-card {
  display: grid;
  gap: 8px;
  padding: 18px;
  border-radius: 22px;
  background: rgba(91, 108, 255, 0.06);
  border: 1px solid rgba(91, 108, 255, 0.1);
}

.home-summary-item span {
  color: var(--muted);
  font-size: 12px;
}

.home-inline-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 960px) {
  .home-launch-card,
  .home-card-head {
    flex-direction: column;
    align-items: stretch;
  }

  .home-grid,
  .home-summary-list {
    grid-template-columns: 1fr;
  }

  .home-card-wide {
    grid-column: auto;
  }
}
</style>
