<template>
  <article class="scene-card" :id="`slide-${index + 1}`">
    <div class="scene-card-head">
      <div>
        <h4>{{ index + 1 }}. {{ slide.title }}</h4>
        <p>{{ variantLabel }}</p>
      </div>
      <span class="scene-chip">{{ variantLabel }}</span>
    </div>

    <div class="scene-card-body">
      <div
        v-for="block in blocks"
        :key="block.id"
        class="scene-block"
        :class="`block-${block.type}`"
      >
        <template v-if="block.type === 'title'">
          <strong>{{ block.text }}</strong>
        </template>
        <template v-else-if="block.type === 'subtitle'">
          <p>{{ block.text }}</p>
        </template>
        <template v-else-if="block.type === 'bullets' || block.type === 'summaryCards'">
          <div class="scene-block-title" v-if="block.title">{{ block.title }}</div>
          <ul>
            <li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li>
          </ul>
        </template>
        <template v-else-if="block.type === 'factCards' || block.type === 'taskCards'">
          <div class="scene-block-title" v-if="block.title">{{ block.title }}</div>
          <div class="scene-grid-cards">
            <div v-for="(item, itemIndex) in block.items" :key="itemIndex" class="scene-mini-card">
              {{ item }}
            </div>
          </div>
        </template>
        <template v-else-if="block.type === 'steps'">
          <div class="scene-block-title" v-if="block.title">{{ block.title }}</div>
          <ol class="scene-steps">
            <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
              <span>{{ itemIndex + 1 }}</span>
              <p>{{ item }}</p>
            </li>
          </ol>
        </template>
        <template v-else-if="block.type === 'columns'">
          <div class="scene-block-title" v-if="block.title">{{ block.title }}</div>
          <div class="scene-columns">
            <div v-for="(item, itemIndex) in block.items" :key="itemIndex" class="scene-column-card">
              {{ item }}
            </div>
          </div>
        </template>
        <template v-else>
          <div class="scene-block-title">{{ block.title || fallbackTitle(block.type) }}</div>
          <p>{{ block.text }}</p>
        </template>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  slide: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    default: 0
  }
});

const LABELS = {
  cover: '封面',
  toc: '目录',
  concept: '概念',
  process: '流程',
  case: '案例',
  activity: '活动',
  summary: '总结'
};

const blocks = computed(() => props.slide?.blocks || []);
const variantLabel = computed(() => LABELS[props.slide?.variant] || props.slide?.role || '内容');

const fallbackTitle = (type) => {
  if (type === 'callout') return '提示';
  if (type === 'question') return '互动';
  return '内容';
};
</script>

<style scoped>
.scene-card {
  display: grid;
  gap: 16px;
}

.scene-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.scene-card-head h4 {
  margin: 0;
  font-size: 24px;
}

.scene-card-head p {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.scene-chip {
  flex-shrink: 0;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(161, 254, 239, 0.42);
  color: var(--primary-strong);
  font-size: 12px;
  font-weight: 700;
}

.scene-card-body {
  display: grid;
  gap: 12px;
  padding: 20px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(40, 49, 78, 0.08);
}

.scene-block {
  border: 1px solid rgba(40, 49, 78, 0.08);
  border-radius: 10px;
  padding: 14px 16px;
  background: rgba(247, 247, 248, 0.92);
}

.scene-block-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 8px;
}

.scene-block p,
.scene-block strong {
  margin: 0;
  line-height: 1.7;
}

.scene-block ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
  line-height: 1.7;
}

.scene-grid-cards,
.scene-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.scene-mini-card,
.scene-column-card {
  border-radius: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(40, 49, 78, 0.08);
  line-height: 1.7;
  font-size: 13px;
}

.scene-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.scene-steps li {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 12px;
  align-items: start;
}

.scene-steps span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: var(--primary);
  color: white;
  font-size: 12px;
  font-weight: 800;
}

.scene-steps p {
  margin: 3px 0 0;
}

.block-title {
  background: rgba(161, 254, 239, 0.18);
}

.block-callout,
.block-question {
  background: rgba(255, 255, 255, 0.96);
}
</style>
