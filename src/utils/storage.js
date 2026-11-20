/**
 * 数据存储与统计工具
 *
 * 积分 / 三餐 / 消费 / 跑步数据 → 飞书多维表格（通过 /api/*）
 * 历史原因候选 & 周目标 → localStorage（仅 UI 便利功能）
 */
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'

dayjs.extend(isoWeek)

// 统一的原因/内容拆分正则（中英文逗号、分号、顿号、换行）
export const REASON_SPLIT_RE = /[,，;；、\n]+/

export function todayKey() {
  return dayjs().format('YYYY-MM-DD')
}

export function isValidDateKey(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false
  }
  const d = dayjs(dateStr)
  return d.isValid() && d.format('YYYY-MM-DD') === dateStr
}

export function roundMoney(val) {
  const n = Number(val)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100) / 100
}

export function emptyRecord(dateKey) {
  return {
    date: dateKey,
    addPoints: 0,
    addReason: '',
    deductPoints: 0,
    deductReason: '',
    breakfastAmount: 0,
    breakfastContent: '',
    lunchAmount: 0,
    lunchContent: '',
    dinnerAmount: 0,
    dinnerContent: '',
    otherExpense: 0,
    otherExpenseReason: '',
    runTime: 0,
    runDistance: 0,
  }
}

export function hasAnyContent(record) {
  if (!record) return false
  return Boolean(
    Number(record.addPoints) > 0 ||
      Number(record.deductPoints) > 0 ||
      Number(record.breakfastAmount) > 0 ||
      Number(record.lunchAmount) > 0 ||
      Number(record.dinnerAmount) > 0 ||
      Number(record.otherExpense) > 0 ||
      Number(record.runTime) > 0 ||
      Number(record.runDistance) > 0 ||
      (record.addReason && record.addReason.trim()) ||
      (record.deductReason && record.deductReason.trim()) ||
      (record.breakfastContent && record.breakfastContent.trim()) ||
      (record.lunchContent && record.lunchContent.trim()) ||
      (record.dinnerContent && record.dinnerContent.trim()) ||
      (record.otherExpenseReason && record.otherExpenseReason.trim())
  )
}

// ============ 后端 API 调用 ============

