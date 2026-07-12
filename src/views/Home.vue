<script setup>
import { ref, onMounted } from 'vue'
import {
  getDayRecord,
  saveDayRecord,
  todayKey,
  getThisWeekRecords,
  summarizeRecords,
  getReasonHistory,
  emptyRecord,
} from '../utils/storage.js'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn.js'

dayjs.locale('zh-cn')

const today = dayjs().format('YYYY年M月D日 dddd')
const dateKey = todayKey()

const form = ref(emptyRecord(dateKey))

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
    || (record.addReason && record.addReason.trim())
    || (record.deductReason && record.deductReason.trim())
    || (record.breakfastContent && record.breakfastContent.trim())
    || (record.lunchContent && record.lunchContent.trim())
    || (record.dinnerContent && record.dinnerContent.trim())
  )
}

async function handleSave() {
  if (saving.value) return
  saving.value = true
  try {
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

onMounted(async () => {
  try {
    const existing = await getDayRecord(dateKey)
    form.value = { ...existing }
    if (hasAnyContent(existing)) hasExisting.value = true
    await loadWeekSummary()
  } catch (err) {
    console.error('加载数据失败:', err)
  }
  loadReasonTags()
})
</script>

<template>
  <div class="page">
    <!-- 顶部大标题 -->
    <div class="page-header">
      <div class="header-row">
        <div>
          <h1>今日记录</h1>
          <p>{{ today }}</p>
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
      <div class="card">
        <div class="row-input">
          <button class="step-btn add" @click="bump('addPoints', -1)">−</button>
          <input
            v-model.number="form.addPoints"
            class="point-display"
            type="number"
            min="0"
            placeholder="0"
          />
          <button class="step-btn add" @click="bump('addPoints', 1)">+</button>
          <span class="unit">分</span>
        </div>

        <div class="form-group" style="margin-top: 16px;">
          <input
            v-model="form.addReason"
            class="form-input"
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
      <div class="card">
        <div class="row-input">
          <button class="step-btn deduct" @click="bump('deductPoints', -1)">−</button>
          <input
            v-model.number="form.deductPoints"
            class="point-display"
            type="number"
            min="0"
            placeholder="0"
          />
          <button class="step-btn deduct" @click="bump('deductPoints', 1)">+</button>
          <span class="unit">分</span>
        </div>

        <div class="form-group" style="margin-top: 16px;">
          <input
            v-model="form.deductReason"
            class="form-input"
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
      <div class="card">
        <!-- 早餐 -->
        <div class="meal-row">
          <div class="meal-icon">🌅</div>
          <div class="meal-body">
            <div class="meal-head">
              <span class="meal-name">早餐</span>
              <div class="meal-money-input">
                <button class="step-btn meal" @click="bump('breakfastAmount', -1)">−</button>
                <input
                  v-model.number="form.breakfastAmount"
                  class="meal-money"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                />
                <button class="step-btn meal" @click="bump('breakfastAmount', 1)">+</button>
                <span class="money-unit">元</span>
              </div>
            </div>
            <input
              v-model="form.breakfastContent"
              class="form-input meal-content"
              placeholder="吃了什么"
            />
            <div v-if="breakfastTags.length" class="quick-tags" style="margin-top: 8px;">
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

        <div class="meal-divider"></div>

        <!-- 午餐 -->
        <div class="meal-row">
          <div class="meal-icon">☀️</div>
          <div class="meal-body">
            <div class="meal-head">
              <span class="meal-name">午餐</span>
              <div class="meal-money-input">
                <button class="step-btn meal" @click="bump('lunchAmount', -1)">−</button>
                <input
                  v-model.number="form.lunchAmount"
                  class="meal-money"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                />
                <button class="step-btn meal" @click="bump('lunchAmount', 1)">+</button>
                <span class="money-unit">元</span>
              </div>
            </div>
            <input
              v-model="form.lunchContent"
              class="form-input meal-content"
              placeholder="吃了什么"
            />
            <div v-if="lunchTags.length" class="quick-tags" style="margin-top: 8px;">
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

        <div class="meal-divider"></div>

        <!-- 晚餐 -->
        <div class="meal-row">
          <div class="meal-icon">🌙</div>
          <div class="meal-body">
            <div class="meal-head">
              <span class="meal-name">晚餐</span>
              <div class="meal-money-input">
                <button class="step-btn meal" @click="bump('dinnerAmount', -1)">−</button>
                <input
                  v-model.number="form.dinnerAmount"
                  class="meal-money"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                />
                <button class="step-btn meal" @click="bump('dinnerAmount', 1)">+</button>
                <span class="money-unit">元</span>
              </div>
            </div>
            <input
              v-model="form.dinnerContent"
              class="form-input meal-content"
              placeholder="吃了什么"
            />
            <div v-if="dinnerTags.length" class="quick-tags" style="margin-top: 8px;">
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

      <!-- 保存按钮 -->
      <button
        class="btn btn-lg btn-primary save-btn"
        :disabled="saving"
        @click="handleSave"
      >
        {{ saving ? '保存中…' : (hasExisting ? '更新今日记录' : '保存今日记录') }}
      </button>

      <p v-if="hasExisting" class="save-hint">
        今天已有记录，再次保存将覆盖之前的内容
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

/* 统一加减号按钮 - 所有类型共用 */
.row-input {
  display: flex;
  align-items: center;
  gap: 12px;
}

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
}

.step-btn:active {
  transform: scale(0.9);
}

/* 颜色变体 - 浅色背景 + 彩色符号 */
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

.point-display {
  flex: 1;
  text-align: center;
  font-size: 32px;
  font-weight: 700;
  border: none;
  background: transparent;
  color: var(--color-text);
  outline: none;
  padding: 4px 0;
  font-family: inherit;
}

.point-display:focus {
  color: var(--color-primary);
}

.unit {
  font-size: 15px;
  color: var(--color-text-secondary);
  width: 24px;
  text-align: right;
}

/* 历史候选区 */
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

/* 三餐行 */
.meal-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.meal-icon {
  font-size: 22px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-warning-light);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.meal-body {
  flex: 1;
  min-width: 0;
}

.meal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.meal-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.meal-money-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meal-money {
  width: 70px;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-warning);
  background: var(--color-warning-light);
  border: none;
  border-radius: 8px;
  padding: 5px 6px;
  outline: none;
  font-family: inherit;
}

.meal-money:focus {
  background: #FFE5C4;
}

.money-unit {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.meal-content {
  font-size: 15px;
  padding: 10px 12px;
}

.meal-divider {
  height: 1px;
  background: rgba(60, 60, 67, 0.08);
  margin: 14px 0;
}

/* 保存按钮 */
.save-btn {
  margin-top: 8px;
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