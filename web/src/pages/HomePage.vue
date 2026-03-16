<template>
  <section class="home-entry-page">
    <div class="home-entry-card">
      <div class="home-entry-copy">
        <span class="panel-kicker">AI 备课工作台</span>
        <h1>一句话描述你的课程需求</h1>
      </div>

      <label class="home-entry-input-card">
        <textarea
          v-model="prompt"
          rows="7"
          placeholder="例如：请帮我准备一节初二物理《压强》的 45 分钟课程，目标是让学生理解压强概念、影响因素，并设计一个简单实验和课堂互动，整体风格简洁清晰。"
          @keydown.meta.enter.prevent="submit"
          @keydown.ctrl.enter.prevent="submit"
        ></textarea>
      </label>

      <div class="home-entry-actions">
        <button class="primary home-entry-button" type="button" :disabled="!canSubmit || isBusy" @click="submit">
          {{ isBusy ? '正在启动…' : 'AI备课' }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useWorkspace } from '../composables/useWorkspace';

const prompt = ref('');
const router = useRouter();
const { isBusy, startFromPrompt } = useWorkspace();

const canSubmit = computed(() => prompt.value.trim().length > 0);

const submit = () => {
  const value = prompt.value.trim();
  if (!value || isBusy.value) return;

  router.push('/workspace');
  void startFromPrompt(value);
  prompt.value = '';
};
</script>

<style scoped>
.home-entry-page {
  min-height: calc(100vh - 88px);
  display: grid;
  place-items: center;
}

.home-entry-card {
  width: min(920px, 100%);
  display: grid;
  gap: 28px;
  padding: clamp(28px, 4vw, 52px);
  border-radius: 36px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 36px 90px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(28px);
}

.home-entry-copy {
  display: grid;
  gap: 16px;
  text-align: center;
  justify-items: center;
}

.home-entry-copy h1 {
  margin: 0;
  font-size: clamp(34px, 5vw, 60px);
  line-height: 1.08;
  letter-spacing: -0.03em;
}

.home-entry-input-card {
  display: block;
}

.home-entry-input-card textarea {
  min-height: 240px;
  padding: 24px 24px 96px;
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.92));
  font-size: 16px;
  line-height: 1.85;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.home-entry-actions {
  display: flex;
  justify-content: center;
}

.home-entry-button {
  min-width: 188px;
  min-height: 56px;
  border-radius: 999px;
  font-size: 16px;
  box-shadow: 0 18px 40px rgba(37, 99, 235, 0.28);
}

@media (max-width: 720px) {
  .home-entry-page {
    min-height: auto;
    padding-top: 8vh;
    align-items: start;
  }

  .home-entry-card {
    gap: 22px;
  }

  .home-entry-input-card textarea {
    min-height: 220px;
    padding: 20px 18px 88px;
  }

  .home-entry-button {
    width: 100%;
  }
}
</style>
