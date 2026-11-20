<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import AppIcon from '../components/AppIcon.vue'
import {
  getRecordsInRange,
  todayKey,
  hasAnyContent,
  roundMoney,
  formatRunTime,
  formatRunPace,
} from '../utils/storage.js'

const router = useRouter()

const currentMonthDate = ref(dayjs().startOf('month'))
const selectedDateKey = ref(todayKey())
const monthRecords = ref({})
const loading = ref(false)
const loadError = ref('')

const monthTitle = computed(() => currentMonthDate.value.format('YYYY年 M月'))

const recordedDayCount = computed(() => Object.keys(monthRecords.value).length)

const calendarDays = computed(() => {
  const startOfMonth = currentMonthDate.value.startOf('month')
  // 周一为第一列：周日(0)补6格，周一(1)补0格
  const startOffset = startOfMonth.day() === 0 ? 6 : startOfMonth.day() - 1
  const daysInMonth = currentMonthDate.value.daysInMonth()
  const days = []

  for (let i = 0; i < startOffset; i++) {
    days.push({ empty: true, key: `prev-${i}` })
  }

  const today = todayKey()
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = startOfMonth.date(i).format('YYYY-MM-DD')
    const rec = monthRecords.value[dateStr]
    const hasRec = Boolean(rec)
    const net = hasRec
      ? Math.round((roundMoney(rec.addPoints) - roundMoney(rec.deductPoints)) * 100) / 100
      : 0

    days.push({
      empty: false,
      date: i,
      dateStr,
      isToday: dateStr === today,
      hasRecord: hasRec,
      net,
    })
  }

  return days
})

const selectedRecord = computed(() => monthRecords.value[selectedDateKey.value] || null)
const isSelectedToday = computed(() => selectedDateKey.value === todayKey())

const selectedNet = computed(() => {
  if (!selectedRecord.value) return 0
  return (
    Math.round(
      (roundMoney(selectedRecord.value.addPoints) - roundMoney(selectedRecord.value.deductPoints)) *
        100
    ) / 100
  )
})

const selectedMealTotal = computed(() => {
  if (!selectedRecord.value) return 0
  return roundMoney(
    roundMoney(selectedRecord.value.breakfastAmount) +
      roundMoney(selectedRecord.value.lunchAmount) +
      roundMoney(selectedRecord.value.dinnerAmount)
  )
})

const hasSelectedRun = computed(() => {
  if (!selectedRecord.value) return false
  return Number(selectedRecord.value.runTime) > 0 || Number(selectedRecord.value.runDistance) > 0
})

let loadSeq = 0

async function loadMonthData(autoPickDay = false) {
  const seq = ++loadSeq
  loading.value = true
  loadError.value = ''
  monthRecords.value = {}

  const monthStart = currentMonthDate.value.startOf('month')
  const startStr = monthStart.format('YYYY-MM-DD')
  const endStr = currentMonthDate.value.endOf('month').format('YYYY-MM-DD')

  try {
    const records = await getRecordsInRange(startStr, endStr)
    if (seq !== loadSeq) return

    const map = {}
    records.forEach((r) => {
      if (r.date && hasAnyContent(r)) {
        map[r.date] = r
      }
    })
    monthRecords.value = map

    // 切换月份后自动对齐选中日期，避免停留在上个查看月份的日期上
    if (autoPickDay) {
      const today = todayKey()
      if (today >= startStr && today <= endStr) {
        selectedDateKey.value = today
      } else {
        const dates = Object.keys(map).sort()
        selectedDateKey.value = dates.length ? dates[dates.length - 1] : startStr
      }
    }
  } catch (err) {
    if (seq !== loadSeq) return
    console.error('加载月度记录失败:', err)
    loadError.value = err.message || '加载失败，请重试'
  } finally {
    if (seq === loadSeq) {
      loading.value = false
    }
  }
}

function prevMonth() {
  currentMonthDate.value = currentMonthDate.value.subtract(1, 'month')
  loadMonthData(true)
}

