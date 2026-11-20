<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import AppIcon from '../components/AppIcon.vue'
import DailyBarChart from '../components/DailyBarChart.vue'
import ReasonRankCard from '../components/ReasonRankCard.vue'
import {
  getThisWeekRecords,
  getThisMonthRecords,
  summarizeRecords,
  formatRunTime,
  formatRunPace,
  todayKey,
} from '../utils/storage.js'

const router = useRouter()

const timeRange = ref('week')
const summary = ref(null)
const loading = ref(false)
const loadError = ref('')

const timeRangeLabel = computed(() => (timeRange.value === 'week' ? '本周' : '本月'))

const dateRangeText = computed(() => {
  if (timeRange.value === 'week') {
    const s = dayjs().startOf('isoWeek')
    const e = dayjs().endOf('isoWeek')
    return `${s.format('M月D日')} – ${e.format('M月D日')}`
  }
  return dayjs().format('YYYY年M月')
})

let loadSeq = 0

async function loadStats() {
  const seq = ++loadSeq
  loading.value = true
  loadError.value = ''

  try {
    const records =
      timeRange.value === 'week' ? await getThisWeekRecords() : await getThisMonthRecords()
    if (seq !== loadSeq) return
    summary.value = summarizeRecords(records)
  } catch (err) {
    if (seq !== loadSeq) return
    console.error('加载统计数据失败:', err)
    loadError.value = err.message || '加载统计数据失败，请重试'
  } finally {
    if (seq === loadSeq) {
      loading.value = false
    }
  }
}

function switchRange(range) {
  if (timeRange.value === range) return
  timeRange.value = range
  loadStats()
}

// 过滤各图表的有效日期
const scoreDays = computed(() => {
  if (!summary.value) return []
  return summary.value.dailyScores.filter((d) => d.add > 0 || d.deduct > 0)
})

const mealDays = computed(() => {
  if (!summary.value) return []
  return summary.value.dailyScores.filter((d) => d.breakfast > 0 || d.lunch > 0 || d.dinner > 0)
})

const runDays = computed(() => {
  if (!summary.value) return []
  return summary.value.dailyScores.filter((d) => d.runDistance > 0)
})

const otherExpenseDays = computed(() => {
  if (!summary.value) return []
  return summary.value.dailyScores.filter((d) => d.otherExpense > 0)
})

const scoreSeries = [
  { key: 'add', label: '加分', colorClass: 'bar-add', prefix: '+' },
  { key: 'deduct', label: '扣分', colorClass: 'bar-deduct', prefix: '-' },
]

const mealSeries = [
  { key: 'breakfast', label: '早', colorClass: 'bar-meal-b', prefix: '¥', decimals: 0 },
  { key: 'lunch', label: '午', colorClass: 'bar-meal-l', prefix: '¥', decimals: 0 },
  { key: 'dinner', label: '晚', colorClass: 'bar-meal-d', prefix: '¥', decimals: 0 },
]

const runSeries = [{ key: 'runDistance', label: '距离', colorClass: 'bar-run', suffix: 'm' }]

const otherSeries = [
  { key: 'otherExpense', label: '金额', colorClass: 'bar-other', prefix: '¥', decimals: 0 },
]

const avgRunPace = computed(() => {
  if (!summary.value) return '--'
  return formatRunPace(summary.value.totalRunTime, summary.value.totalRunDistance)
})

function formatDateLabel(dateStr) {
  return dayjs(dateStr).format('M/D')
}

function formatWeekday(dateStr) {
  return dayjs(dateStr).format('ddd')
}

function openDayRecord(dateStr) {
  if (dateStr === todayKey()) {
    router.push({ path: '/' })
  } else {
    router.push({ path: '/', query: { date: dateStr } })
  }
}

