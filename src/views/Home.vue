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
    showMessage('保存成功！')
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
    <div class="page-header">
      <div class="header-top">
        <div>
          <h1>程怿一 · 今日记录</h1>
          <p>{{ today }}</p>
        </div>
        <div class="header-badge" v-if="hasExisting">已记录</div>
      </div>
    </div>

    <div class="page-content">
      <!-- 本周速览 -->
      <div class="week-glance">
        <div class="glance-item">
          <span class="glance-value points-positive">+{{ weekSummary.totalAdd }}</span>
          <span class="glance-label">本周加分</span>
        </div>
        <div class="glance-divider"></div>
        <div class="glance-item">
          <span class="glance-value points-negative">-{{ weekSummary.totalDeduct }}</span>
          <span class="glance-label">本周扣分</span>
        </div>
        <div class="glance-divider"></div>
        <div class="glance-item">
          <span class="glance-value meal-color">¥{{ weekSummary.totalMeal }}</span>
          <span class="glance-label">本周三餐</span>
        </div>
      </div>

      <!-- 加分 -->
      <div class="card section-add">
        <div class="card-title">
          <span class="section-icon add-icon">+</span>
          加分记录
        </div>
        <div class="form-group">
          <label class="form-label">加了几分</label>
          <div class="point-input-row">
            <button class="point-btn" @click="bump('addPoints', -1)">−</button>
            <input v-model.number="form.addPoints" class="form-input point-input" type="number" min="0" placeholder="0" />
            <button class="point-btn" @click="bump('addPoints', 1)">+</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">加分原因</label>
          <textarea v-model="form.addReason" class="form-input form-textarea" placeholder="填写加分原因，多个原因用顿号分隔..." rows="2"></textarea>
          <div v-if="addReasonTags.length" class="history-section">
            <span class="history-label">历史记录</span>
            <div class="quick-tags">
              <span v-for="tag in addReasonTags" :key="tag" class="quick-tag"
                :class="{ selected: isSelected('addReason', tag) }"
                @click="toggleReason('addReason', tag)">{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 扣分 -->
      <div class="card section-deduct">
        <div class="card-title">
          <span class="section-icon deduct-icon">−</span>
          扣分记录
        </div>
        <div class="form-group">
          <label class="form-label">扣了几分</label>
          <div class="point-input-row">
            <button class="point-btn" @click="bump('deductPoints', -1)">−</button>
            <input v-model.number="form.deductPoints" class="form-input point-input" type="number" min="0" placeholder="0" />
            <button class="point-btn" @click="bump('deductPoints', 1)">+</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">扣分原因</label>
          <textarea v-model="form.deductReason" class="form-input form-textarea" placeholder="填写扣分原因，多个原因用顿号分隔..." rows="2"></textarea>
          <div v-if="deductReasonTags.length" class="history-section">
            <span class="history-label">历史记录</span>
            <div class="quick-tags">
              <span v-for="tag in deductReasonTags" :key="tag" class="quick-tag deduct"
                :class="{ selected: isSelected('deductReason', tag) }"
                @click="toggleReason('deductReason', tag)">{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 三餐 -->
      <div class="card section-meal">
        <div class="card-title">
          <span class="section-icon meal-icon">🍱</span>
          三餐记录
          <span class="meal-total-badge" v-if="form.breakfastAmount || form.lunchAmount || form.dinnerAmount">
            ¥{{ (Number(form.breakfastAmount)||0) + (Number(form.lunchAmount)||0) + (Number(form.dinnerAmount)||0) }}
          </span>
        </div>

        <!-- 早餐 -->
        <div class="meal-block">
          <div class="meal-name">🌅 早餐</div>
          <div class="form-group">
            <label class="form-label">金额</label>
            <div class="point-input-row">
              <button class="point-btn small" @click="bump('breakfastAmount', -1)">−</button>
              <input v-model.number="form.breakfastAmount" class="form-input point-input money" type="number" min="0" step="0.01" placeholder="0.00" />
              <button class="point-btn small" @click="bump('breakfastAmount', 1)">+</button>
              <span class="money-unit">元</span>
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">吃了什么</label>
            <textarea v-model="form.breakfastContent" class="form-input form-textarea" placeholder="例：包子、牛奶" rows="1"></textarea>
            <div v-if="breakfastTags.length" class="history-section">
              <div class="quick-tags">
                <span v-for="tag in breakfastTags" :key="tag" class="quick-tag meal"
                  :class="{ selected: isSelected('breakfastContent', tag) }"
                  @click="toggleReason('breakfastContent', tag)">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 午餐 -->
        <div class="meal-block">
          <div class="meal-name">☀️ 午餐</div>
          <div class="form-group">
            <label class="form-label">金额</label>
            <div class="point-input-row">
              <button class="point-btn small" @click="bump('lunchAmount', -1)">−</button>
              <input v-model.number="form.lunchAmount" class="form-input point-input money" type="number" min="0" step="0.01" placeholder="0.00" />
              <button class="point-btn small" @click="bump('lunchAmount', 1)">+</button>
              <span class="money-unit">元</span>
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">吃了什么</label>
            <textarea v-model="form.lunchContent" class="form-input form-textarea" placeholder="例：米饭、红烧肉" rows="1"></textarea>
            <div v-if="lunchTags.length" class="history-section">
              <div class="quick-tags">
                <span v-for="tag in lunchTags" :key="tag" class="quick-tag meal"
                  :class="{ selected: isSelected('lunchContent', tag) }"
                  @click="toggleReason('lunchContent', tag)">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 晚餐 -->
        <div class="meal-block">
          <div class="meal-name">🌙 晚餐</div>
          <div class="form-group">
            <label class="form-label">金额</label>
            <div class="point-input-row">
              <button class="point-btn small" @click="bump('dinnerAmount', -1)">−</button>
              <input v-model.number="form.dinnerAmount" class="form-input point-input money" type="number" min="0" step="0.01" placeholder="0.00" />
              <button class="point-btn small" @click="bump('dinnerAmount', 1)">+</button>
              <span class="money-unit">元</span>
            </div>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">吃了什么</label>
            <textarea v-model="form.dinnerContent" class="form-input form-textarea" placeholder="例：面条、青菜" rows="1"></textarea>
            <div v-if="dinnerTags.length" class="history-section">
              <div class="quick-tags">
                <span v-for="tag in dinnerTags" :key="tag" class="quick-tag meal"
                  :class="{ selected: isSelected('dinnerContent', tag) }"
                  @click="toggleReason('dinnerContent', tag)">{{ tag }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 保存按钮 -->
      <button class="btn btn-primary btn-lg save-btn" :disabled="saving" @click="handleSave">
        {{ saving ? '保存中...' : (hasExisting ? '更新今日记录' : '保存今日记录') }}
      </button>

      <p class="save-hint" v-if="hasExisting">
        今天已有记录，再次保存将覆盖之前的内容
      </p>
    </div>

    <Transition name="fade">
      <div v-if="showToast" class="toast">{{ toastMessage }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-badge {
  background: var(--color-success-light);
  color: var(--color-success);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 12px;
}

/* 本周速览 */
.week-glance {
  display: flex;
  align-items: center;
  background: var(--color-bg-white);
  border-radius: var(--radius-md);
  padding: 14px 0;
  margin-bottom: 12px;
  box-shadow: var(--shadow-sm);
}

.glance-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.glance-value {
  font-size: 20px;
  font-weight: 700;
}

.glance-label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.glance-divider {
  width: 1px;
  height: 30px;
  background: var(--color-border);
}

.meal-color { color: #ff9f0a; }

/* 区域样式 */
.section-add { border-left: 3px solid var(--color-success); }
.section-deduct { border-left: 3px solid var(--color-danger); }
.section-meal { border-left: 3px solid #ff9f0a; }

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
.meal-icon { background: #ff9f0a; font-size: 12px; }

/* 分数/金额输入 */
.point-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.point-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid var(--color-border);
  background: var(--color-bg-white);
  font-size: 18px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  color: var(--color-text);
}

.point-btn.small { width: 32px; height: 32px; font-size: 16px; }
.point-btn:active { transform: scale(0.92); background: var(--color-bg); }

.point-input {
  width: 70px;
  text-align: center;
  font-size: 24px;
  font-weight: 700;
  border: none;
  border-bottom: 2px solid var(--color-border);
  border-radius: 0;
  padding: 4px 0;
}

.point-input.money { font-size: 22px; color: #ff9f0a; }
.point-input:focus { border-color: var(--color-primary); box-shadow: none; }

.money-unit {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* 文本域 */
.form-textarea {
  resize: none;
  line-height: 1.5;
}

/* 历史记录区 */
.history-section {
  margin-top: 10px;
}

.history-label {
  font-size: 11px;
  color: var(--color-text-placeholder);
  margin-bottom: 6px;
  display: block;
}

/* 扣分主题 */
.quick-tag.deduct:hover,
.quick-tag.deduct.selected {
  border-color: var(--color-danger);
  background: var(--color-danger-light);
  color: var(--color-danger);
}

/* 三餐主题 */
.quick-tag.meal:hover,
.quick-tag.meal.selected {
  border-color: #ff9f0a;
  background: #fff4e0;
  color: #c47700;
}

/* 三餐模块 */
.meal-block {
  padding: 12px;
  border-radius: var(--radius-md);
  background: #fafafa;
  margin-bottom: 12px;
}
.meal-block:last-child { margin-bottom: 0; }

.meal-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--color-text);
}

.meal-total-badge {
  margin-left: auto;
  background: #fff4e0;
  color: #ff9f0a;
  font-size: 13px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
}

/* 保存按钮 */
.save-btn { margin-top: 4px; }
.save-hint {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-placeholder);
  margin-top: 8px;
  padding-bottom: 20px;
}

/* Toast */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>