function nextMonth() {
  currentMonthDate.value = currentMonthDate.value.add(1, 'month')
  loadMonthData(true)
}

function jumpToCurrentMonth() {
  currentMonthDate.value = dayjs().startOf('month')
  selectedDateKey.value = todayKey()
  loadMonthData(false)
}

function selectDate(dateStr) {
  if (!dateStr) return
  selectedDateKey.value = dateStr
}

function goToEdit() {
  if (selectedDateKey.value === todayKey()) {
    router.push({ path: '/' })
  } else {
    router.push({ path: '/', query: { date: selectedDateKey.value } })
  }
}

onMounted(() => {
  loadMonthData(false)
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1>成长日历</h1>
          <p>按月回顾每日打卡与补登</p>
        </div>
        <span class="month-count-pill tabular-nums">本月已记 {{ recordedDayCount }} 天</span>
      </div>
    </div>

    <div class="page-content">
      <!-- 暖色日历卡片 -->
      <div class="card calendar-card">
        <div class="calendar-header">
          <button type="button" class="nav-icon-btn" aria-label="上个月" @click="prevMonth">
            <AppIcon name="chevron-left" :size="18" />
          </button>
          <div class="month-center">
            <span class="month-title">{{ monthTitle }}</span>
            <button
              v-if="currentMonthDate.format('YYYY-MM') !== dayjs().format('YYYY-MM')"
              type="button"
              class="back-month-btn"
              @click="jumpToCurrentMonth"
            >
              回本月
            </button>
          </div>
          <button type="button" class="nav-icon-btn" aria-label="下个月" @click="nextMonth">
            <AppIcon name="chevron-right" :size="18" />
          </button>
        </div>

        <div class="calendar-grid">
          <div v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="weekday">
            {{ w }}
          </div>

          <button
            v-for="day in calendarDays"
            :key="day.dateStr || day.key"
            type="button"
            class="day-cell"
            :disabled="day.empty"
            :class="{
              empty: day.empty,
              'is-today': day.isToday,
              'is-selected': day.dateStr === selectedDateKey,
              'has-pos': day.hasRecord && day.net >= 0,
              'has-neg': day.hasRecord && day.net < 0,
            }"
            @click="selectDate(day.dateStr)"
          >
            <template v-if="!day.empty">
              <span class="day-num tabular-nums">{{ day.date }}</span>
              <span v-if="day.hasRecord" class="day-dot"></span>
            </template>
          </button>
        </div>

        <div class="calendar-legend">
          <span class="legend-chip"><i class="dot pos"></i>净分 ≥ 0</span>
          <span class="legend-chip"><i class="dot neg"></i>净分 &lt; 0</span>
        </div>
      </div>

      <!-- 选中日期的详情卡片 -->
      <div class="detail-section">
        <div class="detail-header">
          <div class="detail-date-wrap">
            <h2 class="detail-date">{{ dayjs(selectedDateKey).format('M月D日 dddd') }}</h2>
            <span v-if="isSelectedToday" class="today-tag">今天</span>
          </div>
          <button type="button" class="detail-edit-link" @click="goToEdit">
            <span>{{ selectedRecord ? '修改此日' : '立即补登' }}</span>
            <AppIcon name="chevron-right" :size="14" />
          </button>
        </div>

        <div v-if="loading" class="loading card">
          <div class="loading-spinner"></div>
          <div>正在读取月度记录…</div>
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
            @click="loadMonthData(false)"
          >
            <AppIcon name="refresh" :size="14" />
            <span>重试</span>
          </button>
        </div>

        <template v-else-if="selectedRecord">
          <div class="card detail-card">
            <!-- 当日核心摘要 -->
            <div class="detail-summary-grid tabular-nums">
              <div class="summary-cell">
                <span
                  class="summary-val"
                  :class="selectedNet >= 0 ? 'points-positive' : 'points-negative'"
                >
                  {{ selectedNet >= 0 ? '+' : '' }}{{ selectedNet }}
                </span>
                <span class="summary-lbl">当日净分</span>
              </div>
              <div class="summary-cell">
                <span class="summary-val meal-color">¥{{ selectedMealTotal.toFixed(2) }}</span>
                <span class="summary-lbl">三餐</span>
              </div>
              <div v-if="selectedRecord.otherExpense > 0" class="summary-cell">
                <span class="summary-val other-color">
                  ¥{{ Number(selectedRecord.otherExpense).toFixed(2) }}
                </span>
                <span class="summary-lbl">其他消费</span>
              </div>
              <div v-if="hasSelectedRun" class="summary-cell">
                <span class="summary-val run-color">
                  {{
                    selectedRecord.runDistance > 0
                      ? `${selectedRecord.runDistance}米`
                      : formatRunTime(selectedRecord.runTime)
                  }}
                </span>
                <span class="summary-lbl">跑步</span>
              </div>
            </div>

            <div class="detail-divider"></div>

            <!-- 详细条目 -->
            <div class="detail-items">
              <div v-if="selectedRecord.addPoints > 0 || selectedRecord.addReason" class="detail-item">
                <div class="item-head">
                  <span class="item-dot add"></span>
                  <span>加分 (+{{ selectedRecord.addPoints || 0 }})</span>
                </div>
                <div class="item-body">{{ selectedRecord.addReason || '未填写原因' }}</div>
              </div>

              <div
                v-if="selectedRecord.deductPoints > 0 || selectedRecord.deductReason"
                class="detail-item"
              >
                <div class="item-head">
                  <span class="item-dot deduct"></span>
                  <span>扣分 (-{{ selectedRecord.deductPoints || 0 }})</span>
                </div>
                <div class="item-body">{{ selectedRecord.deductReason || '未填写原因' }}</div>
              </div>

              <div
                v-if="selectedRecord.breakfastAmount > 0 || selectedRecord.breakfastContent"
                class="detail-item"
              >
                <div class="item-head">
                  <span class="item-dot meal"></span>
                  <span>早餐 (¥{{ Number(selectedRecord.breakfastAmount || 0).toFixed(2) }})</span>
                </div>
                <div class="item-body">{{ selectedRecord.breakfastContent || '未填写内容' }}</div>
              </div>

              <div
                v-if="selectedRecord.lunchAmount > 0 || selectedRecord.lunchContent"
                class="detail-item"
              >
                <div class="item-head">
                  <span class="item-dot meal"></span>
                  <span>午餐 (¥{{ Number(selectedRecord.lunchAmount || 0).toFixed(2) }})</span>
                </div>
                <div class="item-body">{{ selectedRecord.lunchContent || '未填写内容' }}</div>
              </div>

              <div
                v-if="selectedRecord.dinnerAmount > 0 || selectedRecord.dinnerContent"
                class="detail-item"
              >
                <div class="item-head">
                  <span class="item-dot meal"></span>
                  <span>晚餐 (¥{{ Number(selectedRecord.dinnerAmount || 0).toFixed(2) }})</span>
                </div>
                <div class="item-body">{{ selectedRecord.dinnerContent || '未填写内容' }}</div>
              </div>

              <div
                v-if="selectedRecord.otherExpense > 0 || selectedRecord.otherExpenseReason"
                class="detail-item"
              >
                <div class="item-head">
                  <span class="item-dot other"></span>
                  <span>其他消费 (¥{{ Number(selectedRecord.otherExpense || 0).toFixed(2) }})</span>
                </div>
                <div class="item-body">{{ selectedRecord.otherExpenseReason || '未填写原因' }}</div>
              </div>

              <div v-if="hasSelectedRun" class="detail-item">
                <div class="item-head">
                  <span class="item-dot run"></span>
                  <span>跑步运动</span>
                </div>
                <div class="item-body tabular-nums">
                  用时 {{ formatRunTime(selectedRecord.runTime) }} · 距离
                  {{ selectedRecord.runDistance || 0 }} 米
                  <template v-if="selectedRecord.runTime > 0 && selectedRecord.runDistance > 0">
                    · 配速 {{ formatRunPace(selectedRecord.runTime, selectedRecord.runDistance) }}
                  </template>
                </div>
              </div>
            </div>
          </div>

          <button type="button" class="btn btn-lg btn-outline" @click="goToEdit">
            <AppIcon name="edit" :size="17" />
            <span>修改此日记录</span>
          </button>
        </template>

        <template v-else>
          <div class="empty-state">
            <div class="empty-icon-wrap">
              <AppIcon name="calendar" :size="22" />
            </div>
            <p class="empty-title">这一天还没有记录</p>
            <p class="empty-sub">点击下方按钮可直接补登积分、三餐或跑步</p>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              style="margin-top: 14px;"
              @click="goToEdit"
            >
              立即补登
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.month-count-pill {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary-deep);
  background: var(--color-primary-light);
  padding: 5px 11px;
  border-radius: 999px;
  flex-shrink: 0;
}

