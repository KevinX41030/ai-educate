<template>
  <g :transform="groupTransform">
    <foreignObject
      :x="element.left"
      :y="element.top"
      :width="element.width"
      :height="element.height"
    >
      <div xmlns="http://www.w3.org/1999/xhtml" class="table-root">
        <table class="canvas-table">
          <colgroup>
            <col
              v-for="(width, index) in colWidths"
              :key="index"
              :style="{ width: `${width * 100}%` }"
            />
          </colgroup>
          <tbody>
            <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
              <td
                v-for="cell in row"
                :key="cell.id"
                :colspan="cell.colspan || 1"
                :rowspan="cell.rowspan || 1"
                :style="cellStyle(cell)"
              >
                {{ cell.text }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </foreignObject>
  </g>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  element: {
    type: Object,
    required: true
  }
});

const rows = computed(() => Array.isArray(props.element?.data) ? props.element.data : []);
const colWidths = computed(() => {
  const raw = Array.isArray(props.element?.colWidths) ? props.element.colWidths : [];
  if (!raw.length) {
    const count = Math.max(rows.value[0]?.length || 1, 1);
    return Array.from({ length: count }, () => 1 / count);
  }
  return raw;
});

const groupTransform = computed(() => {
  const rotate = Number(props.element?.rotate || 0);
  if (!rotate) return '';
  const cx = Number(props.element.left || 0) + Number(props.element.width || 0) / 2;
  const cy = Number(props.element.top || 0) + Number(props.element.height || 0) / 2;
  return `rotate(${rotate} ${cx} ${cy})`;
});

const cellStyle = (cell) => ({
  fontWeight: cell?.style?.bold ? 700 : 400,
  color: cell?.style?.color || '#111827',
  backgroundColor: cell?.style?.backcolor || '#ffffff',
  fontSize: `${cell?.style?.fontsize || 15}px`,
  textAlign: cell?.style?.align || 'left'
});
</script>

<style scoped>
.table-root {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.canvas-table {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-family: 'Microsoft YaHei', sans-serif;
}

.canvas-table td {
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  vertical-align: middle;
  line-height: 1.35;
  word-break: break-word;
}
</style>
