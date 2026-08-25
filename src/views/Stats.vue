<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getThisWeekRecords,
  getThisMonthRecords,
  summarizeRecords,
  formatRunTime,
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
    return `${s.format('M/D')} – ${e.format('M/D')}`
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

const barMaxValue = computed(() => {
  if (!summary.value || !summary.value.dailyScores.length) return 1
  return Math.max(
    ...summary.value.dailyScores.map((d) => Math.max(d.add, d.deduct)),
    1
  )
})

const mealDaysWithData = computed(() => {
  if (!summary.value) return []
  return summary.value.dailyScores.filter(
    (d) => d.breakfast || d.lunch || d.dinner
  )
})

const mealBarMax = computed(() => {
  if (!mealDaysWithData.value.length) return 1
  return Math.max(
    ...mealDaysWithData.value.map((d) => Math.max(d.breakfast, d.lunch, d.dinner)),
    1
  )
})

const runDaysWithData = computed(() => {
  if (!summary.value) return []
  return summary.value.dailyScores.filter((d) => d.runDistance > 0)
})

const runBarMax = computed(() => {
  if (!runDaysWithData.value.length) return 1
  return Math.max(...runDaysWithData.value.map((d) => d.runDistance), 1)
})

function formatDateLabel(dateStr) {
  return dayjs(dateStr).format('M/D')
}

