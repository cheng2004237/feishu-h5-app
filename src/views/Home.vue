<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import AppIcon from '../components/AppIcon.vue'
import {
  getWeekRecordsForDate,
  saveDayRecord,
  todayKey,
  isValidDateKey,
  summarizeRecords,
  getReasonHistory,
  emptyRecord,
  hasAnyContent,
  roundMoney,
  formatRunPace,
  getWeeklyGoal,
  setWeeklyGoal,
  REASON_SPLIT_RE,
} from '../utils/storage.js'

const route = useRoute()
const router = useRouter()

// 当前编辑日期（自动拦截非法 query.date）
const currentDateKey = computed(() => {
  const q = route.query.date
  return isValidDateKey(q) ? q : todayKey()
})

const isToday = computed(() => currentDateKey.value === todayKey())

const isCurrentWeek = computed(() => {
  const cur = dayjs(currentDateKey.value).startOf('isoWeek').format('YYYY-MM-DD')
  const now = dayjs(todayKey()).startOf('isoWeek').format('YYYY-MM-DD')
  return cur === now
})

const displayDateText = computed(() => {
  return dayjs(currentDateKey.value).format('M月D日 dddd')
})

// 表单与页面状态
const form = ref(emptyRecord(currentDateKey.value))
const runMinutes = ref('')
const runSeconds = ref('')
const activeSection = ref('points') // points | spend | run

const loading = ref(true)
const loadError = ref('')
const hasExisting = ref(false)
const saving = ref(false)

// 周数据缓存（单次拉取供勋章卡 + 周历条 + 当前日表单共用）
const weekRecordsMap = ref({})
const weekSummary = ref({
  totalAdd: 0,
  totalDeduct: 0,
  netScore: 0,
  totalMeal: 0,
  totalOtherExpense: 0,
  totalSpend: 0,
  streakDays: 0,
  dayCount: 0,
})

// 周目标自定义
const weeklyGoal = ref(getWeeklyGoal())
const editingGoal = ref(false)
const goalDraft = ref(String(weeklyGoal.value))

// 历史候选标签
const tags = ref({
  add: [],
  deduct: [],
  breakfast: [],
  lunch: [],
  dinner: [],
  otherExpense: [],
})

const mealConfigs = [
  {
    key: 'breakfast',
    label: '早餐',
    icon: 'sunrise',
    amountField: 'breakfastAmount',
    contentField: 'breakfastContent',
    placeholder: '早餐吃了什么（多个用顿号分隔）',
    presets: [8, 12, 15],
  },
  {
    key: 'lunch',
    label: '午餐',
    icon: 'sun',
    amountField: 'lunchAmount',
    contentField: 'lunchContent',
    placeholder: '午餐吃了什么（多个用顿号分隔）',
    presets: [15, 20, 25],
  },
  {
    key: 'dinner',
    label: '晚餐',
    icon: 'moon',
    amountField: 'dinnerAmount',
    contentField: 'dinnerContent',
    placeholder: '晚餐吃了什么（多个用顿号分隔）',
    presets: [15, 20, 25],
  },
]

const runDistancePresets = [400, 800, 1000, 1500]
const otherExpensePresets = [5, 10, 20, 50]

// 本周（或所选日期所在周）7天横条
const weekStripDays = computed(() => {
  const start = dayjs(currentDateKey.value).startOf('isoWeek')
  const labels = ['一', '二', '三', '四', '五', '六', '日']
  const list = []
  for (let i = 0; i < 7; i++) {
    const d = start.add(i, 'day')
    const dateStr = d.format('YYYY-MM-DD')
    const rec = weekRecordsMap.value[dateStr]
    const hasRec = hasAnyContent(rec)
    const net = hasRec
      ? Math.round(((Number(rec.addPoints) || 0) - (Number(rec.deductPoints) || 0)) * 100) / 100
      : 0
    list.push({
      weekday: labels[i],
      dayNum: d.date(),
      dateStr,
      isSelected: dateStr === currentDateKey.value,
      isToday: dateStr === todayKey(),
      hasRecord: hasRec,
      net,
    })
  }
  return list
})

// 当日实时小计（用于分段 Tab 徽标展示）
const todayNet = computed(() => {
  const add = roundMoney(form.value.addPoints)
  const ded = roundMoney(form.value.deductPoints)
  return Math.round((add - ded) * 100) / 100
})

const todayMealTotal = computed(() => {
  return roundMoney(
    roundMoney(form.value.breakfastAmount) +
      roundMoney(form.value.lunchAmount) +
      roundMoney(form.value.dinnerAmount)
  )
})

const todayTotalSpend = computed(() => {
  return roundMoney(todayMealTotal.value + roundMoney(form.value.otherExpense))
})

// 结合当前表单未保存改动的实时周净分预览
const liveWeekNet = computed(() => {
  const saved = weekRecordsMap.value[currentDateKey.value]
  const savedNet = saved
    ? Math.round((roundMoney(saved.addPoints) - roundMoney(saved.deductPoints)) * 100) / 100
    : 0
  return Math.round((weekSummary.value.netScore - savedNet + todayNet.value) * 100) / 100
})

