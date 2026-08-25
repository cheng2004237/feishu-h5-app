<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getDayRecord,
  saveDayRecord,
  todayKey,
  getThisWeekRecords,
  summarizeRecords,
  getReasonHistory,
  emptyRecord,
  formatRunTime,
} from '../utils/storage.js'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn.js'

dayjs.locale('zh-cn')

const route = useRoute()
const router = useRouter()

// 响应式的当前日期 key (YYYY-MM-DD)
const currentDateKey = computed(() => {
  return route.query.date || todayKey()
})

const isToday = computed(() => currentDateKey.value === todayKey())

// 显示的日期文本
const displayDateText = computed(() => {
  return dayjs(currentDateKey.value).format('YYYY年M月D日 dddd')
})

const form = ref(emptyRecord(currentDateKey.value))

// 跑步输入的临时状态：分和秒
const runMinutes = ref('')
const runSeconds = ref('')

const showToast = ref(false)
const toastMessage = ref('')
const hasExisting = ref(false)
const saving = ref(false)

const weekSummary = ref({
  totalAdd: 0,
  totalDeduct: 0,
  netScore: 0,
  totalMeal: 0,
})

const addReasonTags = ref([])
const deductReasonTags = ref([])
const breakfastTags = ref([])
const lunchTags = ref([])
const dinnerTags = ref([])

function loadReasonTags() {
  addReasonTags.value = getReasonHistory('add')
  deductReasonTags.value = getReasonHistory('deduct')
  breakfastTags.value = getReasonHistory('breakfast')
  lunchTags.value = getReasonHistory('lunch')
  dinnerTags.value = getReasonHistory('dinner')
}

function bump(field, delta) {
  const cur = Number(form.value[field]) || 0
  form.value[field] = Math.max(0, cur + delta)
}

function toggleReason(field, tag) {
  const parts = form.value[field]
    ? form.value[field].split(/[、]+/).map((s) => s.trim()).filter(Boolean)
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
  return form.value[field].split(/[、]+/).map((s) => s.trim()).includes(tag)
}