.calendar-card {
  padding: 16px 14px 14px;
  margin-bottom: 16px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.month-center {
  display: flex;
  align-items: center;
  gap: 8px;
}

.month-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text);
}

.back-month-btn {
  border: none;
  background: var(--color-primary-light);
  color: var(--color-primary-deep);
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  cursor: pointer;
}

.nav-icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: var(--color-bg-muted);
  border: none;
  color: var(--color-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  text-align: center;
}

.weekday {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-tertiary);
  padding-bottom: 4px;
}

.day-cell {
  aspect-ratio: 1;
  border: 1.5px solid transparent;
  background: transparent;
  border-radius: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.14s ease, border-color 0.14s ease;
}

.day-cell.empty {
  cursor: default;
}

.day-cell.has-pos {
  background: var(--color-success-light);
  color: #065F46;
}

.day-cell.has-neg {
  background: var(--color-danger-light);
  color: #9F1239;
}

.day-cell.is-today:not(.is-selected) {
  border-color: var(--color-primary);
  color: var(--color-primary-deep);
}

.day-cell.is-selected {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-accent));
  color: #FFFFFF;
  box-shadow: 0 4px 12px rgba(217, 119, 6, 0.28);
}

.day-num {
  line-height: 1;
}

.day-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.7;
}