const goalProgress = computed(() => {
  if (weeklyGoal.value <= 0) return 0
  const pct = Math.round((Math.max(0, liveWeekNet.value) / weeklyGoal.value) * 100)
  return Math.min(100, pct)
})

const runPaceText = computed(() => formatRunPace(form.value.runTime, form.value.runDistance))

const runSpeedText = computed(() => {
  if (form.value.runTime > 0 && form.value.runDistance > 0) {
    return (form.value.runDistance / form.value.runTime).toFixed(2)
  }
  return ''
})

// Toast 管理（带定时器清理）
const showToast = ref(false)
const toastMessage = ref('')
let toastTimer = null

function showMessage(msg) {
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = msg
  showToast.value = true
  toastTimer = setTimeout(() => {
    showToast.value = false
    toastTimer = null
  }, 2000)
}

function loadReasonTags() {
  tags.value = {
    add: getReasonHistory('add'),
    deduct: getReasonHistory('deduct'),
    breakfast: getReasonHistory('breakfast'),
    lunch: getReasonHistory('lunch'),
    dinner: getReasonHistory('dinner'),
    otherExpense: getReasonHistory('otherExpense'),
  }
}

function bump(field, delta) {
  const cur = roundMoney(form.value[field])
  form.value[field] = roundMoney(cur + delta)
}

function clampField(field) {
  form.value[field] = roundMoney(form.value[field])
}

function setPreset(field, val) {
  form.value[field] = roundMoney(val)
}

function toggleReason(field, tag) {
  const parts = form.value[field]
    ? form.value[field].split(REASON_SPLIT_RE).map((s) => s.trim()).filter(Boolean)
    : []
  const idx = parts.indexOf(tag)
  if (idx >= 0) {
    parts.splice(idx, 1)
  } else {
    parts.push(tag)
  }
  form.value[field] = parts.join('、')
}

function isSelected(field, tag) {
  if (!form.value[field]) return false
  return form.value[field]
    .split(REASON_SPLIT_RE)
    .map((s) => s.trim())
    .includes(tag)
}

function syncRunFormFromTotal() {
  const total = Math.max(0, Math.floor(Number(form.value.runTime) || 0))
  runMinutes.value = total ? String(Math.floor(total / 60)) : ''
  runSeconds.value = total ? String(total % 60) : ''
}

function writeBackRunTime() {
  const m = Math.max(0, Math.floor(Number(runMinutes.value) || 0))
  const s = Math.max(0, Math.floor(Number(runSeconds.value) || 0))
  form.value.runTime = m * 60 + s
}

function normalizeRunInputs() {
  writeBackRunTime()
  syncRunFormFromTotal()
}

function openGoalEditor() {
  goalDraft.value = String(weeklyGoal.value)
  editingGoal.value = true
}

function saveGoal() {
  weeklyGoal.value = setWeeklyGoal(goalDraft.value)
  editingGoal.value = false
  showMessage(`周目标已设为 ${weeklyGoal.value} 分`)
}

// 切换日期 / 切换周
function selectDate(dateStr) {
  if (dateStr === currentDateKey.value) return
  if (dateStr === todayKey()) {
    router.replace({ path: '/' })
  } else {
    router.replace({ path: '/', query: { date: dateStr } })
  }
}

function shiftWeek(weeks) {
  const target = dayjs(currentDateKey.value).add(weeks, 'week').format('YYYY-MM-DD')
  selectDate(target)
}

function backToToday() {
  router.replace({ path: '/' })
}

// 数据加载（防竞态 + 单次周请求）
let loadSeq = 0

async function loadDataForDate(dateKey) {
  const seq = ++loadSeq
  loading.value = true
  loadError.value = ''
  form.value = emptyRecord(dateKey)
  hasExisting.value = false
  syncRunFormFromTotal()

  try {
    const weekRecords = await getWeekRecordsForDate(dateKey)
    if (seq !== loadSeq) return

    const map = {}
    weekRecords.forEach((r) => {
      if (r.date) map[r.date] = r
    })
    weekRecordsMap.value = map
    const streakRef = isCurrentWeek.value ? todayKey() : dateKey
    weekSummary.value = summarizeRecords(weekRecords, streakRef)

    const existing = map[dateKey]
    if (existing) {
      form.value = { ...emptyRecord(dateKey), ...existing }
      hasExisting.value = hasAnyContent(existing)
    } else {
      form.value = emptyRecord(dateKey)
      hasExisting.value = false
    }
    syncRunFormFromTotal()
    loadReasonTags()
  } catch (err) {
    if (seq !== loadSeq) return
    console.error('加载数据失败:', err)
    loadError.value = err.message || '网络异常，无法加载飞书记录'
  } finally {
    if (seq === loadSeq) {
      loading.value = false
    }
  }
}

