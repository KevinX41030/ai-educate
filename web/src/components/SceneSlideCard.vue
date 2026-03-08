<template>
  <article class="card scene-card" :id="`slide-${index + 1}`">
    <div class="scene-card-head">
      <h4>{{ index + 1 }}. {{ slide.title }}</h4>
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
  gap: 12px;
}

.scene-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.scene-card-head h4 {
  margin: 0;
}

.scene-chip {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  background: #e8f1ff;
  color: #1f3b73;
  font-size: 12px;
  font-weight: 600;
}

.scene-card-body {
  display: grid;
  gap: 10px;
}

.scene-block {
  border: 1px solid rgba(31, 59, 115, 0.08);
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.85);
}

.scene-block-title {
  font-size: 12px;
  font-weight: 600;
  color: #1f3b73;
  margin-bottom: 6px;
}

.scene-block p,
.scene-block strong {
  margin: 0;
  line-height: 1.6;
}

.scene-block ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}

.scene-grid-cards,
.scene-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.scene-mini-card,
.scene-column-card {
  border-radius: 10px;
  padding: 10px;
  background: #f8fbff;
  border: 1px solid rgba(31, 59, 115, 0.08);
  line-height: 1.6;
  font-size: 13px;
}

.scene-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.scene-steps li {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  align-items: start;
}

.scene-steps span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #1f3b73;
  color: white;
  font-size: 12px;
  font-weight: 700;
}

.scene-steps p {
  margin: 2px 0 0;
}

.block-title {
  background: linear-gradient(135deg, rgba(31, 59, 115, 0.06), rgba(76, 139, 245, 0.08));
}

.block-callout,
.block-question {
  background: #f8fbff;
}
</style>