function formatWeekday(dateStr) {
  return dayjs(dateStr).format('ddd')
}

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
      <h1>积分统计</h1>
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

      <div v-if="loading" class="loading">
        <div class="loading-spinner"></div>
        <div>加载中…</div>
      </div>

      <template v-else-if="summary">
        <!-- 净分英雄卡 -->
        <div class="hero-card">
          <div class="hero-label">{{ timeRangeLabel }}净得分</div>
          <div
            class="hero-value"
            :class="summary.netScore >= 0 ? 'positive' : 'negative'"
          >
            {{ summary.netScore >= 0 ? '+' : '' }}{{ summary.netScore }}
          </div>
          <div class="hero-sub">已记录 {{ summary.dayCount }} 天</div>
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

        <!-- 三餐金额总览 -->
        <div v-if="summary.totalMeal > 0" class="meal-hero">
          <div class="meal-hero-label">{{ timeRangeLabel }}三餐花费</div>
          <div class="meal-hero-value">¥{{ summary.totalMeal.toFixed(2) }}</div>
          <div class="meal-hero-breakdown">
            <div>
              <span class="meal-hero-emoji">🌅</span>
              <span class="meal-hero-name">早餐</span>
              <span class="meal-hero-num">¥{{ summary.totalBreakfast.toFixed(2) }}</span>
            </div>
            <div>
              <span class="meal-hero-emoji">☀️</span>
              <span class="meal-hero-name">午餐</span>
              <span class="meal-hero-num">¥{{ summary.totalLunch.toFixed(2) }}</span>
            </div>
            <div>
              <span class="meal-hero-emoji">🌙</span>
              <span class="meal-hero-name">晚餐</span>
              <span class="meal-hero-num">¥{{ summary.totalDinner.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- 跑步统计总览 -->
        <div v-if="summary.totalRunTime > 0 || summary.totalRunDistance > 0" class="run-hero">
          <div class="run-hero-label">{{ timeRangeLabel }}跑步数据</div>
          <div class="run-hero-grid">
            <div class="run-hero-stat">
              <div class="run-hero-emoji">⏱️</div>
              <div class="run-hero-num">{{ formatRunTime(summary.totalRunTime) }}</div>
              <div class="run-hero-name">总用时</div>
            </div>
            <div class="run-hero-stat">
              <div class="run-hero-emoji">📏</div>
              <div class="run-hero-num">{{ summary.totalRunDistance }}</div>
              <div class="run-hero-name">总距离(米)</div>
            </div>
            <div class="run-hero-stat">
              <div class="run-hero-emoji">⚡</div>
              <div class="run-hero-num">{{ summary.runSpeed.toFixed(2) }}</div>
              <div class="run-hero-name">平均速度(米/秒)</div>
            </div>
          </div>
        </div>

        <!-- 每日得分柱状图 -->
        <div v-if="summary.dailyScores.length" class="card">
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
        <div v-if="summary.addReasons.length" class="card">
          <div class="card-title">
            <span class="reason-badge add">+</span>
            加分原因
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
        <div v-if="summary.deductReasons.length" class="card">
          <div class="card-title">
            <span class="reason-badge deduct">−</span>
            扣分原因
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

        <!-- 每日三餐柱状图 -->
        <div v-if="mealDaysWithData.length" class="card">
          <div class="card-title">🍱 每日三餐</div>
          <div class="bar-chart">
            <div
              v-for="day in mealDaysWithData"
              :key="day.date"
              class="bar-group"
            >
              <div class="bar-bars">
                <div
                  class="bar bar-meal-b"
                  :style="{ height: (day.breakfast / mealBarMax) * 100 + '%' }"
                  :title="'早餐: ¥' + day.breakfast"
                >
                  <span class="bar-val" v-if="day.breakfast">¥{{ day.breakfast.toFixed(0) }}</span>
                </div>
                <div
                  class="bar bar-meal-l"
                  :style="{ height: (day.lunch / mealBarMax) * 100 + '%' }"
                  :title="'午餐: ¥' + day.lunch"
                >
                  <span class="bar-val" v-if="day.lunch">¥{{ day.lunch.toFixed(0) }}</span>
                </div>
                <div
                  class="bar bar-meal-d"
                  :style="{ height: (day.dinner / mealBarMax) * 100 + '%' }"
                  :title="'晚餐: ¥' + day.dinner"
                >
                  <span class="bar-val" v-if="day.dinner">¥{{ day.dinner.toFixed(0) }}</span>
                </div>
              </div>
              <div class="bar-label">{{ formatDateLabel(day.date) }}</div>
              <div class="bar-weekday">{{ formatWeekday(day.date) }}</div>
            </div>
          </div>
        </div>

        <!-- 每日跑步距离柱状图 -->
        <div v-if="runDaysWithData.length" class="card">
          <div class="card-title">🏃 每日跑步距离</div>
          <div class="bar-chart">
            <div
              v-for="day in runDaysWithData"
              :key="day.date"
              class="bar-group"
            >
              <div class="bar-bars">
                <div
                  class="bar bar-run"
                  :style="{ height: (day.runDistance / runBarMax) * 100 + '%' }"
                  :title="'距离: ' + day.runDistance + ' 米'"
                >
                  <span class="bar-val" v-if="day.runDistance">{{ day.runDistance }}米</span>
                </div>
              </div>
              <div class="bar-label">{{ formatDateLabel(day.date) }}</div>
              <div class="bar-weekday">{{ formatWeekday(day.date) }}</div>
            </div>
          </div>
        </div>

        <!-- 三餐内容统计 -->
        <div v-if="summary.breakfastReasons.length" class="card">
          <div class="card-title">
            <span class="reason-badge meal">🌅</span>
            早餐内容
          </div>
          <div class="reason-list">
            <div
              v-for="item in summary.breakfastReasons"
              :key="item.reason"
              class="reason-item"
            >
              <div class="reason-info">
                <span class="reason-text">{{ item.reason }}</span>
                <span class="reason-count">{{ item.count }}次</span>
              </div>
              <div class="reason-bar-bg">
                <div
                  class="reason-bar meal"
                  :style="{ width: (item.count / reasonMaxCount(summary.breakfastReasons)) * 100 + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="summary.lunchReasons.length" class="card">
          <div class="card-title">
            <span class="reason-badge meal">☀️</span>
            午餐内容
          </div>
          <div class="reason-list">
            <div
              v-for="item in summary.lunchReasons"
              :key="item.reason"
              class="reason-item"
            >
              <div class="reason-info">
                <span class="reason-text">{{ item.reason }}</span>
                <span class="reason-count">{{ item.count }}次</span>
              </div>
              <div class="reason-bar-bg">
                <div
                  class="reason-bar meal"
                  :style="{ width: (item.count / reasonMaxCount(summary.lunchReasons)) * 100 + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="summary.dinnerReasons.length" class="card">
          <div class="card-title">
            <span class="reason-badge meal">🌙</span>
            晚餐内容
          </div>
          <div class="reason-list">
            <div
              v-for="item in summary.dinnerReasons"
              :key="item.reason"
              class="reason-item"
            >
              <div class="reason-info">
                <span class="reason-text">{{ item.reason }}</span>
                <span class="reason-count">{{ item.count }}次</span>
              </div>
              <div class="reason-bar-bg">
                <div
                  class="reason-bar meal"
                  :style="{ width: (item.count / reasonMaxCount(summary.dinnerReasons)) * 100 + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 每日明细 -->
        <div v-if="summary.dailyScores.length" class="card">
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
                <span class="meal-color-sm" v-if="day.mealTotal">¥{{ day.mealTotal.toFixed(1) }}</span>
                <span class="run-color-sm" v-if="day.runDistance">{{ day.runDistance }}米</span>
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
/* 英雄卡 */
.hero-card {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: 24px 20px;
  margin-bottom: 12px;
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.hero-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}

.hero-value {
  font-size: 64px;
  font-weight: 700;
  letter-spacing: -1.5px;
  line-height: 1.05;
  margin-bottom: 6px;
}

.hero-value.positive { color: var(--color-primary); }
.hero-value.negative { color: var(--color-danger); }

.hero-sub {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* 三餐英雄卡 */
.meal-hero {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: 22px 20px;
  margin-bottom: 12px;
  text-align: center;
  box-shadow: var(--shadow-sm);
  border-left: 4px solid var(--color-warning);
}

.meal-hero-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  font-weight: 500;
}

.meal-hero-value {
  font-size: 44px;
  font-weight: 700;
  color: var(--color-warning);
  letter-spacing: -1px;
  line-height: 1.1;
  margin-bottom: 12px;
}

.meal-hero-breakdown {
  display: flex;
  justify-content: space-around;
  padding-top: 10px;
  border-top: 1px solid rgba(60, 60, 67, 0.08);
}

.meal-hero-breakdown > div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.meal-hero-emoji {
  font-size: 18px;
}

.meal-hero-name {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.meal-hero-num {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

/* 原因徽章 */
.reason-badge {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: white;
}

.reason-badge.add { background: var(--color-success); }
.reason-badge.deduct { background: var(--color-danger); }
.reason-badge.meal { background: var(--color-warning); font-size: 11px; }

/* 柱状图 */
.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 160px;
  padding-top: 22px;
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
  gap: 2px;
  width: 100%;
}

.bar {
  flex: 1;
  min-height: 2px;
  border-radius: 4px 4px 0 0;
  position: relative;
  transition: height 0.5s ease;
}

.bar-add {
  background: linear-gradient(180deg, #5DDF7F, #34C759);
}

.bar-deduct {
  background: linear-gradient(180deg, #FF7875, #FF3B30);
}

.bar-meal-b {
  background: linear-gradient(180deg, #FFD28A, #FFB13B);
}

.bar-meal-l {
  background: linear-gradient(180deg, #FFB13B, #FF9500);
}

.bar-meal-d {
  background: linear-gradient(180deg, #FF9500, #FF7B00);
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

.bar-add .bar-val { color: #248A3D; }
.bar-deduct .bar-val { color: #C92119; }
.bar-meal-b .bar-val,
.bar-meal-l .bar-val,
.bar-meal-d .bar-val { color: #C27400; }

.bar-label {
  font-size: 10px;
  color: var(--color-text-secondary);
  margin-top: 6px;
  font-weight: 500;
}

.bar-weekday {
  font-size: 9px;
  color: var(--color-text-tertiary);
}

/* 原因统计 */
.reason-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
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
}

.reason-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.reason-count {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.reason-bar-bg {
  height: 6px;
  background: var(--color-bg-input);
  border-radius: 3px;
  overflow: hidden;
}

.reason-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
  min-width: 6px;
}

.reason-bar.add {
  background: linear-gradient(90deg, #34C759, #5DDF7F);
}

.reason-bar.deduct {
  background: linear-gradient(90deg, #FF3B30, #FF7875);
}

.reason-bar.meal {
  background: linear-gradient(90deg, #FF9500, #FFB13B);
}

/* 每日明细 */
.detail-list {
  display: flex;
  flex-direction: column;
}

.detail-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(60, 60, 67, 0.08);
}

.detail-item:last-child {
  border-bottom: none;
}

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
  color: var(--color-text-tertiary);
}

.detail-scores {
  flex: 1;
  display: flex;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.detail-net {
  font-size: 16px;
  font-weight: 700;
  width: 50px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.meal-color-sm {
  color: var(--color-warning);
}

.run-color-sm {
  color: #0A7E3B;
}

/* 跑步英雄卡 */
.run-hero {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: 18px 16px 14px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-sm);
  border-left: 4px solid #34C759;
}

.run-hero-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
  font-weight: 500;
  text-align: center;
}

.run-hero-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.run-hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.run-hero-emoji {
  font-size: 18px;
  margin-bottom: 2px;
}

.run-hero-num {
  font-size: 18px;
  font-weight: 700;
  color: #0A7E3B;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
}

.run-hero-name {
  font-size: 11px;
  color: var(--color-text-secondary);
  text-align: center;
}

/* 跑步柱状图 */
.bar-run {
  background: linear-gradient(180deg, #5DDF7F, #34C759);
}

.bar-run .bar-val {
  color: #0A7E3B;
}
</style>