async function handleSave() {
  if (saving.value || loading.value || loadError.value) return
  saving.value = true
  try {
    normalizeRunInputs()
    const payload = {
      ...form.value,
      date: currentDateKey.value,
      addPoints: roundMoney(form.value.addPoints),
      deductPoints: roundMoney(form.value.deductPoints),
      breakfastAmount: roundMoney(form.value.breakfastAmount),
      lunchAmount: roundMoney(form.value.lunchAmount),
      dinnerAmount: roundMoney(form.value.dinnerAmount),
      otherExpense: roundMoney(form.value.otherExpense),
      runDistance: roundMoney(form.value.runDistance),
    }

    const res = await saveDayRecord(payload)
    form.value = { ...payload, id: res.id || payload.id }
    hasExisting.value = hasAnyContent(form.value)

    // 本地立即更新本周缓存与汇总，避免额外一次全表扫描
    const nextMap = { ...weekRecordsMap.value, [currentDateKey.value]: { ...form.value } }
    weekRecordsMap.value = nextMap
    const streakRef = isCurrentWeek.value ? todayKey() : currentDateKey.value
    weekSummary.value = summarizeRecords(Object.values(nextMap), streakRef)

    loadReasonTags()
    showMessage(res.action === 'updated' ? '已更新该日成长记录' : '已保存该日成长记录')
  } catch (err) {
    console.error(err)
    showMessage(err.message || '保存失败，请重试')
  } finally {
    saving.value = false
  }
}

watch(currentDateKey, (newDate) => {
  loadDataForDate(newDate)
})

