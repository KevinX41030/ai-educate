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
        <span class="panel-kicker">多页面产品流</span>
        <h2>现在不是一个大页面硬塞所有功能，而是按真实使用流程走</h2>
        <p>先在创建页定义课件，再去 AI 共创页补全细节，最后在预览页专注看结果和导出。</p>
      </div>

      <div class="home-launch-actions">
        <RouterLink class="button-link primary-link" to="/create">新建课件</RouterLink>
        <RouterLink class="button-link secondary-link" to="/copilot">进入 AI 共创</RouterLink>
        <RouterLink class="button-link ghost-link" to="/preview">查看预览</RouterLink>
      </div>
    </section>

    <div class="home-grid">
      <section class="shell-card home-card">
        <div class="home-card-head">
          <div>
            <span class="panel-kicker">推荐模板</span>
            <h3>从一个更接近真实课型的模板开始</h3>
          </div>
          <p>点击后会自动带入创建页。</p>
        </div>

        <div class="home-template-grid">
          <button
            v-for="preset in lessonPresets"
            :key="preset.name"
            type="button"
            class="home-template-card"
            @click="startWithPreset(preset.fields)"
          >
            <strong>{{ preset.name }}</strong>
            <small>{{ preset.note }}</small>
          </button>
        </div>
      </section>

      <section class="shell-card home-card">
        <div class="home-card-head">
          <div>
            <span class="panel-kicker">当前项目</span>
            <h3>{{ lessonTitle }}</h3>
          </div>
          <p>{{ progressText }}</p>
        </div>

        <div class="home-summary-list">
          <div class="home-summary-item">
            <span>主题</span>
            <strong>{{ fields.subject || '待填写' }}</strong>
          </div>
          <div class="home-summary-item">
            <span>年级</span>
            <strong>{{ fields.grade || '待填写' }}</strong>
          </div>
          <div class="home-summary-item">
            <span>资料</span>
            <strong>{{ files.length ? `${files.length} 份` : '未上传' }}</strong>
          </div>
          <div class="home-summary-item">
            <span>页数</span>
            <strong>{{ outlineSlides.length ? `${outlineSlides.length} 页` : '未生成' }}</strong>
          </div>
        </div>

        <div class="home-inline-actions">
          <RouterLink class="button-link secondary-link" to="/create">去填写需求</RouterLink>
          <RouterLink class="button-link primary-link" to="/preview">去看预览</RouterLink>
        </div>
      </section>

      <section class="shell-card home-card home-card-wide">
        <div class="home-card-head">
          <div>
            <span class="panel-kicker">为什么拆页</span>
            <h3>每个页面只负责一种心智任务</h3>
          </div>
        </div>

        <div class="flow-grid">
          <div class="flow-card">
            <strong>创建页</strong>
            <p>只采集课程意图和教学目标，不让聊天和预览打断输入状态。</p>
          </div>
          <div class="flow-card">
            <strong>共创页</strong>
            <p>把 AI 助手单独拉出来，重点处理补充说明、资料上传和连续对话。</p>
          </div>
          <div class="flow-card">
            <strong>预览页</strong>
            <p>让用户沉浸式查看课件页面、教案草稿和导出状态，更像真正产品。</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { RouterLink, useRouter } from 'vue-router';
import HeroHeader from '../components/HeroHeader.vue';
import { lessonPresets } from '../constants/lessonPresets';
import { useWorkspace } from '../composables/useWorkspace';

const router = useRouter();
const {
  activeStepLabel,
  fields,
  files,
  lessonTitle,
  outlineSlides,
  prefillWorkspace,
  progressText,
  status
} = useWorkspace();

const startWithPreset = (presetFields) => {
  prefillWorkspace(presetFields);
  router.push('/create');
};
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
  grid-template-columns: 1.15fr 0.85fr;
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

.home-card-head p {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.home-template-grid,
.flow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.home-template-card,
.flow-card {
  display: grid;
  gap: 8px;
  padding: 18px;
  border-radius: 22px;
  text-align: left;
  background: rgba(91, 108, 255, 0.06);
  border: 1px solid rgba(91, 108, 255, 0.1);
  box-shadow: none;
}

.home-template-card small,
.flow-card p {
  color: var(--muted);
  line-height: 1.6;
}

.home-summary-list {
  display: grid;
  gap: 12px;
}

.home-summary-item {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(91, 108, 255, 0.06);
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

  .home-grid {
    grid-template-columns: 1fr;
  }

  .home-card-wide {
    grid-column: auto;
  }
}
</style>