async function parseJsonSafe(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

/**
 * 获取某个日期范围内的所有记录（失败时抛错，避免静默误判为空）
 */
export async function getRecordsInRange(startDate, endDate) {
  const res = await fetch(`/api/records?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`)
  const data = await parseJsonSafe(res)
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`)
  }
  if (data.recentTags && typeof data.recentTags === 'object') {
    mergeReasonHistory(data.recentTags)
  }
  return Array.isArray(data.records) ? data.records : []
}

/**
 * 获取某一天的记录（失败时抛错）
 */
export async function getDayRecord(dateKey) {
  const records = await getRecordsInRange(dateKey, dateKey)
  if (records.length > 0) {
    return { ...emptyRecord(dateKey), ...records[0] }
  }
  return emptyRecord(dateKey)
}

/**
 * 获取某日期所在 ISO 周（周一 ~ 周日）的所有记录
 */
export async function getWeekRecordsForDate(dateKey = todayKey()) {
  const d = dayjs(dateKey)
  const start = d.startOf('isoWeek').format('YYYY-MM-DD')
  const end = d.endOf('isoWeek').format('YYYY-MM-DD')
  return getRecordsInRange(start, end)
}

export async function getThisWeekRecords() {
  return getWeekRecordsForDate(todayKey())
}

export async function getThisMonthRecords() {
  const start = dayjs().startOf('month').format('YYYY-MM-DD')
  const end = dayjs().endOf('month').format('YYYY-MM-DD')
  return getRecordsInRange(start, end)
}

/**
 * 保存某一天的记录（覆盖保存），同时将原因存入历史候选
 */
export async function saveDayRecord(record) {
  const payload = {
    ...record,
    date: String(record.date || '').trim(),
    addPoints: roundMoney(record.addPoints),
    deductPoints: roundMoney(record.deductPoints),
    breakfastAmount: roundMoney(record.breakfastAmount),
    lunchAmount: roundMoney(record.lunchAmount),
    dinnerAmount: roundMoney(record.dinnerAmount),
    otherExpense: roundMoney(record.otherExpense),
    runTime: Math.max(0, Math.floor(Number(record.runTime) || 0)),
    runDistance: roundMoney(record.runDistance),
  }

  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await parseJsonSafe(res)
  if (!res.ok) {
    throw new Error(data.error || '保存失败')
  }

  collectReasons('add', payload.addReason)
  collectReasons('deduct', payload.deductReason)
  collectReasons('breakfast', payload.breakfastContent)
  collectReasons('lunch', payload.lunchContent)
  collectReasons('dinner', payload.dinnerContent)
  collectReasons('otherExpense', payload.otherExpenseReason)

  return data
}

// ============ 历史原因候选 & 周目标管理（localStorage） ============

const REASON_HISTORY_KEY = 'reason_history'
const WEEKLY_GOAL_KEY = 'weekly_points_goal'

function loadReasonHistory() {
  try {
    const raw = localStorage.getItem(REASON_HISTORY_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveReasonHistory(history) {
  try {
    localStorage.setItem(REASON_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // 忽略隐私模式或配额异常
  }
}

/**
 * 把文本里的多条原因拆开，依次前置加入历史候选（修复旧版只留最后一条的覆盖 Bug）
 */
function collectReasons(type, text) {
  if (!text || !text.trim()) return
  const reasons = text
    .split(REASON_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean)
  if (reasons.length === 0) return

  const history = loadReasonHistory()
  let list = Array.isArray(history[type]) ? [...history[type]] : []
  // 逆序插入，保证用户输入顺序靠前的排在最前面
  for (let i = reasons.length - 1; i >= 0; i--) {
    const r = reasons[i]
    list = [r, ...list.filter((x) => x !== r)]
  }
  history[type] = list.slice(0, 30)
  saveReasonHistory(history)
}

export function getReasonHistory(type) {
  const history = loadReasonHistory()
  return Array.isArray(history[type]) ? history[type] : []
}

/**
 * 将飞书多维表格返回的最近历史标签与本地 localStorage 合并去重
 * 确保换设备、清缓存或首次访问也能直接点选历史常用内容
 */
export function mergeReasonHistory(remoteTags) {
  if (!remoteTags || typeof remoteTags !== 'object') return
  const history = loadReasonHistory()
  const types = ['add', 'deduct', 'breakfast', 'lunch', 'dinner', 'otherExpense']

  types.forEach((type) => {
    const localList = Array.isArray(history[type]) ? history[type] : []
    const remoteList = Array.isArray(remoteTags[type]) ? remoteTags[type] : []
    const merged = []
    const seen = new Set()

    // 以飞书最新历史为基准，同时保留本地刚保存过的项在最前面
    for (const item of [...localList, ...remoteList]) {
      const cleaned = String(item || '').trim()
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned)
        merged.push(cleaned)
        if (merged.length >= 30) break
      }
    }
    if (merged.length > 0) {
      history[type] = merged
    }
  })

  saveReasonHistory(history)
}

export function getWeeklyGoal() {
  try {
    const val = Number(localStorage.getItem(WEEKLY_GOAL_KEY))
    return Number.isFinite(val) && val > 0 ? val : 15
  } catch {
    return 15
  }
}

export function setWeeklyGoal(goal) {
  const n = Math.max(1, Math.round(Number(goal) || 15))
  try {
    localStorage.setItem(WEEKLY_GOAL_KEY, String(n))
  } catch {
    // ignore
  }
  return n
}

// ============ 统计汇总 ============

/**
 * 计算某组记录中截至参考日期的连续有效打卡天数
 */
export function calcStreakDays(records, refDateKey = todayKey()) {
  const validSet = new Set(
    records.filter((r) => hasAnyContent(r) && r.date).map((r) => r.date)
  )
  let streak = 0
  let cursor = dayjs(refDateKey)
  // 如果今天还没打卡，从昨天开始往回算连续天数
  if (!validSet.has(cursor.format('YYYY-MM-DD'))) {
    cursor = cursor.subtract(1, 'day')
  }
  while (validSet.has(cursor.format('YYYY-MM-DD'))) {
    streak += 1
    cursor = cursor.subtract(1, 'day')
  }
  return streak
}

/**
 * 统计一组记录的汇总数据（自动忽略全 0 空行对有效天数的干扰）
 */
export function summarizeRecords(records, refDateKey = todayKey()) {
  let totalAdd = 0
  let totalDeduct = 0
  let totalMeal = 0
  let totalBreakfast = 0
  let totalLunch = 0
  let totalDinner = 0
  let totalRunTime = 0
  let totalRunDistance = 0
  let totalOtherExpense = 0

  const addReasonMap = {}
  const deductReasonMap = {}
  const breakfastReasonMap = {}
  const lunchReasonMap = {}
  const dinnerReasonMap = {}
  const otherExpenseReasonMap = {}
  const dailyScores = []

  const validRecords = records.filter((r) => hasAnyContent(r))

  validRecords.forEach((r) => {
    const add = roundMoney(r.addPoints)
    const deduct = roundMoney(r.deductPoints)
    const breakfast = roundMoney(r.breakfastAmount)
    const lunch = roundMoney(r.lunchAmount)
    const dinner = roundMoney(r.dinnerAmount)
    const mealTotal = roundMoney(breakfast + lunch + dinner)
    const runTime = Math.max(0, Math.floor(Number(r.runTime) || 0))
    const runDistance = roundMoney(r.runDistance)
    const otherExpense = roundMoney(r.otherExpense)

    totalAdd = roundMoney(totalAdd + add)
    totalDeduct = roundMoney(totalDeduct + deduct)
    totalBreakfast = roundMoney(totalBreakfast + breakfast)
    totalLunch = roundMoney(totalLunch + lunch)
    totalDinner = roundMoney(totalDinner + dinner)
    totalMeal = roundMoney(totalMeal + mealTotal)
    totalRunTime += runTime
    totalRunDistance = roundMoney(totalRunDistance + runDistance)
    totalOtherExpense = roundMoney(totalOtherExpense + otherExpense)

    dailyScores.push({
      date: r.date,
      add,
      deduct,
      net: Math.round((add - deduct) * 100) / 100,
      breakfast,
      lunch,
      dinner,
      mealTotal,
      runTime,
      runDistance,
      otherExpense,
      totalSpend: roundMoney(mealTotal + otherExpense),
    })

    accumulateReasons(r.addReason, addReasonMap)
    accumulateReasons(r.deductReason, deductReasonMap)
    accumulateReasons(r.breakfastContent, breakfastReasonMap)
    accumulateReasons(r.lunchContent, lunchReasonMap)
    accumulateReasons(r.dinnerContent, dinnerReasonMap)
    accumulateReasons(r.otherExpenseReason, otherExpenseReasonMap)
  })

  const runSpeed = totalRunTime > 0 && totalRunDistance > 0 ? totalRunDistance / totalRunTime : 0
  const totalSpend = roundMoney(totalMeal + totalOtherExpense)

  return {
    totalAdd,
    totalDeduct,
    netScore: Math.round((totalAdd - totalDeduct) * 100) / 100,
    totalMeal,
    totalBreakfast,
    totalLunch,
    totalDinner,
    totalRunTime,
    totalRunDistance,
    runSpeed,
    totalOtherExpense,
    totalSpend,
    addReasons: toSortedList(addReasonMap),
    deductReasons: toSortedList(deductReasonMap),
    breakfastReasons: toSortedList(breakfastReasonMap),
    lunchReasons: toSortedList(lunchReasonMap),
    dinnerReasons: toSortedList(dinnerReasonMap),
    otherExpenseReasons: toSortedList(otherExpenseReasonMap),
    dailyScores,
    dayCount: validRecords.length,
    streakDays: calcStreakDays(validRecords, refDateKey),
  }
}

function accumulateReasons(text, map) {
  if (!text || !text.trim()) return
  const reasons = text
    .split(REASON_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean)
  reasons.forEach((reason) => {
    map[reason] = (map[reason] || 0) + 1
  })
}

function toSortedList(map) {
  return Object.entries(map)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * 把秒数格式化成「X分X秒」
 */
export function formatRunTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  if (s < 60) return `${s}秒`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}分${r}秒`
}

/**
 * 格式化跑步配速（分'秒"/公里）
 */
export function formatRunPace(seconds, meters) {
  const s = Number(seconds) || 0
  const m = Number(meters) || 0
  if (s <= 0 || m <= 0) return '--'
  const secPerKm = Math.round((s / m) * 1000)
  const mins = Math.floor(secPerKm / 60)
  const secs = secPerKm % 60
  return `${mins}'${String(secs).padStart(2, '0')}"/公里`
}

/**
 * 格式化金额（整数不显 .00 或统一保留两位）
 */
export function formatMoney(amount, fixed = 2) {
  const n = Number(amount) || 0
  return n.toFixed(fixed)
}