onMounted(() => {
  loadReasonTags()
  loadDataForDate(currentDateKey.value)
})

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="page">
    <div class="page-content home-content">
      <!-- 补登非今日时的提示横幅 -->
      <div v-if="!isToday" class="backfill-banner">
        <div class="banner-left">
          <AppIcon name="alert" :size="16" />
          <span>正在补登/修改 <strong>{{ currentDateKey }}</strong> 的记录</span>
        </div>
        <button class="banner-btn" type="button" @click="backToToday">回到今天</button>
      </div>

      <!-- 顶部暖色成长勋章大卡 -->
      <section class="hero-medal-card">
        <div class="hero-top">
          <div>
            <div class="hero-date-row">
              <span>{{ displayDateText }}</span>
              <span v-if="hasExisting" class="status-pill">已打卡</span>
            </div>
            <div class="hero-score-row">
              <span class="hero-score tabular-nums">
                {{ liveWeekNet >= 0 ? '+' : '' }}{{ liveWeekNet }}
              </span>
              <span class="hero-score-label">{{ isCurrentWeek ? '本周净分' : '该周净分' }}</span>
            </div>
          </div>

          <div class="streak-badge">
            <div class="streak-num tabular-nums">
              <AppIcon name="flame" :size="16" :stroke-width="2.2" />
              <span>{{ weekSummary.streakDays }}天</span>
            </div>
            <div class="streak-label">{{ isCurrentWeek ? '连续打卡' : '该周连卡' }}</div>
          </div>
        </div>

        <!-- 周目标进度条（点击可自定义目标） -->
        <div class="goal-box">
          <div class="goal-head">
            <button
              v-if="!editingGoal"
              type="button"
              class="goal-trigger"
              @click="openGoalEditor"
            >
              <AppIcon name="target" :size="13" />
              <span>周目标 {{ weeklyGoal }} 分 · 点此调整</span>
            </button>
            <div v-else class="goal-editor">
              <input
                v-model="goalDraft"
                type="number"
                inputmode="numeric"
                min="1"
                class="goal-input"
                @keyup.enter="saveGoal"
              />
              <button type="button" class="goal-save-btn" @click="saveGoal">确定</button>
            </div>
            <span class="goal-pct tabular-nums">{{ goalProgress }}%</span>
          </div>
          <div class="goal-track">
            <div class="goal-fill" :style="{ width: goalProgress + '%' }"></div>
          </div>
        </div>

        <!-- 周统计微栏 -->
        <div class="hero-foot tabular-nums">
          <span>加分 <strong>+{{ weekSummary.totalAdd }}</strong></span>
          <span class="foot-dot"></span>
          <span>扣分 <strong>-{{ weekSummary.totalDeduct }}</strong></span>
          <span class="foot-dot"></span>
          <span>总花销 <strong>¥{{ weekSummary.totalSpend.toFixed(0) }}</strong></span>
        </div>
      </section>

      <!-- 本周横向日历条（支持切周、一键切换任意一天） -->
      <section class="week-strip-wrap">
        <button
          type="button"
          class="week-nav-btn"
          aria-label="上一周"
          @click="shiftWeek(-1)"
        >
          <AppIcon name="chevron-left" :size="16" />
        </button>

        <div class="week-strip">
          <button
            v-for="day in weekStripDays"
            :key="day.dateStr"
            type="button"
            class="week-day-btn"
            :class="{
              selected: day.isSelected,
              'is-today': day.isToday && !day.isSelected,
            }"
            @click="selectDate(day.dateStr)"
          >
            <span class="wd-label">{{ day.weekday }}</span>
            <span class="wd-num tabular-nums">{{ day.dayNum }}</span>
            <span
              class="wd-dot"
              :class="{
                visible: day.hasRecord,
                neg: day.hasRecord && day.net < 0,
              }"
            ></span>
          </button>
        </div>

        <button
          type="button"
          class="week-nav-btn"
          aria-label="下一周"
          @click="shiftWeek(1)"
        >
          <AppIcon name="chevron-right" :size="16" />
        </button>
      </section>

      <!-- 加载中 -->
      <div v-if="loading" class="loading card">
        <div class="loading-spinner"></div>
        <div>正在同步飞书数据…</div>
      </div>

      <!-- 加载失败：阻断误保存覆盖 -->
      <div v-else-if="loadError" class="error-card">
        <div class="empty-icon-wrap">
          <AppIcon name="alert" :size="24" />
        </div>
        <p class="error-title">读取该日数据失败</p>
        <p class="error-desc">{{ loadError }}</p>
        <p class="error-tip">为防止覆盖飞书已有记录，请先重新加载</p>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          style="margin-top: 14px;"
          @click="loadDataForDate(currentDateKey)"
        >
          <AppIcon name="refresh" :size="15" />
          <span>重新加载</span>
        </button>
      </div>

      <!-- 正常录入区域（三大类分段 Tab，短屏聚焦） -->
      <template v-else>
        <div class="segmented-control section-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            class="segmented-item"
            :class="{ active: activeSection === 'points' }"
            :aria-selected="activeSection === 'points'"
            @click="activeSection = 'points'"
          >
            <span>积分打卡</span>
            <span
              v-if="form.addPoints > 0 || form.deductPoints > 0"
              class="tab-pill tabular-nums"
              :class="todayNet >= 0 ? 'pos' : 'neg'"
            >
              {{ todayNet >= 0 ? '+' : '' }}{{ todayNet }}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            class="segmented-item"
            :class="{ active: activeSection === 'spend' }"
            :aria-selected="activeSection === 'spend'"
            @click="activeSection = 'spend'"
          >
            <span>三餐花销</span>
            <span v-if="todayTotalSpend > 0" class="tab-pill meal tabular-nums">
              ¥{{ todayTotalSpend.toFixed(0) }}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            class="segmented-item"
            :class="{ active: activeSection === 'run' }"
            :aria-selected="activeSection === 'run'"
            @click="activeSection = 'run'"
          >
            <span>运动跑步</span>
            <span v-if="form.runDistance > 0" class="tab-pill pos tabular-nums">
              {{ form.runDistance }}m
            </span>
          </button>
        </div>

        <!-- ==================== Tab 1: 积分打卡 ==================== -->
        <div v-show="activeSection === 'points'" class="tab-panel">
          <!-- 加分鼓励卡 -->
          <div class="card">
            <div class="entry-head">
              <div class="entry-title-group">
                <span class="entry-icon add">
                  <AppIcon name="spark" :size="18" />
                </span>
                <div>
                  <div class="entry-title">加分鼓励</div>
                  <div class="entry-sub">好习惯与进步表现</div>
                </div>
              </div>
              <div class="stepper">
                <button
                  type="button"
                  class="step-btn add-ghost"
                  aria-label="减少加分"
                  @click="bump('addPoints', -1)"
                >
                  <AppIcon name="minus" :size="16" :stroke-width="2.5" />
                </button>
                <input
                  v-model.number="form.addPoints"
                  class="step-input add tabular-nums"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  placeholder="0"
                  @blur="clampField('addPoints')"
                />
                <button
                  type="button"
                  class="step-btn add-solid"
                  aria-label="增加加分"
                  @click="bump('addPoints', 1)"
                >
                  <AppIcon name="plus" :size="16" :stroke-width="2.5" />
                </button>
              </div>
            </div>

            <div class="entry-body">
              <input
                v-model="form.addReason"
                class="form-input"
                placeholder="加分原因（多个用顿号或逗号分隔）"
              />
              <div v-if="tags.add.length" class="tag-block">
                <span class="tag-label">最近用过（点击快捷填入）</span>
                <div class="quick-tags">
                  <button
                    v-for="tag in tags.add"
                    :key="tag"
                    type="button"
                    class="quick-tag add"
                    :class="{ selected: isSelected('addReason', tag) }"
                    @click="toggleReason('addReason', tag)"
                  >
                    <AppIcon v-if="isSelected('addReason', tag)" name="check" :size="12" :stroke-width="2.6" />
                    <span>{{ tag }}</span>
                  </button>
                </div>
              </div>
              <p v-else class="tag-empty-hint">保存后会自动记住常用加分原因，下次可直接点选</p>
            </div>
          </div>

          <!-- 扣分提醒卡 -->
          <div class="card">
            <div class="entry-head">
              <div class="entry-title-group">
                <span class="entry-icon deduct">
                  <AppIcon name="minus" :size="18" :stroke-width="2.5" />
                </span>
                <div>
                  <div class="entry-title">扣分提醒</div>
                  <div class="entry-sub">需要改进的小问题</div>
                </div>
              </div>
              <div class="stepper">
                <button
                  type="button"
                  class="step-btn deduct-ghost"
                  aria-label="减少扣分"
                  @click="bump('deductPoints', -1)"
                >
                  <AppIcon name="minus" :size="16" :stroke-width="2.5" />
                </button>
                <input
                  v-model.number="form.deductPoints"
                  class="step-input deduct tabular-nums"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  placeholder="0"
                  @blur="clampField('deductPoints')"
                />
                <button
                  type="button"
                  class="step-btn deduct-solid"
                  aria-label="增加扣分"
                  @click="bump('deductPoints', 1)"
                >
                  <AppIcon name="plus" :size="16" :stroke-width="2.5" />
                </button>
              </div>
            </div>

            <div class="entry-body">
              <input
                v-model="form.deductReason"
                class="form-input"
                placeholder="扣分原因（多个用顿号或逗号分隔）"
              />
              <div v-if="tags.deduct.length" class="tag-block">
                <span class="tag-label">最近用过（点击快捷填入）</span>
                <div class="quick-tags">
                  <button
                    v-for="tag in tags.deduct"
                    :key="tag"
                    type="button"
                    class="quick-tag deduct"
                    :class="{ selected: isSelected('deductReason', tag) }"
                    @click="toggleReason('deductReason', tag)"
                  >
                    <AppIcon v-if="isSelected('deductReason', tag)" name="check" :size="12" :stroke-width="2.6" />
                    <span>{{ tag }}</span>
                  </button>
                </div>
              </div>
              <p v-else class="tag-empty-hint">保存后会自动记住常用扣分原因，下次可直接点选</p>
            </div>
          </div>
        </div>

        <!-- ==================== Tab 2: 三餐花销 ==================== -->
        <div v-show="activeSection === 'spend'" class="tab-panel">
          <!-- 三餐卡片 -->
          <div class="card meal-group-card">
            <div class="card-title">
              <div class="card-title-left">
                <span class="entry-icon meal-sm">
                  <AppIcon name="utensils" :size="16" />
                </span>
                <span>今日三餐</span>
              </div>
              <span class="meal-total-badge tabular-nums">
                合计 ¥{{ todayMealTotal.toFixed(2) }}
              </span>
            </div>

            <div
              v-for="(meal, idx) in mealConfigs"
              :key="meal.key"
              class="meal-section"
              :class="{ 'with-border': idx > 0 }"
            >
              <div class="entry-head">
                <div class="meal-label-wrap">
                  <span class="meal-mini-icon">
                    <AppIcon :name="meal.icon" :size="16" />
                  </span>
                  <span class="meal-name">{{ meal.label }}</span>
                </div>
                <div class="stepper">
                  <button
                    type="button"
                    class="step-btn meal-ghost"
                    :aria-label="`减少${meal.label}金额`"
                    @click="bump(meal.amountField, -1)"
                  >
                    <AppIcon name="minus" :size="15" :stroke-width="2.5" />
                  </button>
                  <input
                    v-model.number="form[meal.amountField]"
                    class="step-input meal tabular-nums"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    @blur="clampField(meal.amountField)"
                  />
                  <button
                    type="button"
                    class="step-btn meal-solid"
                    :aria-label="`增加${meal.label}金额`"
                    @click="bump(meal.amountField, 1)"
                  >
                    <AppIcon name="plus" :size="15" :stroke-width="2.5" />
                  </button>
                </div>
              </div>

              <!-- 常用金额快捷胶囊 -->
              <div class="preset-row">
                <span class="preset-label">快捷金额</span>
                <button
                  v-for="amt in meal.presets"
                  :key="amt"
                  type="button"
                  class="preset-pill tabular-nums"
                  :class="{ active: Number(form[meal.amountField]) === amt }"
                  @click="setPreset(meal.amountField, amt)"
                >
                  ¥{{ amt }}
                </button>
              </div>

              <input
                v-model="form[meal.contentField]"
                class="form-input"
                style="margin-top: 8px;"
                :placeholder="meal.placeholder"
              />

              <div v-if="tags[meal.key].length" class="tag-block">
                <span class="tag-label">最近用过（点击快捷填入）</span>
                <div class="quick-tags">
                  <button
                    v-for="tag in tags[meal.key]"
                    :key="tag"
                    type="button"
                    class="quick-tag meal"
                    :class="{ selected: isSelected(meal.contentField, tag) }"
                    @click="toggleReason(meal.contentField, tag)"
                  >
                    <AppIcon v-if="isSelected(meal.contentField, tag)" name="check" :size="12" :stroke-width="2.6" />
                    <span>{{ tag }}</span>
                  </button>
                </div>
              </div>
              <p v-else class="tag-empty-hint">保存后会自动记住常吃{{ meal.label }}内容，下次可直接点选</p>
            </div>
          </div>

          <!-- 其他消费卡片 -->
          <div class="card">
            <div class="entry-head">
              <div class="entry-title-group">
                <span class="entry-icon other">
                  <AppIcon name="bag" :size="18" />
                </span>
                <div>
                  <div class="entry-title">其他消费</div>
                  <div class="entry-sub">文具、零食、交通等</div>
                </div>
              </div>
              <div class="stepper">
                <button
                  type="button"
                  class="step-btn other-ghost"
                  aria-label="减少其他消费"
                  @click="bump('otherExpense', -1)"
                >
                  <AppIcon name="minus" :size="15" :stroke-width="2.5" />
                </button>
                <input
                  v-model.number="form.otherExpense"
                  class="step-input other tabular-nums"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  @blur="clampField('otherExpense')"
                />
                <button
                  type="button"
                  class="step-btn other-solid"
                  aria-label="增加其他消费"
                  @click="bump('otherExpense', 1)"
                >
                  <AppIcon name="plus" :size="15" :stroke-width="2.5" />
                </button>
              </div>
            </div>

            <div class="preset-row" style="margin-top: 10px;">
              <span class="preset-label">快捷金额</span>
              <button
                v-for="amt in otherExpensePresets"
                :key="amt"
                type="button"
                class="preset-pill other tabular-nums"
                :class="{ active: Number(form.otherExpense) === amt }"
                @click="setPreset('otherExpense', amt)"
              >
                ¥{{ amt }}
              </button>
            </div>

            <div class="entry-body">
              <input
                v-model="form.otherExpenseReason"
                class="form-input"
                placeholder="消费原因（多个用顿号或逗号分隔）"
              />
              <div v-if="tags.otherExpense.length" class="tag-block">
                <span class="tag-label">最近用过（点击快捷填入）</span>
                <div class="quick-tags">
                  <button
                    v-for="tag in tags.otherExpense"
                    :key="tag"
                    type="button"
                    class="quick-tag other"
                    :class="{ selected: isSelected('otherExpenseReason', tag) }"
                    @click="toggleReason('otherExpenseReason', tag)"
                  >
                    <AppIcon v-if="isSelected('otherExpenseReason', tag)" name="check" :size="12" :stroke-width="2.6" />
                    <span>{{ tag }}</span>
                  </button>
                </div>
              </div>
              <p v-else class="tag-empty-hint">保存后会自动记住常用消费原因，下次可直接点选</p>
            </div>
          </div>
        </div>

        <!-- ==================== Tab 3: 运动跑步 ==================== -->
        <div v-show="activeSection === 'run'" class="tab-panel">
          <div class="card">
            <div class="card-title">
              <div class="card-title-left">
                <span class="entry-icon add-sm">
                  <AppIcon name="run" :size="16" />
                </span>
                <span>跑步运动打卡</span>
              </div>
            </div>

            <!-- 跑步用时 -->
            <div class="run-block">
              <div class="run-field-head">
                <span class="run-field-label">
                  <AppIcon name="timer" :size="15" />
                  <span>跑步用时</span>
                </span>
                <div class="run-time-inputs">
                  <input
                    v-model="runMinutes"
                    class="step-input run-num-input tabular-nums"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    placeholder="0"
                    @input="writeBackRunTime"
                    @blur="normalizeRunInputs"
                  />
                  <span class="run-unit">分</span>
                  <input
                    v-model="runSeconds"
                    class="step-input run-num-input tabular-nums"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    max="59"
                    placeholder="0"
                    @input="writeBackRunTime"
                    @blur="normalizeRunInputs"
                  />
                  <span class="run-unit">秒</span>
                </div>
              </div>
            </div>

            <!-- 跑步距离 -->
            <div class="run-block with-border">
              <div class="run-field-head">
                <span class="run-field-label">
                  <AppIcon name="route" :size="15" />
                  <span>跑步距离（米）</span>
                </span>
                <div class="stepper">
                  <button
                    type="button"
                    class="step-btn add-ghost"
                    aria-label="减少100米"
                    @click="bump('runDistance', -100)"
                  >
                    <AppIcon name="minus" :size="15" :stroke-width="2.5" />
                  </button>
                  <input
                    v-model.number="form.runDistance"
                    class="step-input add tabular-nums"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    step="1"
                    placeholder="0"
                    @blur="clampField('runDistance')"
                  />
                  <button
                    type="button"
                    class="step-btn add-solid"
                    aria-label="增加100米"
                    @click="bump('runDistance', 100)"
                  >
                    <AppIcon name="plus" :size="15" :stroke-width="2.5" />
                  </button>
                </div>
              </div>

              <div class="preset-row" style="margin-top: 10px;">
                <span class="preset-label">常用距离</span>
                <button
                  v-for="dist in runDistancePresets"
                  :key="dist"
                  type="button"
                  class="preset-pill run tabular-nums"
                  :class="{ active: Number(form.runDistance) === dist }"
                  @click="setPreset('runDistance', dist)"
                >
                  {{ dist }}米
                </button>
              </div>
            </div>

            <!-- 配速表现鼓励条 -->
            <div v-if="form.runTime > 0 && form.runDistance > 0" class="run-pace-banner tabular-nums">
              <div class="pace-main">
                <AppIcon name="run" :size="16" />
                <span>平均配速 <strong>{{ runPaceText }}</strong></span>
              </div>
              <span class="pace-speed">{{ runSpeedText }} 米/秒</span>
            </div>
          </div>
        </div>

        <!-- 保存主按钮 -->
        <div class="save-wrap">
          <button
            type="button"
            class="btn btn-lg btn-primary"
            :disabled="saving || loading || Boolean(loadError)"
            @click="handleSave"
          >
            {{
              saving
                ? '正在同步飞书…'
                : hasExisting
                ? (isToday ? '更新今日成长记录' : '更新该日成长记录')
                : (isToday ? '保存今日成长记录' : '保存该日成长记录')
            }}
          </button>
          <p class="save-hint">
            {{
              hasExisting
                ? '该日已有记录，点击保存将同步最新内容覆盖原记录'
                : '三个分类填写完后统一点击保存，自动同步至飞书多维表格'
            }}
          </p>
        </div>
      </template>
    </div>

    <Transition name="fade">
      <div v-if="showToast" class="toast" role="status" aria-live="polite">
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.home-content {
  padding-top: 14px;
}

