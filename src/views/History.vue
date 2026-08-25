<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getRecordsInRange, todayKey, formatRunTime } from '../utils/storage.js'
import dayjs from 'dayjs'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js'

dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)

const router = useRouter()

// 状态：当前查看的月份 (用该月1号表示)
const currentMonthDate = ref(dayjs().startOf('month'))

// 状态：当前选中的日期 (YYYY-MM-DD)
const selectedDateKey = ref(todayKey())

// 状态：当前月的记录映射 { 'YYYY-MM-DD': record_object }
const monthRecords = ref({})
const loading = ref(false)

// 计算：显示的年月
const monthTitle = computed(() => currentMonthDate.value.format('YYYY年 M月'))

// 计算：当前日历需要显示的格子 (包含前置和后置空白)
const calendarDays = computed(() => {
  const startOfMonth = currentMonthDate.value.startOf('month')
  const endOfMonth = currentMonthDate.value.endOf('month')
  
  // startOfMonth.day() 返回 0-6 (0 是周日，1 是周一)
  // 我们日历从周一开始，所以要计算前面需要补几个空格
  let startOffset = startOfMonth.day() === 0 ? 6 : startOfMonth.day() - 1
  
  const daysInMonth = currentMonthDate.value.daysInMonth()
  const days = []
  
  // 前置空白格子
  for (let i = 0; i < startOffset; i++) {
    days.push({ empty: true, key: `prev-${i}` })
  }
  
  // 实际日期格子
  for (let i = 1; i <= daysInMonth; i++) {
    const date = startOfMonth.date(i)
    const dateStr = date.format('YYYY-MM-DD')
    days.push({
      empty: false,
      date: i,
      dateStr: dateStr,
      isToday: dateStr === todayKey(),
      hasRecord: !!monthRecords.value[dateStr]
    })
  }
  
  return days
})

// 计算：选中日期的记录内容
const selectedRecord = computed(() => monthRecords.value[selectedDateKey.value])

// 计算：选中日期是否是今天
const isSelectedToday = computed(() => selectedDateKey.value === todayKey())

// 获取当月数据
async function loadMonthData() {
  loading.value = true
  monthRecords.value = {}
  
  const startStr = currentMonthDate.value.startOf('month').format('YYYY-MM-DD')
  const endStr = currentMonthDate.value.endOf('month').format('YYYY-MM-DD')
  
  const records = await getRecordsInRange(startStr, endStr)
  
  const map = {}
  records.forEach(r => {
    if (r.date) map[r.date] = r
  })
  
  monthRecords.value = map
  loading.value = false
}

// 切换月份
function prevMonth() {
  currentMonthDate.value = currentMonthDate.value.subtract(1, 'month')
  loadMonthData()
}

function nextMonth() {
  currentMonthDate.value = currentMonthDate.value.add(1, 'month')
  loadMonthData()
}

// 选中日期
function selectDate(dateStr) {
  if (!dateStr) return
  selectedDateKey.value = dateStr
}

// 跳转去编辑/补登
function goToEdit() {
  router.push({ path: '/', query: { date: selectedDateKey.value } })
}

// 首次加载
onMounted(() => {
  loadMonthData()
})

</script>

