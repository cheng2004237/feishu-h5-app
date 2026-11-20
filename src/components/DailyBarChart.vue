<script setup>
import { computed } from 'vue'
import dayjs from 'dayjs'
import AppIcon from './AppIcon.vue'

/**
 * 可横向滑动的柱状图卡片（解决本月 20~31 天挤爆重叠问题）
 * series: [{ key, label, colorClass, prefix, suffix, decimals }]
 */
const props = defineProps({
  title: { type: String, required: true },
  icon: { type: String, required: true },
  iconVariant: { type: String, default: 'primary' }, // primary | meal | run | other
  days: { type: Array, default: () => [] },
  series: { type: Array, required: true },
})

const maxValue = computed(() => {
  if (!props.days.length) return 1
  let m = 1
  for (const d of props.days) {
    for (const s of props.series) {
      const v = Number(d[s.key]) || 0
      if (v > m) m = v
    }
  }
  return m
})

const needsScroll = computed(() => props.days.length > 7)

const minChartWidth = computed(() => {
  const perCol = props.series.length >= 3 ? 56 : props.series.length === 2 ? 48 : 42
  return `${Math.max(props.days.length * perCol, 280)}px`
})

function formatVal(val, s) {
  const n = Number(val) || 0
  if (!n) return ''
  const numStr = s.decimals !== undefined ? n.toFixed(s.decimals) : String(n)
  return `${s.prefix || ''}${numStr}${s.suffix || ''}`
}

function formatDateLabel(dateStr) {
  return dayjs(dateStr).format('M/D')
}

function formatWeekday(dateStr) {
  return dayjs(dateStr).format('ddd')
}
</script>

<template>
  <div v-if="days.length" class="card">
    <div class="card-title">
      <div class="card-title-left">
        <span class="chart-badge" :class="iconVariant">
          <AppIcon :name="icon" :size="15" />
        </span>
        <span>{{ title }}</span>
      </div>
      <div class="chart-meta">
        <span v-if="needsScroll" class="scroll-hint">左右滑动</span>
        <div v-if="series.length > 1" class="legend">
          <span v-for="s in series" :key="s.key" class="legend-item">
            <span class="legend-dot" :class="s.colorClass"></span>{{ s.label }}
          </span>
        </div>
      </div>
    </div>

    <div class="chart-scroll">
      <div class="bar-chart" :style="{ minWidth: needsScroll ? minChartWidth : '100%' }">
        <div v-for="day in days" :key="day.date" class="bar-group">
          <div class="bar-bars">
            <div
              v-for="s in series"
              :key="s.key"
              class="bar"
              :class="[s.colorClass, { empty: !(Number(day[s.key]) > 0) }]"
              :style="{
                height: Number(day[s.key]) > 0
                  ? Math.max((Number(day[s.key]) / maxValue) * 100, 6) + '%'
                  : '3px',
              }"
              :title="`${s.label}: ${formatVal(day[s.key], s) || '0'}`"
            >
              <span v-if="Number(day[s.key]) > 0" class="bar-val tabular-nums">
                {{ formatVal(day[s.key], s) }}
              </span>
            </div>
          </div>
          <div class="bar-label tabular-nums">{{ formatDateLabel(day.date) }}</div>
          <div class="bar-weekday">{{ formatWeekday(day.date) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-badge {
  width: 26px;
  height: 26px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.chart-badge.primary {
  background: var(--color-primary-light);
  color: var(--color-primary-deep);
}
.chart-badge.meal {
  background: var(--color-meal-light);
  color: var(--color-primary-deep);
}
.chart-badge.run {
  background: var(--color-run-light);
  color: var(--color-run);
}
.chart-badge.other {
  background: var(--color-other-light);
  color: var(--color-other);
}

.chart-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scroll-hint {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-primary-deep);
  background: var(--color-primary-light);
  padding: 2px 7px;
  border-radius: 999px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 3px;
}

.chart-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 2px;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 158px;
  padding-top: 22px;
}

.bar-group {
  flex: 1;
  min-width: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar-bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  width: 100%;
}

.bar {
  flex: 1;
  max-width: 18px;
  border-radius: 5px 5px 2px 2px;
  position: relative;
  transition: height 0.45s var(--ease-out);
}

.bar.empty {
  opacity: 0.18;
}

.bar-add,
.legend-dot.bar-add {
  background: linear-gradient(180deg, #34D399, #059669);
}
.bar-deduct,
.legend-dot.bar-deduct {
  background: linear-gradient(180deg, #FB7185, #E11D48);
}
.bar-meal-b,
.legend-dot.bar-meal-b {
  background: linear-gradient(180deg, #FDE68A, #F59E0B);
}
.bar-meal-l,
.legend-dot.bar-meal-l {
  background: linear-gradient(180deg, #FBBF24, #D97706);
}
.bar-meal-d,
.legend-dot.bar-meal-d {
  background: linear-gradient(180deg, #FB923C, #EA580C);
}
.bar-run,
.legend-dot.bar-run {
  background: linear-gradient(180deg, #34D399, #059669);
}
.bar-other,
.legend-dot.bar-other {
  background: linear-gradient(180deg, #A78BFA, #7C3AED);
}

.bar-val {
  position: absolute;
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  font-weight: 700;
  white-space: nowrap;
}

.bar-add .bar-val,
.bar-run .bar-val {
  color: var(--color-success);
}
.bar-deduct .bar-val {
  color: var(--color-danger);
}
.bar-meal-b .bar-val,
.bar-meal-l .bar-val,
.bar-meal-d .bar-val {
  color: var(--color-primary-deep);
}
.bar-other .bar-val {
  color: var(--color-other);
}

.bar-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-top: 6px;
  white-space: nowrap;
}

.bar-weekday {
  font-size: 9px;
  color: var(--color-text-tertiary);
}
</style>