/* 补登提醒横幅（修复原版负边距裁切） */
.backfill-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  margin-bottom: 12px;
  border-radius: 14px;
  background: var(--color-primary-light);
  border: 1px solid #FDE68A;
  color: var(--color-primary-deep);
  font-size: 13px;
  font-weight: 600;
}

.banner-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.banner-btn {
  flex-shrink: 0;
  border: none;
  background: #FFFFFF;
  color: var(--color-primary-deep);
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(180, 83, 9, 0.12);
}

/* 顶部暖琥珀成长勋章大卡 */
.hero-medal-card {
  background: linear-gradient(135deg, #D97706 0%, #EA580C 100%);
  color: #FFFFFF;
  border-radius: 22px;
  padding: 18px 18px 14px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-primary);
}

.hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.hero-date-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 251, 235, 0.92);
}

.status-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  color: #FFFFFF;
}

.hero-score-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 4px;
}

.hero-score {
  font-size: 40px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -1px;
}

.hero-score-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 251, 235, 0.88);
}

.streak-badge {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8px);
  border-radius: 14px;
  padding: 8px 12px;
  text-align: center;
  flex-shrink: 0;
}

.streak-num {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 15px;
  font-weight: 800;
}

.streak-label {
  font-size: 10px;
  color: rgba(255, 251, 235, 0.88);
  margin-top: 1px;
}

