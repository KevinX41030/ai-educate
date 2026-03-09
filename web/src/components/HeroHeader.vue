<template>
  <header class="hero-banner">
    <div class="hero-copy">
      <span class="hero-eyebrow">AI 教学创作台</span>
      <h1>把教学想法，直接变成能导出的课件</h1>
      <p>分步采集需求、交给 AI 共创补全，右侧始终保持成果预览，不再来回切页。</p>
      <div class="hero-tags">
        <span>分步引导</span>
        <span>智能补全</span>
        <span>实时预览</span>
      </div>
    </div>

    <div class="hero-stats">
      <div class="hero-stat hero-stat-featured">
        <small>当前阶段</small>
        <strong>{{ activeStepLabel }}</strong>
        <span>{{ progressText }}</span>
      </div>
      <div class="hero-stat">
        <small>系统状态</small>
        <strong>{{ status }}</strong>
      </div>
      <div class="hero-stat">
        <small>上传资料</small>
        <strong>{{ filesCount }} 份</strong>
      </div>
      <div class="hero-stat">
        <small>当前页数</small>
        <strong>{{ slidesCount }} 页</strong>
      </div>
    </div>
  </header>
</template>

<script setup>
defineProps({
  status: {
    type: String,
    default: '准备就绪'
  },
  progressText: {
    type: String,
    default: '0/5 步已完成'
  },
  activeStepLabel: {
    type: String,
    default: '基础信息'
  },
  filesCount: {
    type: Number,
    default: 0
  },
  slidesCount: {
    type: Number,
    default: 0
  }
});
</script>

<style scoped>
.hero-banner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 420px);
  gap: 24px;
  padding: 28px;
  border-radius: 30px;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.35), transparent 35%),
    linear-gradient(135deg, rgba(91, 108, 255, 0.98), rgba(124, 77, 255, 0.94));
  color: #ffffff;
  overflow: hidden;
  box-shadow: 0 28px 56px rgba(73, 85, 196, 0.28);
}

.hero-banner::after {
  content: '';
  position: absolute;
  inset: auto -80px -120px auto;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}

.hero-copy {
  position: relative;
  z-index: 1;
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(14px);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 16px 0 12px;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.12;
}

.hero-copy p {
  margin: 0;
  max-width: 640px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 15px;
  line-height: 1.7;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.hero-tags span {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
}

.hero-stats {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.hero-stat {
  display: grid;
  gap: 8px;
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(18px);
}

.hero-stat small {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.hero-stat strong {
  font-size: 20px;
  line-height: 1.3;
}

.hero-stat span {
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
}

.hero-stat-featured {
  grid-column: span 2;
  background: rgba(255, 255, 255, 0.18);
}

@media (max-width: 960px) {
  .hero-banner {
    grid-template-columns: 1fr;
    padding: 22px;
  }

  .hero-stats {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .hero-stats {
    grid-template-columns: 1fr;
  }

  .hero-stat-featured {
    grid-column: auto;
  }
}
</style>