onMounted(() => {
  loadStats()
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1>数据复盘</h1>
          <p>{{ dateRangeText }}</p>
        </div>

        <div class="segmented-control header-seg">
          <button
            type="button"
            class="segmented-item"
            :class="{ active: timeRange === 'week' }"
            @click="switchRange('week')"
          >
            本周
          </button>
          <button
            type="button"
            class="segmented-item"
            :class="{ active: timeRange === 'month' }"
            @click="switchRange('month')"
          >
            本月
          </button>
        </div>
      </div>
    </div>

    <div class="page-content">
      <div v-if="loading" class="loading card">
        <div class="loading-spinner"></div>
        <div>正在汇总数据…</div>
      </div>

      <div v-else-if="loadError" class="error-card">
        <div class="empty-icon-wrap">
          <AppIcon name="alert" :size="22" />
        </div>
        <p class="error-text">{{ loadError }}</p>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          style="margin-top: 12px;"
          @click="loadStats"
        >
          <AppIcon name="refresh" :size="14" />
          <span>重新加载</span>
        </button>
      </div>

      <template v-else-if="summary">
        <!-- 核心 2x2 指标卡（净得分 + 总花销） -->
        <div class="kpi-grid">
          <div class="card kpi-card primary-kpi">
            <div class="kpi-label">{{ timeRangeLabel }}净得分</div>
            <div
              class="kpi-value tabular-nums"
              :class="summary.netScore >= 0 ? 'primary-num' : 'points-negative'"
            >
              {{ summary.netScore >= 0 ? '+' : '' }}{{ summary.netScore }}
            </div>
            <div class="kpi-sub tabular-nums">
              <span class="points-positive">加 {{ summary.totalAdd }}</span>
              <span class="sep">·</span>
              <span class="points-negative">扣 {{ summary.totalDeduct }}</span>
            </div>
            <div class="kpi-foot tabular-nums">有效打卡 {{ summary.dayCount }} 天</div>
          </div>

          <div class="card kpi-card">
            <div class="kpi-label">{{ timeRangeLabel }}总花销</div>
            <div class="kpi-value meal-color tabular-nums">
              ¥{{ summary.totalSpend.toFixed(0) }}
            </div>
            <div class="kpi-sub tabular-nums">
              <span>三餐 ¥{{ summary.totalMeal.toFixed(0) }}</span>
              <span class="sep">·</span>
              <span class="other-color">其他 ¥{{ summary.totalOtherExpense.toFixed(0) }}</span>
            </div>
            <div class="kpi-foot tabular-nums">
              日均 ¥{{
                summary.dayCount > 0 ? (summary.totalSpend / summary.dayCount).toFixed(1) : '0.0'
              }}
            </div>
          </div>
        </div>

        <!-- 三餐花费拆分卡 -->
        <div v-if="summary.totalMeal > 0" class="card meal-breakdown-card">
          <div class="card-title">
            <div class="card-title-left">
              <span class="mini-badge meal">
                <AppIcon name="utensils" :size="15" />
              </span>
              <span>{{ timeRangeLabel }}三餐分布</span>
            </div>
            <span class="meal-total-text tabular-nums">¥{{ summary.totalMeal.toFixed(2) }}</span>
          </div>
          <div class="meal-three-grid tabular-nums">
            <div class="meal-cell">
              <span class="meal-cell-icon"><AppIcon name="sunrise" :size="16" /></span>
              <span class="meal-cell-name">早餐</span>
              <span class="meal-cell-val">¥{{ summary.totalBreakfast.toFixed(2) }}</span>
            </div>
            <div class="meal-cell">
              <span class="meal-cell-icon"><AppIcon name="sun" :size="16" /></span>
              <span class="meal-cell-name">午餐</span>
              <span class="meal-cell-val">¥{{ summary.totalLunch.toFixed(2) }}</span>
            </div>
            <div class="meal-cell">
              <span class="meal-cell-icon"><AppIcon name="moon" :size="16" /></span>
              <span class="meal-cell-name">晚餐</span>
              <span class="meal-cell-val">¥{{ summary.totalDinner.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- 跑步累计汇总卡 -->
        <div
          v-if="summary.totalRunTime > 0 || summary.totalRunDistance > 0"
          class="card run-summary-card"
        >
          <div class="card-title">
            <div class="card-title-left">
              <span class="mini-badge run">
                <AppIcon name="run" :size="15" />
              </span>
              <span>{{ timeRangeLabel }}跑步累计</span>
            </div>
            <span v-if="summary.runSpeed > 0" class="pace-chip tabular-nums">
              均配速 {{ avgRunPace }}
            </span>
          </div>
          <div class="run-grid tabular-nums">
            <div class="run-cell">
              <div class="run-num">{{ formatRunTime(summary.totalRunTime) }}</div>
              <div class="run-lbl">总用时</div>
            </div>
            <div class="run-cell">
              <div class="run-num">
                {{
                  summary.totalRunDistance >= 1000
                    ? `${(summary.totalRunDistance / 1000).toFixed(2)} km`
                    : `${summary.totalRunDistance} 米`
                }}
              </div>
              <div class="run-lbl">总距离</div>
            </div>
            <div class="run-cell">
              <div class="run-num">{{ summary.runSpeed.toFixed(2) }}</div>
              <div class="run-lbl">米/秒</div>
            </div>
          </div>
        </div>

        <!-- 每日趋势柱状图（自动支持月度横向滚动） -->
        <DailyBarChart
          title="每日加扣分趋势"
          icon="chart"
          icon-variant="primary"
          :days="scoreDays"
          :series="scoreSeries"
        />

        <DailyBarChart
          title="每日三餐花费"
          icon="utensils"
          icon-variant="meal"
          :days="mealDays"
          :series="mealSeries"
        />

        <DailyBarChart
          title="每日跑步距离"
          icon="run"
          icon-variant="run"
          :days="runDays"
          :series="runSeries"
        />

        <DailyBarChart
          title="每日其他消费"
          icon="bag"
          icon-variant="other"
          :days="otherExpenseDays"
          :series="otherSeries"
        />

        <!-- 原因与内容频次排行（复用组件） -->
        <ReasonRankCard
          title="高频加分习惯"
          icon="spark"
          variant="add"
          :items="summary.addReasons"
        />
        <ReasonRankCard
          title="扣分原因复盘"
          icon="minus"
          variant="deduct"
          :items="summary.deductReasons"
        />
        <ReasonRankCard
          title="早餐常吃"
          icon="sunrise"
          variant="meal"
          :items="summary.breakfastReasons"
        />
        <ReasonRankCard
          title="午餐常吃"
          icon="sun"
          variant="meal"
          :items="summary.lunchReasons"
        />
        <ReasonRankCard
          title="晚餐常吃"
          icon="moon"
          variant="meal"
          :items="summary.dinnerReasons"
        />
        <ReasonRankCard
          title="其他消费项"
          icon="bag"
          variant="other"
          :items="summary.otherExpenseReasons"
        />

        <!-- 每日明细列表（点击可直接跳去查看/编辑） -->
        <div v-if="summary.dailyScores.length" class="card">
          <div class="card-title">
            <div class="card-title-left">
              <span class="mini-badge primary">
                <AppIcon name="calendar" :size="15" />
              </span>
              <span>每日明细</span>
            </div>
            <span class="detail-tip">点击可编辑</span>
          </div>

          <div class="detail-list">
            <button
              v-for="day in [...summary.dailyScores].reverse()"
              :key="day.date"
              type="button"
              class="detail-row"
              @click="openDayRecord(day.date)"
            >
              <div class="detail-date tabular-nums">
                <span class="detail-day">{{ formatDateLabel(day.date) }}</span>
                <span class="detail-weekday">{{ formatWeekday(day.date) }}</span>
              </div>

              <div class="detail-chips tabular-nums">
                <span v-if="day.add > 0" class="chip add">+{{ day.add }}</span>
                <span v-if="day.deduct > 0" class="chip deduct">-{{ day.deduct }}</span>
                <span v-if="day.mealTotal > 0" class="chip meal">
                  餐 ¥{{ day.mealTotal.toFixed(1) }}
                </span>
                <span v-if="day.otherExpense > 0" class="chip other">
                  杂 ¥{{ day.otherExpense.toFixed(1) }}
                </span>
                <span v-if="day.runDistance > 0" class="chip run">
                  跑 {{ day.runDistance }}m
                </span>
              </div>

              <div
                class="detail-net tabular-nums"
                :class="day.net >= 0 ? 'points-positive' : 'points-negative'"
              >
                {{ day.net >= 0 ? '+' : '' }}{{ day.net }}
              </div>
            </button>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="summary.dayCount === 0" class="empty-state">
          <div class="empty-icon-wrap">
            <AppIcon name="chart" :size="24" />
          </div>
          <p class="empty-title">{{ timeRangeLabel }}还没有打卡记录</p>
          <p class="empty-sub">去「今日记录」记下第一笔成长数据吧</p>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            style="margin-top: 14px;"
            @click="router.push('/')"
          >
            去打卡
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-seg {
  width: 132px;
  flex-shrink: 0;
}

.header-seg .segmented-item {
  min-height: 32px;
  font-size: 12px;
  padding: 4px 8px;
}

/* 核心 2x2 KPI 卡片 */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.kpi-card {
  margin-bottom: 0;
  padding: 15px 14px;
}

.primary-kpi {
  background: linear-gradient(180deg, #FFFDF8 0%, #FFFFFF 100%);
  border-color: #FDE68A;
}

.kpi-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-tertiary);
}

.kpi-value {
  font-size: 32px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.8px;
  margin-top: 4px;
}

.primary-num {
  color: var(--color-primary);
}

.kpi-sub {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
  margin-top: 6px;
}

.kpi-sub .sep {
  margin: 0 4px;
  color: var(--color-text-tertiary);
}

.kpi-foot {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 3px;
}

/* 小图标徽章 */
.mini-badge {
  width: 26px;
  height: 26px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.mini-badge.primary {
  background: var(--color-primary-light);
  color: var(--color-primary-deep);
}
.mini-badge.meal {
  background: var(--color-meal-light);
  color: var(--color-primary-deep);
}
.mini-badge.run {
  background: var(--color-run-light);
  color: var(--color-run);
}

/* 三餐分布 */
.meal-total-text {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-primary-deep);
}

.meal-three-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.meal-cell {
  background: var(--color-bg-muted);
  border-radius: 14px;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}

.meal-cell-icon {
  color: var(--color-primary-deep);
}

.meal-cell-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
}

.meal-cell-val {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-text);
}

/* 跑步汇总 */
.pace-chip {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-success);
  background: var(--color-success-light);
  padding: 3px 9px;
  border-radius: 999px;
}