.goal-box {
  margin-top: 14px;
}

.goal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 6px;
}

.goal-trigger {
  background: transparent;
  border: none;
  color: rgba(255, 251, 235, 0.92);
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
}

.goal-editor {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.goal-input {
  width: 60px;
  padding: 3px 8px;
  border-radius: 8px;
  border: none;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text);
  background: #FFFFFF;
  outline: none;
}

.goal-save-btn {
  border: none;
  background: rgba(255, 255, 255, 0.24);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 9px;
  border-radius: 8px;
  cursor: pointer;
}

.goal-pct {
  font-weight: 700;
}

.goal-track {
  height: 7px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.16);
  overflow: hidden;
}

.goal-fill {
  height: 100%;
  border-radius: 999px;
  background: #FFFFFF;
  transition: width 0.4s var(--ease-out);
}

.hero-foot {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 12px;
  color: rgba(255, 251, 235, 0.9);
}

.hero-foot strong {
  color: #FFFFFF;
  font-weight: 800;
}

.foot-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.45);
}

/* 本周横向日历条 */
.week-strip-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.week-nav-btn {
  width: 30px;
  height: 44px;
  border-radius: 12px;
  border: 1.5px solid var(--color-border);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.week-strip {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}

.week-day-btn {
  border: 1.5px solid var(--color-border);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  border-radius: 13px;
  padding: 7px 2px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.week-day-btn.is-today {
  border-color: var(--color-primary);
  color: var(--color-primary-deep);
}

.week-day-btn.selected {
  background: var(--color-text);
  border-color: var(--color-text);
  color: #FFFFFF;
}

.wd-label {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.72;
}

.wd-num {
  font-size: 14px;
  font-weight: 800;
  line-height: 1.1;
}

.wd-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: transparent;
  margin-top: 1px;
}

.wd-dot.visible {
  background: var(--color-success);
}

.wd-dot.visible.neg {
  background: var(--color-danger);
}

.week-day-btn.selected .wd-dot.visible {
  background: #FBBF24;
}

/* 三大类分段 Tab */
.section-tabs {
  margin-bottom: 12px;
}

.tab-pill {
  font-size: 11px;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 999px;
}
.tab-pill.pos {
  background: var(--color-success-light);
  color: var(--color-success);
}
.tab-pill.neg {
  background: var(--color-danger-light);
  color: var(--color-danger);
}
.tab-pill.meal {
  background: var(--color-meal-light);
  color: var(--color-primary-deep);
}

/* 录入卡片内部 */
.entry-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.entry-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.entry-icon {
  width: 38px;
  height: 38px;
  border-radius: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.entry-icon.add,
.entry-icon.add-sm {
  background: var(--color-success-light);
  color: var(--color-success);
}
.entry-icon.deduct {
  background: var(--color-danger-light);
  color: var(--color-danger);
}
.entry-icon.meal-sm {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: var(--color-meal-light);
  color: var(--color-primary-deep);
}
.entry-icon.add-sm {
  width: 30px;
  height: 30px;
  border-radius: 10px;
}
.entry-icon.other {
  background: var(--color-other-light);
  color: var(--color-other);
}

.entry-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text);
  line-height: 1.2;
}

