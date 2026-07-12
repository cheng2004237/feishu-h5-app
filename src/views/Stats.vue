<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getThisWeekRecords,
  getThisMonthRecords,
  summarizeRecords,
} from '../utils/storage.js'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn.js'
import isoWeek from 'dayjs/plugin/isoWeek.js'

dayjs.extend(isoWeek)
dayjs.locale('zh-cn')

const timeRange = ref('week')
const summary = ref(null)
const loading = ref(false)

const timeRangeLabel = computed(() =>
  timeRange.value === 'week' ? '本周' : '本月'
)

const dateRangeText = computed(() => {
  if (timeRange.value === 'week') {
    const s = dayjs().startOf('isoWeek')
    const e = dayjs().endOf('isoWeek')
    return `${s.format('M/D')} - ${e.format('M/D')}`
  } else {
    return dayjs().format('YYYY年M月')
  }
})

async function loadStats() {
  loading.value = true
  try {
    const records =
      timeRange.value === 'week' ? await getThisWeekRecords() : await getThisMonthRecords()
    summary.value = summarizeRecords(records)
  } catch (err) {
    console.error('加载统计数据失败:', err)
  } finally {
    loading.value = false
  }
}

function switchRange(range) {
  timeRange.value = range
  loadStats()
}

// 柱状图：每日得分
const barMaxValue = computed(() => {
  if (!summary.value || !summary.value.dailyScores.length) return 1
  return Math.max(
    ...summary.value.dailyScores.map((d) => Math.max(d.add, d.deduct)),
    1
  )
})

function formatDateLabel(dateStr) {
  return dayjs(dateStr).format('M/D')
}

function formatWeekday(dateStr) {
  return dayjs(dateStr).format('ddd')
}

// 原因图表 - 最大次数（用于计算百分比宽度）
function reasonMaxCount(reasons) {
  if (!reasons || !reasons.length) return 1
  return Math.max(...reasons.map((r) => r.count), 1)
}