function hasAnyContent(record) {
  return (
    Number(record.addPoints) || Number(record.deductPoints)
    || Number(record.breakfastAmount) || Number(record.lunchAmount) || Number(record.dinnerAmount)
    || Number(record.runTime) || Number(record.runDistance)
    || (record.addReason && record.addReason.trim())
    || (record.deductReason && record.deductReason.trim())
    || (record.breakfastContent && record.breakfastContent.trim())
    || (record.lunchContent && record.lunchContent.trim())
    || (record.dinnerContent && record.dinnerContent.trim())
  )
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

async function handleSave() {
  if (saving.value) return
  saving.value = true
  try {
    writeBackRunTime()
    await saveDayRecord(form.value)
    hasExisting.value = true
    showMessage('保存成功')
    loadWeekSummary()
    loadReasonTags()
  } catch (err) {
    console.error(err)
    showMessage('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

function showMessage(msg) {
  toastMessage.value = msg
  showToast.value = true
  setTimeout(() => { showToast.value = false }, 2000)
}

async function loadWeekSummary() {
  const weekRecords = await getThisWeekRecords()
  weekSummary.value = summarizeRecords(weekRecords)
}

// 回到今天
function backToToday() {
  router.replace({ path: '/' })
}

// 封装一个加载数据的方法，方便切换日期时调用
async function loadDataForDate(dateKey) {
  form.value = emptyRecord(dateKey)
  hasExisting.value = false
  syncRunFormFromTotal()
  
  try {
    const existing = await getDayRecord(dateKey)
    form.value = { ...existing }
    syncRunFormFromTotal()
    if (hasAnyContent(existing)) hasExisting.value = true
  } catch (err) {
    console.error('加载数据失败:', err)
  }
}

// 监听路由参数变化（为了处理同页面内日期切换的情况）
watch(() => route.query.date, (newDate) => {
  const targetDate = newDate || todayKey()
  loadDataForDate(targetDate)
})

onMounted(async () => {
  await loadDataForDate(currentDateKey.value)
  try {
    await loadWeekSummary()
  } catch (err) {
    console.error('加载本周统计失败:', err)
  }
  loadReasonTags()
})
</script>

<template>
  <div class="page">
    <!-- 如果不是今天，显示一个醒目的补登提示横幅 -->
    <div v-if="!isToday" class="backfill-banner">
      <div class="banner-text">
        <span class="banner-icon">⚠️</span> 当前正在补登/修改历史记录
      </div>
      <button class="banner-btn" @click="backToToday">回到今天</button>
    </div>

    <!-- 顶部大标题 -->
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1>{{ isToday ? '今日记录' : '历史记录' }}</h1>
          <p>{{ displayDateText }}</p>
        </div>
        <div v-if="hasExisting" class="recorded-badge">
          <span class="dot"></span>已记录
        </div>
      </div>
    </div>

    <div class="page-content">
      <!-- 本周净分大卡 -->
      <div class="hero-card">
        <div class="hero-label">本周净分</div>
        <div
          class="hero-value"
          :class="weekSummary.netScore >= 0 ? 'positive' : 'negative'"
        >
          {{ weekSummary.netScore >= 0 ? '+' : '' }}{{ weekSummary.netScore }}
        </div>
        <div class="hero-divider"></div>
        <div class="hero-stats">
          <div class="hero-stat">
            <span class="hero-stat-value positive">+{{ weekSummary.totalAdd }}</span>
            <span class="hero-stat-label">加分</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-value negative">-{{ weekSummary.totalDeduct }}</span>
            <span class="hero-stat-label">扣分</span>
          </div>
          <div class="hero-stat">
            <span class="hero-stat-value meal">¥{{ weekSummary.totalMeal.toFixed(2) }}</span>
            <span class="hero-stat-label">三餐</span>
          </div>
        </div>
      </div>

      <!-- 加分 -->
      <div class="section-header">加分</div>
      <div class="card no-padding">
        <div class="item-row">
          <div class="item-icon icon-add">+</div>
          <span class="item-name">加分</span>
          <div class="stepper">
            <button class="step-btn add" @click="bump('addPoints', -1)">−</button>
            <input
              v-model.number="form.addPoints"
              class="step-input"
              type="number"
              min="0"
              placeholder="0"
            />
            <button class="step-btn add" @click="bump('addPoints', 1)">+</button>
          </div>
          <span class="step-unit">分</span>
        </div>
        <div class="row-divider"></div>
        <div class="sub-row">
          <input
            v-model="form.addReason"
            class="form-input sub-input"
            placeholder="加分原因（多个用顿号分隔）"
          />
          <div v-if="addReasonTags.length" class="history-section">
            <span class="history-label">最近用过</span>
            <div class="quick-tags">
              <span
                v-for="tag in addReasonTags"
                :key="tag"
                class="quick-tag add"
                :class="{ selected: isSelected('addReason', tag) }"
                @click="toggleReason('addReason', tag)"
              >{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 扣分 -->
      <div class="section-header">扣分</div>
      <div class="card no-padding">
        <div class="item-row">
          <div class="item-icon icon-deduct">−</div>
          <span class="item-name">扣分</span>
          <div class="stepper">
            <button class="step-btn deduct" @click="bump('deductPoints', -1)">−</button>
            <input
              v-model.number="form.deductPoints"
              class="step-input"
              type="number"
              min="0"
              placeholder="0"
            />
            <button class="step-btn deduct" @click="bump('deductPoints', 1)">+</button>
          </div>
          <span class="step-unit">分</span>
        </div>
        <div class="row-divider"></div>
        <div class="sub-row">
          <input
            v-model="form.deductReason"
            class="form-input sub-input"
            placeholder="扣分原因（多个用顿号分隔）"
          />
          <div v-if="deductReasonTags.length" class="history-section">
            <span class="history-label">最近用过</span>
            <div class="quick-tags">
              <span
                v-for="tag in deductReasonTags"
                :key="tag"
                class="quick-tag deduct"
                :class="{ selected: isSelected('deductReason', tag) }"
                @click="toggleReason('deductReason', tag)"
              >{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 三餐 -->
      <div class="section-header">三餐</div>
      <div class="card no-padding">
        <!-- 早餐 -->
        <div class="item-row">
          <div class="item-icon icon-meal-b">🌅</div>
          <span class="item-name">早餐</span>
          <div class="stepper">
            <button class="step-btn meal" @click="bump('breakfastAmount', -1)">−</button>
            <input
              v-model.number="form.breakfastAmount"
              class="step-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
            />
            <button class="step-btn meal" @click="bump('breakfastAmount', 1)">+</button>
          </div>
          <span class="step-unit">元</span>
        </div>
        <div class="row-divider"></div>
        <div class="sub-row">
          <input
            v-model="form.breakfastContent"
            class="form-input sub-input"
            placeholder="早餐吃了什么（多个用顿号分隔）"
          />
          <div v-if="breakfastTags.length" class="history-section">
            <span class="history-label">最近用过</span>
            <div class="quick-tags">
              <span
                v-for="tag in breakfastTags"
                :key="tag"
                class="quick-tag meal"
                :class="{ selected: isSelected('breakfastContent', tag) }"
                @click="toggleReason('breakfastContent', tag)"
              >{{ tag }}</span>
            </div>
          </div>
        </div>

        <!-- 午餐 -->
        <div class="item-row">
          <div class="item-icon icon-meal-l">☀️</div>
          <span class="item-name">午餐</span>
          <div class="stepper">
            <button class="step-btn meal" @click="bump('lunchAmount', -1)">−</button>
            <input
              v-model.number="form.lunchAmount"
              class="step-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
            />
            <button class="step-btn meal" @click="bump('lunchAmount', 1)">+</button>
          </div>
          <span class="step-unit">元</span>
        </div>
        <div class="row-divider"></div>
        <div class="sub-row">
          <input
            v-model="form.lunchContent"
            class="form-input sub-input"
            placeholder="午餐吃了什么（多个用顿号分隔）"
          />
          <div v-if="lunchTags.length" class="history-section">
            <span class="history-label">最近用过</span>
            <div class="quick-tags">
              <span
                v-for="tag in lunchTags"
                :key="tag"
                class="quick-tag meal"
                :class="{ selected: isSelected('lunchContent', tag) }"
                @click="toggleReason('lunchContent', tag)"
              >{{ tag }}</span>
            </div>
          </div>
        </div>

        <!-- 晚餐 -->
        <div class="item-row">
          <div class="item-icon icon-meal-d">🌙</div>
          <span class="item-name">晚餐</span>
          <div class="stepper">
            <button class="step-btn meal" @click="bump('dinnerAmount', -1)">−</button>
            <input
              v-model.number="form.dinnerAmount"
              class="step-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
            />
            <button class="step-btn meal" @click="bump('dinnerAmount', 1)">+</button>
          </div>
          <span class="step-unit">元</span>
        </div>
        <div class="row-divider"></div>
        <div class="sub-row">
          <input
            v-model="form.dinnerContent"
            class="form-input sub-input"
            placeholder="晚餐吃了什么（多个用顿号分隔）"
          />
          <div v-if="dinnerTags.length" class="history-section">
            <span class="history-label">最近用过</span>
            <div class="quick-tags">
              <span
                v-for="tag in dinnerTags"
                :key="tag"
                class="quick-tag meal"
                :class="{ selected: isSelected('dinnerContent', tag) }"
                @click="toggleReason('dinnerContent', tag)"
              >{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 跑步 -->
      <div class="section-header">跑步</div>
      <div class="card no-padding">
        <!-- 用时（X分X秒）-->
        <div class="item-row">
          <div class="item-icon icon-run">🏃</div>
          <span class="item-name">用时</span>
          <div class="run-time-row">
            <input
              v-model="runMinutes"
              class="step-input run-input"
              type="number"
              min="0"
              placeholder="0"
              @input="writeBackRunTime"
            />
            <span class="run-sep">分</span>
            <input
              v-model="runSeconds"
              class="step-input run-input"
              type="number"
              min="0"
              max="59"
              placeholder="0"
              @input="writeBackRunTime"
            />
            <span class="run-sep">秒</span>
          </div>
        </div>
        <div class="row-divider"></div>
        <!-- 距离（米）-->
        <div class="item-row">
          <div class="item-icon icon-run">📏</div>
          <span class="item-name">距离</span>
          <div class="stepper">
            <button class="step-btn run" @click="bump('runDistance', -100)">−</button>
            <input
              v-model.number="form.runDistance"
              class="step-input"
              type="number"
              min="0"
              step="1"
              placeholder="0"
            />
            <button class="step-btn run" @click="bump('runDistance', 100)">+</button>
          </div>
          <span class="step-unit">米</span>
        </div>
        <div v-if="form.runTime > 0 && form.runDistance > 0" class="run-summary">
          <span class="run-summary-icon">⚡</span>
          平均配速 {{ (form.runTime / form.runDistance).toFixed(2) }} 秒/米 ·
          平均速度 {{ (form.runDistance / form.runTime).toFixed(2) }} 米/秒
        </div>
      </div>

      <!-- 保存按钮 -->
      <button
        class="btn btn-lg btn-primary save-btn"
        :disabled="saving"
        @click="handleSave"
      >
        {{ saving ? '保存中…' : (hasExisting ? '更新该日记录' : '保存该日记录') }}
      </button>

      <p v-if="hasExisting" class="save-hint">
        该日已有记录，再次保存将覆盖之前的内容
      </p>
    </div>

    <Transition name="fade">
      <div v-if="showToast" class="toast">{{ toastMessage }}</div>
    </Transition>
  </div>
</template>

<style scoped>
/* 顶部头部 */
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.backfill-banner {
  background: var(--color-warning-light);
  color: #B26A00;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -20px -20px 20px -20px;
  font-size: 13px;
  font-weight: 600;
}

.banner-text {
  display: flex;
  align-items: center;
  gap: 6px;
}

.banner-btn {
  background: white;
  color: #B26A00;
  border: none;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}
.banner-btn:active {
  opacity: 0.8;
}

.recorded-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--color-success-light);
  color: #248A3D;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 10px;
}

.recorded-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success);
}

/* 本周净分英雄卡 */
.hero-card {
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  padding: 22px 20px 16px;
  margin-bottom: 12px;
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.hero-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  font-weight: 500;
}

.hero-value {
  font-size: 56px;
  font-weight: 700;
  letter-spacing: -1px;
  line-height: 1.1;
}

.hero-value.positive { color: var(--color-primary); }
.hero-value.negative { color: var(--color-danger); }

.hero-divider {
  height: 1px;
  background: rgba(60, 60, 67, 0.08);
  margin: 14px 0 12px;
}

.hero-stats {
  display: flex;
  justify-content: space-around;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.hero-stat-value {
  font-size: 17px;
  font-weight: 700;
}

.hero-stat-value.positive { color: var(--color-success); }
.hero-stat-value.negative { color: var(--color-danger); }
.hero-stat-value.meal { color: var(--color-warning); }

.hero-stat-label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

/* ============ 统一的项目行布局 ============
   所有 5 个区域（加/扣分、早/午/晚餐）共用此布局
   图标 + 名称 + [-输入框+] + 单位
   ============================================ */

.card.no-padding {
  padding: 0;
  overflow: hidden;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}

.item-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.icon-add {
  background: var(--color-success);
}

.icon-deduct {
  background: var(--color-danger);
}

.icon-meal-b {
  background: linear-gradient(135deg, #FFD28A, #FFB13B);
  font-size: 16px;
}

.icon-meal-l {
  background: linear-gradient(135deg, #FFB13B, #FF9500);
  font-size: 16px;
}

.icon-meal-d {
  background: linear-gradient(135deg, #FF9500, #FF7B00);
  font-size: 16px;
}

.item-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  flex-shrink: 0;
  min-width: 36px;
}

.stepper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

/* 统一加减号按钮 */
.step-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: transform 0.1s;
  font-family: inherit;
  flex-shrink: 0;
}

.step-btn:active {
  transform: scale(0.9);
}

.step-btn.add {
  background: var(--color-success-light);
  color: #248A3D;
}

.step-btn.deduct {
  background: var(--color-danger-light);
  color: #C92119;
}

.step-btn.meal {
  background: var(--color-warning-light);
  color: #C27400;
}

.step-btn.run {
  background: #E5F5EC;
  color: #0A7E3B;
}

.icon-run {
  background: linear-gradient(135deg, #34C759, #0A7E3B);
  font-size: 16px;
}

.run-time-row {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.run-input {
  width: 56px;
}

.run-sep {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 600;
  margin: 0 2px;
}

.run-summary {
  background: linear-gradient(135deg, #E5F5EC, #F0FFF5);
  padding: 12px 16px;
  font-size: 12px;
  color: #0A7E3B;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  border-top: 1px solid rgba(60, 60, 67, 0.05);
}

.run-summary-icon {
  font-size: 14px;
}

/* 统一输入框 - 所有加减号中间的输入都用此样式 */
.step-input {
  width: 70px;
  height: 36px;
  text-align: center;
  font-size: 17px;
  font-weight: 700;
  border: none;
  border-radius: 10px;
  outline: none;
  background: var(--color-bg-input);
  color: var(--color-text);
  font-family: inherit;
  -moz-appearance: textfield;
  font-variant-numeric: tabular-nums;
}

.step-input::-webkit-outer-spin-button,
.step-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* 输入框聚焦时根据区域变色 */
.item-row:has(.step-btn.add) .step-input:focus {
  background: var(--color-success-light);
  color: #248A3D;
}

.item-row:has(.step-btn.deduct) .step-input:focus {
  background: var(--color-danger-light);
  color: #C92119;
}

.item-row:has(.step-btn.meal) .step-input:focus {
  background: var(--color-warning-light);
  color: #C27400;
}

.item-row:has(.step-btn.run) .step-input:focus {
  background: #E5F5EC;
  color: #0A7E3B;
}

/* 统一单位文字 */
.step-unit {
  font-size: 13px;
  color: var(--color-text-secondary);
  width: 16px;
  text-align: left;
  flex-shrink: 0;
  font-weight: 500;
}

/* 行分隔线 */
.row-divider {
  height: 1px;
  background: rgba(60, 60, 67, 0.08);
  margin: 0 16px;
}

/* 子行（原因/内容输入区） */
.sub-row {
  padding: 12px 16px 14px;
}

.sub-input {
  background: var(--color-bg-input);
  border: none;
  font-size: 14px;
  padding: 10px 12px;
}

.history-section {
  margin-top: 10px;
}

.history-label {
  display: block;
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-bottom: 6px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 保存按钮 */
.save-btn {
  margin-top: 12px;
  margin-bottom: 4px;
}

.save-hint {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 6px;
  padding-bottom: 24px;
}

/* Toast 动画 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>