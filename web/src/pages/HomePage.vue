<template>
  <section class="shell-card home-hero-card">
    <div class="home-hero-copy">
      <span class="panel-kicker">AI 课件制作系统</span>
      <h1>选择你的创作方式</h1>
      <p>你可以直接与 AI 共创课件，也可以先自行填写课程内容，再进入后续预览与导出流程。</p>
    </div>

    <div class="home-entry-grid">
      <RouterLink class="entry-card entry-card-primary" to="/copilot">
        <span class="entry-badge">入口 01</span>
        <strong>与 AI 共创</strong>
        <p>通过对话逐步补充教学目标、重点内容、互动方式和资料要求。</p>
        <span class="entry-action">立即开始</span>
      </RouterLink>

      <RouterLink class="entry-card" to="/create">
        <span class="entry-badge">入口 02</span>
        <strong>自行填写内容</strong>
        <p>先按结构化方式填写课程信息，再进入共创、预览和导出环节。</p>
        <span class="entry-action">进入填写</span>
      </RouterLink>
    </div>
  </section>
</template>

<script setup>
import { RouterLink } from 'vue-router';
</script>

<style scoped>
.home-hero-card {
  min-height: calc(100vh - 180px);
  display: grid;
  align-content: center;
  gap: 36px;
  padding: clamp(28px, 5vw, 56px);
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.28), transparent 28%),
    linear-gradient(135deg, rgba(91, 108, 255, 0.98), rgba(124, 77, 255, 0.94));
  color: #ffffff;
  box-shadow: 0 28px 56px rgba(73, 85, 196, 0.24);
}

.home-hero-copy {
  max-width: 760px;
}

.home-hero-copy h1 {
  margin: 16px 0 14px;
  font-size: clamp(38px, 6vw, 64px);
  line-height: 1.08;
}

.home-hero-copy p {
  margin: 0;
  max-width: 620px;
  color: rgba(255, 255, 255, 0.84);
  font-size: 16px;
  line-height: 1.8;
}

.home-entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.entry-card {
  display: grid;
  gap: 14px;
  padding: 24px;
  border-radius: 28px;
  text-decoration: none;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(18px);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.entry-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 36px rgba(36, 44, 116, 0.24);
  background: rgba(255, 255, 255, 0.16);
}

.entry-card-primary {
  background: rgba(255, 255, 255, 0.2);
}

.entry-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.entry-card strong {
  font-size: 30px;
  line-height: 1.2;
}

.entry-card p {
  margin: 0;
  color: rgba(255, 255, 255, 0.84);
  line-height: 1.7;
}

.entry-action {
  display: inline-flex;
  width: fit-content;
  margin-top: 6px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 900px) {
  .home-hero-card {
    min-height: auto;
  }

  .home-entry-grid {
    grid-template-columns: 1fr;
  }
}
</style>
