<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getDayRecord, saveDayRecord, todayKey, getThisWeekRecords, summarizeRecords, getReasonHistory } from '../utils/storage.js'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn.js'

dayjs.locale('zh-cn')

const router = useRouter()

const today = dayjs().format('YYYY年M月D日 dddd')
const dateKey = todayKey()

// 表单数据
const form = ref({
  date: dateKey,
  addPoints: 0,
  addReason: '',
  deductPoints: 0,
  deductReason: '',
})

// 状态
const saved = ref(false)
const showToast = ref(false)
const toastMessage = ref('')
const hasExisting = ref(false) // 今天是否已有记录
const saving = ref(false)
const loading = ref(false)

// 本周简要统计
const weekSummary = ref({ totalAdd: 0, totalDeduct: 0, netScore: 0 })

// 历史候选原因（从之前保存的记录中自动积累）
const addReasonTags = ref([])
const deductReasonTags = ref([])

function loadReasonTags() {
  addReasonTags.value = getReasonHistory('add')
  deductReasonTags.value = getReasonHistory('deduct')
}

function selectAddReason(tag) {
  const parts = form.value.addReason ? form.value.addReason.split(/[、]+/).map(s => s.trim()).filter(Boolean) : []
  const idx = parts.indexOf(tag)
  if (idx >= 0) {
    parts.splice(idx, 1)
  } else {
    parts.push(tag)
  }
  form.value.addReason = parts.join('、')
}

function selectDeductReason(tag) {
  const parts = form.value.deductReason ? form.value.deductReason.split(/[、]+/).map(s => s.trim()).filter(Boolean) : []
  const idx = parts.indexOf(tag)
  if (idx >= 0) {
    parts.splice(idx, 1)
  } else {
    parts.push(tag)
  }
  form.value.deductReason = parts.join('、')
}

async function handleSave() {
  if (saving.value) return
  saving.value = true
  try {
    await saveDayRecord(form.value)
    saved.value = true
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
  const summary = summarizeRecords(weekRecords)
  weekSummary.value = summary
}

onMounted(async () => {
  loading.value = true
  try {
    // 加载今天已有的记录
    const existing = await getDayRecord(dateKey)
    if (existing.addPoints || existing.deductPoints || existing.addReason || existing.deductReason) {
      form.value = { ...existing }
      hasExisting.value = true
    }
    await loadWeekSummary()
  } catch (err) {
    console.error('加载数据失败:', err)
  } finally {
    loading.value = false
  }
  loadReasonTags()
})
</script>

<template>
  <div class="page">
    <!-- 头部 -->
    <div class="page-header">
      <div class="header-top">
        <div>
          <h1>程怿一 · 今日积分</h1>
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
          <span class="glance-value" :class="weekSummary.netScore >= 0 ? 'points-positive' : 'points-negative'">
            {{ weekSummary.netScore >= 0 ? '+' : '' }}{{ weekSummary.netScore }}
          </span>
          <span class="glance-label">本周净分</span>
        </div>
      </div>

      <!-- 加分区域 -->
      <div class="card section-add">
        <div class="card-title">
          <span class="section-icon add-icon">+</span>
          加分记录
        </div>

        <div class="form-group">
          <label class="form-label">加了几分</label>
          <div class="point-input-row">
            <button class="point-btn" @click="form.addPoints = Math.max(0, form.addPoints - 1)">−</button>
            <input
              v-model.number="form.addPoints"
              class="form-input point-input"
              type="number"
              min="0"
              placeholder="0"
            />
            <button class="point-btn" @click="form.addPoints++">+</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">加分原因</label>
          <textarea
            v-model="form.addReason"
            class="form-input form-textarea"
            placeholder="填写加分原因，多个原因可用顿号分隔..."
            rows="2"
          ></textarea>
          <div v-if="addReasonTags.length" class="history-section">
            <span class="history-label">历史记录</span>
            <div class="quick-tags">
              <span
                v-for="tag in addReasonTags"
                :key="tag"
                class="quick-tag"
                :class="{ selected: form.addReason.includes(tag) }"
                @click="selectAddReason(tag)"
              >{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 扣分区域 -->
      <div class="card section-deduct">
        <div class="card-title">
          <span class="section-icon deduct-icon">−</span>
          扣分记录
        </div>

        <div class="form-group">
          <label class="form-label">扣了几分</label>
          <div class="point-input-row">
            <button class="point-btn" @click="form.deductPoints = Math.max(0, form.deductPoints - 1)">−</button>
            <input
              v-model.number="form.deductPoints"
              class="form-input point-input"
              type="number"
              min="0"
              placeholder="0"
            />
            <button class="point-btn" @click="form.deductPoints++">+</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">扣分原因</label>
          <textarea
            v-model="form.deductReason"
            class="form-input form-textarea"
            placeholder="填写扣分原因，多个原因可用顿号分隔..."
            rows="2"
          ></textarea>
          <div v-if="deductReasonTags.length" class="history-section">
            <span class="history-label">历史记录</span>
            <div class="quick-tags">
              <span
                v-for="tag in deductReasonTags"
                :key="tag"
                class="quick-tag deduct"
                :class="{ selected: form.deductReason.includes(tag) }"
                @click="selectDeductReason(tag)"
              >{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 今日小结 -->
      <div class="card today-summary" v-if="form.addPoints || form.deductPoints">
        <div class="card-title">今日小结</div>
        <div class="summary-row">
          <span>今日净得分</span>
          <span
            class="summary-score"
            :class="form.addPoints - form.deductPoints >= 0 ? 'points-positive' : 'points-negative'"
          >
            {{ form.addPoints - form.deductPoints >= 0 ? '+' : '' }}{{ form.addPoints - form.deductPoints }} 分
          </span>
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

    <!-- Toast -->
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

/* 区域样式 */
.section-add {
  border-left: 3px solid var(--color-success);
}

.section-deduct {
  border-left: 3px solid var(--color-danger);
}

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

.add-icon {
  background: var(--color-success);
}

.deduct-icon {
  background: var(--color-danger);
}

/* 分数输入 */
.point-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.point-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1.5px solid var(--color-border);
  background: var(--color-bg-white);
  font-size: 20px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  color: var(--color-text);
}

.point-btn:active {
  transform: scale(0.92);
  background: var(--color-bg);
}

.point-input {
  width: 80px;
  text-align: center;
  font-size: 28px;
  font-weight: 700;
  border: none;
  border-bottom: 2px solid var(--color-border);
  border-radius: 0;
  padding: 4px 0;
}

.point-input:focus {
  border-color: var(--color-primary);
  box-shadow: none;
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

/* 快捷标签 - 扣分主题 */
.quick-tag.deduct:hover,
.quick-tag.deduct.selected {
  border-color: var(--color-danger);
  background: var(--color-danger-light);
  color: var(--color-danger);
}

/* 今日小结 */
.today-summary {
  background: linear-gradient(135deg, #f5f7ff 0%, #f0f5ff 100%);
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
}

.summary-score {
  font-size: 24px;
  font-weight: 700;
}

/* 保存按钮 */
.save-btn {
  margin-top: 4px;
}

.save-hint {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-placeholder);
  margin-top: 8px;
  padding-bottom: 20px;
}

/* Toast 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
