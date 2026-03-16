<template>
  <section class="home-entry-page">
    <div class="home-entry-shell">
      <label class="home-entry-input-card">
        <textarea
          v-model="prompt"
          rows="5"
          placeholder="给 AI 发送消息，描述你想要生成的课程内容"
          @keydown.enter.exact.prevent="submit"
          @keydown.meta.enter.prevent="submit"
          @keydown.ctrl.enter.prevent="submit"
        ></textarea>

        <button
          class="home-entry-submit"
          type="button"
          :disabled="!canSubmit || isBusy"
          @click="submit"
          :aria-label="isBusy ? '正在启动' : '发送'"
        >
          <span v-if="isBusy">…</span>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h11" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </button>
      </label>
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
  min-height: calc(100vh - 68px);
  display: grid;
  place-items: center;
}

.home-entry-shell {
  width: min(860px, 100%);
}

.home-entry-input-card {
  position: relative;
  display: block;
}

.home-entry-input-card textarea {
  min-height: 184px;
  padding: 28px 88px 28px 28px;
  border-radius: 22px;
  border: 1px solid rgba(40, 49, 78, 0.12);
  background: rgba(255, 255, 255, 0.96);
  font-size: 18px;
  line-height: 1.8;
  box-shadow:
    0 24px 60px rgba(40, 49, 78, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.home-entry-input-card textarea::placeholder {
  color: #94a3b8;
}

.home-entry-submit {
  position: absolute;
  right: 20px;
  bottom: 20px;
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  box-shadow: 0 12px 24px rgba(101, 138, 228, 0.22);
}

.home-entry-submit svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

@media (max-width: 720px) {
  .home-entry-page {
    min-height: calc(100vh - 40px);
  }

  .home-entry-input-card textarea {
    min-height: 168px;
    padding: 22px 76px 22px 22px;
    border-radius: 18px;
    font-size: 16px;
  }
}
</style>