.entry-sub {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.entry-body {
  margin-top: 12px;
}

.tag-block {
  margin-top: 10px;
}

.tag-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
}

.tag-empty-hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}

/* 40px 舒适步进器 */
.stepper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.step-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.12s ease;
}
.step-btn:active {
  opacity: 0.78;
}

.step-btn.add-ghost {
  background: var(--color-success-light);
  color: var(--color-success);
}
.step-btn.add-solid {
  background: var(--color-success);
  color: #FFFFFF;
}
.step-btn.deduct-ghost {
  background: var(--color-danger-light);
  color: var(--color-danger);
}
.step-btn.deduct-solid {
  background: var(--color-danger);
  color: #FFFFFF;
}
.step-btn.meal-ghost {
  background: var(--color-meal-light);
  color: var(--color-primary-deep);
}
.step-btn.meal-solid {
  background: var(--color-primary);
  color: #FFFFFF;
}
.step-btn.other-ghost {
  background: var(--color-other-light);
  color: var(--color-other);
}
.step-btn.other-solid {
  background: var(--color-other);
  color: #FFFFFF;
}

.step-input {
  width: 64px;
  height: 38px;
  text-align: center;
  font-size: 17px;
  font-weight: 800;
  border: 1.5px solid var(--color-border);
  border-radius: 11px;
  outline: none;
  background: var(--color-bg-input);
  color: var(--color-text);
  font-family: inherit;
  -moz-appearance: textfield;
}

