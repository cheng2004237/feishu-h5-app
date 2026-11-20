<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  title: { type: String, required: true },
  icon: { type: String, required: true },
  variant: { type: String, default: 'add' }, // add | deduct | meal | other
  items: { type: Array, default: () => [] },
})

const maxCount = computed(() => {
  if (!props.items.length) return 1
  return Math.max(...props.items.map((r) => r.count), 1)
})
</script>

<template>
  <div v-if="items.length" class="card">
    <div class="card-title">
      <div class="card-title-left">
        <span class="rank-badge" :class="variant">
          <AppIcon :name="icon" :size="14" :stroke-width="2.2" />
        </span>
        <span>{{ title }}</span>
      </div>
      <span class="rank-total tabular-nums">共 {{ items.length }} 项</span>
    </div>

    <div class="reason-list">
      <div v-for="item in items" :key="item.reason" class="reason-item">
        <div class="reason-info">
          <span class="reason-text">{{ item.reason }}</span>
          <span class="reason-count tabular-nums">{{ item.count }}次</span>
        </div>
        <div class="reason-bar-bg">
          <div
            class="reason-bar"
            :class="variant"
            :style="{ width: (item.count / maxCount) * 100 + '%' }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rank-badge {
  width: 26px;
  height: 26px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.rank-badge.add {
  background: var(--color-success-light);
  color: var(--color-success);
}
.rank-badge.deduct {
  background: var(--color-danger-light);
  color: var(--color-danger);
}
.rank-badge.meal {
  background: var(--color-meal-light);
  color: var(--color-primary-deep);
}
.rank-badge.other {
  background: var(--color-other-light);
  color: var(--color-other);
}

.rank-total {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-tertiary);
}

.reason-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reason-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.reason-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.reason-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  word-break: break-all;
}

.reason-count {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.reason-bar-bg {
  height: 7px;
  background: var(--color-bg-muted);
  border-radius: 999px;
  overflow: hidden;
}

.reason-bar {
  height: 100%;
  border-radius: 999px;
  transition: width 0.45s var(--ease-out);
  min-width: 8px;
}
.reason-bar.add {
  background: linear-gradient(90deg, #059669, #34D399);
}
.reason-bar.deduct {
  background: linear-gradient(90deg, #E11D48, #FB7185);
}
.reason-bar.meal {
  background: linear-gradient(90deg, #D97706, #FBBF24);
}
.reason-bar.other {
  background: linear-gradient(90deg, #7C3AED, #A78BFA);
}
</style>