.run-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.run-cell {
  background: var(--color-success-light);
  border-radius: 14px;
  padding: 10px 6px;
  text-align: center;
}

.run-num {
  font-size: 15px;
  font-weight: 800;
  color: #065F46;
}

.run-lbl {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-success);
  margin-top: 2px;
}

/* 每日明细 */
.detail-tip {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
}

.detail-list {
  display: flex;
  flex-direction: column;
}

.detail-row {
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 4px;
  border-bottom: 1px solid var(--color-divider);
  cursor: pointer;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row:active {
  background: var(--color-bg-muted);
  border-radius: 10px;
}

.detail-date {
  width: 44px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.detail-day {
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text);
}

.detail-weekday {
  font-size: 10px;
  color: var(--color-text-tertiary);
}

.detail-chips {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.chip {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 7px;
}
.chip.add {
  background: var(--color-success-light);
  color: var(--color-success);
}
.chip.deduct {
  background: var(--color-danger-light);
  color: var(--color-danger);
}
.chip.meal {
  background: var(--color-meal-light);
  color: var(--color-primary-deep);
}
.chip.other {
  background: var(--color-other-light);
  color: var(--color-other);
}
.chip.run {
  background: var(--color-run-light);
  color: #065F46;
}

.detail-net {
  width: 42px;
  flex-shrink: 0;
  text-align: right;
  font-size: 16px;
  font-weight: 800;
}

.empty-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

.empty-sub {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

.error-text {
  font-size: 14px;
  color: var(--color-danger);
  font-weight: 600;
}
</style>