.step-input::-webkit-outer-spin-button,
.step-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.step-input.add { color: var(--color-success); }
.step-input.deduct { color: var(--color-danger); }
.step-input.meal { color: var(--color-primary-deep); }
.step-input.other { color: var(--color-other); }

.step-input:focus {
  background: #FFFFFF;
  border-color: var(--color-primary);
}

/* 三餐合并卡 */
.meal-total-badge {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-primary-deep);
  background: var(--color-meal-light);
  padding: 4px 10px;
  border-radius: 999px;
}

.meal-section {
  padding-top: 4px;
}

.meal-section.with-border {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--color-border);
}

.meal-label-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meal-mini-icon {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: var(--color-primary-soft);
  border: 1px solid var(--color-border);
  color: var(--color-primary-deep);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.meal-name {
  font-size: 15px;
  font-weight: 800;
}

/* 快捷金额 / 距离胶囊 */
.preset-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.preset-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  margin-right: 2px;
}

.preset-pill {
  min-height: 28px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}

.preset-pill.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #FFFFFF;
}

.preset-pill.other.active {
  background: var(--color-other);
  border-color: var(--color-other);
}

.preset-pill.run.active {
  background: var(--color-success);
  border-color: var(--color-success);
}

/* 跑步模块 */
.run-block {
  padding: 6px 0;
}

.run-block.with-border {
  margin-top: 14px;
  padding-top: 16px;
  border-top: 1px dashed var(--color-border);
}

.run-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.run-field-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
}

.run-time-inputs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.run-num-input {
  width: 56px;
  color: var(--color-success);
}

.run-unit {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.run-pace-banner {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--color-success-light);
  border: 1px solid var(--color-success-border);
  color: #065F46;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}

.pace-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pace-speed {
  font-size: 12px;
  color: var(--color-success);
  font-weight: 700;
}

/* 错误提示 */
.error-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text);
}

.error-desc {
  font-size: 13px;
  color: var(--color-danger);
  margin-top: 4px;
}

.error-tip {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

/* 底部保存区 */
.save-wrap {
  margin-top: 6px;
}

.save-hint {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 8px;
}
</style>