.day-cell.is-selected .day-dot {
  background: #FFFFFF;
  opacity: 1;
}

.calendar-legend {
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-divider);
}

.legend-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
}

.legend-chip .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-chip .dot.pos {
  background: var(--color-success);
}

.legend-chip .dot.neg {
  background: var(--color-danger);
}

/* 详情区 */
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 0 2px;
}

.detail-date-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-date {
  font-size: 17px;
  font-weight: 800;
  color: var(--color-text);
}

.today-tag {
  font-size: 11px;
  font-weight: 700;
  background: var(--color-primary-light);
  color: var(--color-primary-deep);
  padding: 2px 8px;
  border-radius: 999px;
}

.detail-edit-link {
  border: none;
  background: transparent;
  color: var(--color-primary-deep);
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  font-family: inherit;
}

.detail-summary-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  gap: 10px;
  padding: 10px 8px;
  background: var(--color-bg-muted);
  border-radius: 14px;
}

.summary-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 68px;
}

.summary-val {
  font-size: 17px;
  font-weight: 800;
}

.summary-lbl {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.detail-divider {
  height: 1px;
  background: var(--color-divider);
  margin: 14px 0;
}

.detail-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 3px;
}

.item-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.item-dot.add { background: var(--color-success); }
.item-dot.deduct { background: var(--color-danger); }
.item-dot.meal { background: var(--color-primary); }
.item-dot.other { background: var(--color-other); }
.item-dot.run { background: var(--color-run); }

.item-body {
  font-size: 14px;
  color: var(--color-text-secondary);
  padding-left: 15px;
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