onMounted(() => {
  loadStats()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1>程怿一 · 积分统计</h1>
      <p>{{ dateRangeText }}</p>
    </div>

    <div class="page-content">
      <!-- 时间切换 -->
      <div class="segmented-control" style="margin-bottom: 16px;">
        <div
          class="segmented-item"
          :class="{ active: timeRange === 'week' }"
          @click="switchRange('week')"
        >
          本周
        </div>
        <div
          class="segmented-item"
          :class="{ active: timeRange === 'month' }"
          @click="switchRange('month')"
        >
          本月
        </div>
      </div>

      <template v-if="summary">
        <!-- 总分卡片 -->
        <div class="score-hero">
          <div class="hero-label">{{ timeRangeLabel }}净得分</div>
          <div
            class="hero-value"
            :class="summary.netScore >= 0 ? 'points-positive' : 'points-negative'"
          >
            {{ summary.netScore >= 0 ? '+' : '' }}{{ summary.netScore }}
          </div>
          <div class="hero-sub">
            已记录 {{ summary.dayCount }} 天
          </div>
        </div>

        <!-- 加分 / 扣分 总览 -->
        <div class="stat-grid" style="margin-bottom: 12px;">
          <div class="stat-card">
            <div class="stat-value points-positive">+{{ summary.totalAdd }}</div>
            <div class="stat-label">{{ timeRangeLabel }}总加分</div>
          </div>
          <div class="stat-card">
            <div class="stat-value points-negative">-{{ summary.totalDeduct }}</div>
            <div class="stat-label">{{ timeRangeLabel }}总扣分</div>
          </div>
        </div>

        <!-- 每日得分柱状图 -->
        <div class="card" v-if="summary.dailyScores.length">
          <div class="card-title">📊 每日得分</div>
          <div class="bar-chart">
            <div
              v-for="day in summary.dailyScores"
              :key="day.date"
              class="bar-group"
            >
              <div class="bar-bars">
                <div
                  class="bar bar-add"
                  :style="{ height: (day.add / barMaxValue) * 100 + '%' }"
                  :title="'加分: +' + day.add"
                >
                  <span class="bar-val" v-if="day.add">+{{ day.add }}</span>
                </div>
                <div
                  class="bar bar-deduct"
                  :style="{ height: (day.deduct / barMaxValue) * 100 + '%' }"
                  :title="'扣分: -' + day.deduct"
                >
                  <span class="bar-val" v-if="day.deduct">-{{ day.deduct }}</span>
                </div>
              </div>
              <div class="bar-label">{{ formatDateLabel(day.date) }}</div>
              <div class="bar-weekday">{{ formatWeekday(day.date) }}</div>
            </div>
          </div>
        </div>

        <!-- 加分原因统计 -->
        <div class="card" v-if="summary.addReasons.length">
          <div class="card-title">
            <span class="section-icon add-icon">+</span>
            加分原因统计
          </div>
          <div class="reason-list">
            <div
              v-for="item in summary.addReasons"
              :key="item.reason"
              class="reason-item"
            >
              <div class="reason-info">
                <span class="reason-text">{{ item.reason }}</span>
                <span class="reason-count">{{ item.count }}次</span>
              </div>
              <div class="reason-bar-bg">
                <div
                  class="reason-bar add"
                  :style="{ width: (item.count / reasonMaxCount(summary.addReasons)) * 100 + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 扣分原因统计 -->
        <div class="card" v-if="summary.deductReasons.length">
          <div class="card-title">
            <span class="section-icon deduct-icon">−</span>
            扣分原因统计
          </div>
          <div class="reason-list">
            <div
              v-for="item in summary.deductReasons"
              :key="item.reason"
              class="reason-item"
            >
              <div class="reason-info">
                <span class="reason-text">{{ item.reason }}</span>
                <span class="reason-count">{{ item.count }}次</span>
              </div>
              <div class="reason-bar-bg">
                <div
                  class="reason-bar deduct"
                  :style="{ width: (item.count / reasonMaxCount(summary.deductReasons)) * 100 + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 每日明细 -->
        <div class="card" v-if="summary.dailyScores.length">
          <div class="card-title">📋 每日明细</div>
          <div class="detail-list">
            <div
              v-for="day in [...summary.dailyScores].reverse()"
              :key="day.date"
              class="detail-item"
            >
              <div class="detail-date">
                <span class="detail-day">{{ formatDateLabel(day.date) }}</span>
                <span class="detail-weekday">{{ formatWeekday(day.date) }}</span>
              </div>
              <div class="detail-scores">
                <span class="points-positive" v-if="day.add">+{{ day.add }}</span>
                <span class="points-negative" v-if="day.deduct">-{{ day.deduct }}</span>
              </div>
              <div
                class="detail-net"
                :class="day.net >= 0 ? 'points-positive' : 'points-negative'"
              >
                {{ day.net >= 0 ? '+' : '' }}{{ day.net }}
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="summary.dayCount === 0" class="empty-state" style="margin-top: 30px;">
          <div class="icon">📊</div>
          <p>{{ timeRangeLabel }}暂无记录</p>
          <p style="font-size: 12px; margin-top: 4px;">去首页记录今天的积分吧</p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 总分英雄卡 */
.score-hero {
  background: linear-gradient(135deg, #4158d0 0%, #3370ff 50%, #48a9f8 100%);
  border-radius: var(--radius-lg);
  padding: 28px 20px;
  text-align: center;
  margin-bottom: 12px;
  color: white;
  box-shadow: 0 4px 20px rgba(51, 112, 255, 0.3);
}

.hero-label {
  font-size: 13px;
  opacity: 0.85;
  margin-bottom: 8px;
}

.hero-value {
  font-size: 48px;
  font-weight: 800;
  color: white !important;
  line-height: 1;
  margin-bottom: 8px;
}

.hero-sub {
  font-size: 12px;
  opacity: 0.7;
}

/* 区域图标 */
.section-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: white;
}

.add-icon { background: var(--color-success); }
.deduct-icon { background: var(--color-danger); }

/* 柱状图 */
.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 160px;
  padding-top: 20px;
}

.bar-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.bar-bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  width: 100%;
}

.bar {
  flex: 1;
  min-height: 2px;
  border-radius: 3px 3px 0 0;
  position: relative;
  transition: height 0.5s ease;
}

.bar-add { background: var(--color-success); }
.bar-deduct { background: var(--color-danger); }

.bar-val {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.bar-add .bar-val { color: var(--color-success); }
.bar-deduct .bar-val { color: var(--color-danger); }

.bar-label {
  font-size: 10px;
  color: var(--color-text-secondary);
  margin-top: 6px;
}

.bar-weekday {
  font-size: 9px;
  color: var(--color-text-placeholder);
}

/* 原因统计 */
.reason-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reason-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reason-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reason-text {
  font-size: 13px;
  font-weight: 500;
}

.reason-count {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 600;
}

.reason-bar-bg {
  height: 8px;
  background: var(--color-bg);
  border-radius: 4px;
  overflow: hidden;
}

.reason-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
  min-width: 8px;
}

.reason-bar.add { background: linear-gradient(90deg, #34c759, #5ddf7f); }
.reason-bar.deduct { background: linear-gradient(90deg, #f54a45, #ff7875); }

/* 每日明细 */
.detail-list {
  display: flex;
  flex-direction: column;
}

.detail-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-bg);
}

.detail-item:last-child { border-bottom: none; }

.detail-date {
  display: flex;
  flex-direction: column;
  width: 50px;
}

.detail-day {
  font-size: 13px;
  font-weight: 600;
}

.detail-weekday {
  font-size: 10px;
  color: var(--color-text-placeholder);
}

.detail-scores {
  flex: 1;
  display: flex;
  gap: 12px;
  font-size: 13px;
  font-weight: 500;
}

.detail-net {
  font-size: 16px;
  font-weight: 700;
  width: 50px;
  text-align: right;
}
</style>