<template>
  <div class="page">
    <div class="page-header">
      <div class="header-row">
        <h1>历史与补登</h1>
      </div>
    </div>

    <div class="page-content">
      <!-- 日历卡片 -->
      <div class="card calendar-card">
        <div class="calendar-header">
          <button class="icon-btn" @click="prevMonth">‹</button>
          <span class="month-title">{{ monthTitle }}</span>
          <button class="icon-btn" @click="nextMonth">›</button>
        </div>
        
        <div class="calendar-grid">
          <div class="weekday">一</div>
          <div class="weekday">二</div>
          <div class="weekday">三</div>
          <div class="weekday">四</div>
          <div class="weekday">五</div>
          <div class="weekday">六</div>
          <div class="weekday">日</div>
          
          <div 
            v-for="day in calendarDays" 
            :key="day.dateStr || day.key"
            class="day-cell"
            :class="{ 
              'empty': day.empty, 
              'is-today': day.isToday,
              'is-selected': day.dateStr === selectedDateKey
            }"
            @click="selectDate(day.dateStr)"
          >
            <template v-if="!day.empty">
              <span class="day-num">{{ day.date }}</span>
              <span v-if="day.hasRecord" class="record-dot"></span>
            </template>
          </div>
        </div>
      </div>

      <!-- 选中日期的详情卡片 -->
      <div class="detail-section">
        <div class="detail-header">
          <h3 class="detail-date">{{ dayjs(selectedDateKey).format('M月D日 dddd') }}</h3>
          <span v-if="isSelectedToday" class="today-tag">今天</span>
        </div>
        
        <div v-if="loading" class="detail-empty">
          <p>加载中...</p>
        </div>
        
        <template v-else-if="selectedRecord">
          <div class="card detail-card">
            <!-- 积分小计 -->
            <div class="detail-summary-row">
              <div class="detail-stat">
                <span class="stat-value positive">+{{ selectedRecord.addPoints || 0 }}</span>
                <span class="stat-label">加分</span>
              </div>
              <div class="detail-stat">
                <span class="stat-value negative">-{{ selectedRecord.deductPoints || 0 }}</span>
                <span class="stat-label">扣分</span>
              </div>
              <div class="detail-stat">
                <span class="stat-value meal">¥{{ 
                  ((Number(selectedRecord.breakfastAmount)||0) + 
                   (Number(selectedRecord.lunchAmount)||0) + 
                   (Number(selectedRecord.dinnerAmount)||0)).toFixed(2) 
                }}</span>
                <span class="stat-label">三餐</span>
              </div>
              <div v-if="selectedRecord.runDistance" class="detail-stat">
                <span class="stat-value run">{{ selectedRecord.runDistance }}米</span>
                <span class="stat-label">跑步</span>
              </div>
            </div>
            
            <div class="detail-divider"></div>
            
            <!-- 详细条目 -->
            <div class="detail-items">
              <div v-if="selectedRecord.addPoints > 0 || selectedRecord.addReason" class="detail-item">
                <div class="item-head">
                  <span class="item-dot add"></span>加分 ({{ selectedRecord.addPoints || 0 }})
                </div>
                <div class="item-body">{{ selectedRecord.addReason || '无原因' }}</div>
              </div>
              
              <div v-if="selectedRecord.deductPoints > 0 || selectedRecord.deductReason" class="detail-item">
                <div class="item-head">
                  <span class="item-dot deduct"></span>扣分 ({{ selectedRecord.deductPoints || 0 }})
                </div>
                <div class="item-body">{{ selectedRecord.deductReason || '无原因' }}</div>
              </div>
              
              <div v-if="selectedRecord.breakfastAmount > 0 || selectedRecord.breakfastContent" class="detail-item">
                <div class="item-head">
                  <span class="item-dot meal"></span>早餐 (¥{{ selectedRecord.breakfastAmount || 0 }})
                </div>
                <div class="item-body">{{ selectedRecord.breakfastContent || '无内容' }}</div>
              </div>
              
              <div v-if="selectedRecord.lunchAmount > 0 || selectedRecord.lunchContent" class="detail-item">
                <div class="item-head">
                  <span class="item-dot meal"></span>午餐 (¥{{ selectedRecord.lunchAmount || 0 }})
                </div>
                <div class="item-body">{{ selectedRecord.lunchContent || '无内容' }}</div>
              </div>
              
              <div v-if="selectedRecord.dinnerAmount > 0 || selectedRecord.dinnerContent" class="detail-item">
                <div class="item-head">
                  <span class="item-dot meal"></span>晚餐 (¥{{ selectedRecord.dinnerAmount || 0 }})
                </div>
                <div class="item-body">{{ selectedRecord.dinnerContent || '无内容' }}</div>
              </div>
              
              <div v-if="selectedRecord.runTime > 0 || selectedRecord.runDistance > 0" class="detail-item">
                <div class="item-head">
                  <span class="item-dot run"></span>跑步
                </div>
                <div class="item-body">
                  用时 {{ formatRunTime(selectedRecord.runTime) }} ·
                  距离 {{ selectedRecord.runDistance || 0 }} 米
                  <span v-if="selectedRecord.runTime > 0 && selectedRecord.runDistance > 0">
                    · 速度 {{ (selectedRecord.runDistance / selectedRecord.runTime).toFixed(2) }} 米/秒
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <button class="btn btn-lg btn-outline" @click="goToEdit">
            修改此日记录
          </button>
        </template>
        
        <template v-else>
          <div class="detail-empty">
            <div class="empty-icon">📝</div>
            <p>这一天没有记录</p>
            <button class="btn btn-primary btn-sm mt-3" @click="goToEdit">
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
}

.calendar-card {
  padding: 16px;
  margin-bottom: 20px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.month-title {
  font-size: 17px;
  font-weight: 600;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--color-bg-input);
  border: none;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px 4px;
  text-align: center;
}

.weekday {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
  margin-bottom: 8px;
}

.day-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 15px;
  font-weight: 500;
  position: relative;
  cursor: pointer;
}

.day-cell:not(.empty):active {
  opacity: 0.7;
}

.day-cell.is-today {
  color: var(--color-primary);
  font-weight: 700;
}

.day-cell.is-selected {
  background: var(--color-primary);
  color: white;
}

.record-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-success);
  position: absolute;
  bottom: 4px;
}

.day-cell.is-selected .record-dot {
  background: white;
}

/* 详情区 */
.detail-section {
  padding-bottom: 30px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 0 4px;
}

.detail-date {
  font-size: 18px;
  margin: 0;
}

.today-tag {
  font-size: 11px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.detail-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--color-text-tertiary);
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
  opacity: 0.5;
}

.mt-3 {
  margin-top: 12px;
}

.btn-sm {
  padding: 8px 20px;
  font-size: 15px;
  height: 40px;
  border-radius: 20px;
  width: auto;
  display: inline-flex;
}

.detail-card {
  padding: 16px;
  margin-bottom: 16px;
}

.detail-summary-row {
  display: flex;
  justify-content: space-around;
  padding-bottom: 12px;
}

.detail-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
}
.stat-value.positive { color: var(--color-success); }
.stat-value.negative { color: var(--color-danger); }
.stat-value.meal { color: var(--color-warning); }
.stat-value.run { color: #0A7E3B; }

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.detail-divider {
  height: 1px;
  background: rgba(60, 60, 67, 0.08);
  margin: 0 0 12px 0;
}

.detail-item {
  margin-bottom: 12px;
}
.detail-item:last-child {
  margin-bottom: 0;
}

.item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.item-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.item-dot.add { background: var(--color-success); }
.item-dot.deduct { background: var(--color-danger); }
.item-dot.meal { background: var(--color-warning); }
.item-dot.run { background: #34C759; }

.item-body {
  font-size: 14px;
  color: var(--color-text-secondary);
  padding-left: 14px;
  line-height: 1.4;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}
.btn-outline:active {
  background: var(--color-primary-light);
}
</style>