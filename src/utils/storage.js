/**
 * 数据存储工具
 *
 * 积分数据 + 三餐数据 → 飞书多维表格（通过 /api/* 后端接口）
 * 历史原因候选 → localStorage（仅 UI 便利功能）
 *
 * 数据结构：
 * {
 *   date: 'YYYY-MM-DD',
 *   addPoints, addReason,
 *   deductPoints, deductReason,
 *   breakfastAmount, breakfastContent,
 *   lunchAmount, lunchContent,
 *   dinnerAmount, dinnerContent,
 * }
 */
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'

dayjs.extend(isoWeek)

// ============ 后端 API 调用 ============

export function todayKey() {
  return dayjs().format('YYYY-MM-DD')
}

/**
 * 获取某一天的记录
 */
export async function getDayRecord(dateKey) {
  try {
    const res = await fetch(`/api/records?start=${dateKey}&end=${dateKey}`)
    const data = await res.json()
    if (data.records && data.records.length > 0) {
      return data.records[0]
    }
  } catch (err) {
    console.error('获取记录失败:', err)
  }
  return emptyRecord(dateKey)
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
  }
}

/**
 * 保存某一天的记录（覆盖保存），同时将原因存入历史候选
 */
export async function saveDayRecord(record) {
  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || '保存失败')
  }

  // 加扣分原因存入历史候选
  collectReasons('add', record.addReason)
  collectReasons('deduct', record.deductReason)

  // 三餐内容存入历史候选
  collectReasons('breakfast', record.breakfastContent)
  collectReasons('lunch', record.lunchContent)
  collectReasons('dinner', record.dinnerContent)

  return data
}

/**
 * 获取某个日期范围内的所有记录
 */
export async function getRecordsInRange(startDate, endDate) {
  try {
    const res = await fetch(`/api/records?start=${startDate}&end=${endDate}`)
    const data = await res.json()
    return data.records || []
  } catch (err) {
    console.error('获取记录失败:', err)
    return []
  }
}

export async function getThisWeekRecords() {
  const start = dayjs().startOf('isoWeek').format('YYYY-MM-DD')
  const end = dayjs().endOf('isoWeek').format('YYYY-MM-DD')
  return getRecordsInRange(start, end)
}

export async function getThisMonthRecords() {
  const start = dayjs().startOf('month').format('YYYY-MM-DD')
  const end = dayjs().endOf('month').format('YYYY-MM-DD')
  return getRecordsInRange(start, end)
}

// ============ 历史原因候选管理（localStorage） ============

const REASON_HISTORY_KEY = 'reason_history'

function loadReasonHistory() {
  try {
    const raw = localStorage.getItem(REASON_HISTORY_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveReasonHistory(history) {
  localStorage.setItem(REASON_HISTORY_KEY, JSON.stringify(history))
}

/**
 * 把文本里的多条原因（用顿号/逗号等分隔）拆开，分别加入历史候选
 */
function collectReasons(type, text) {
  if (!text || !text.trim()) return
  const reasons = text.split(/[,，;；、\n]+/).map((s) => s.trim()).filter(Boolean)
  if (reasons.length === 0) return

  const history = loadReasonHistory()
  const list = history[type] || []
  reasons.forEach((r) => {
    const filtered = list.filter((x) => x !== r)
    filtered.unshift(r)
    history[type] = filtered.slice(0, 30)
  })
  saveReasonHistory(history)
}

/**
 * 获取指定类型的历史候选列表
 * @param {'add'|'deduct'|'breakfast'|'lunch'|'dinner'} type
 */
export function getReasonHistory(type) {
  const history = loadReasonHistory()
  return history[type] || []
}

// ============ 统计汇总 ============

/**
 * 统计一组记录的汇总数据
 */
export function summarizeRecords(records) {
  let totalAdd = 0
  let totalDeduct = 0
  let totalMeal = 0
  let totalBreakfast = 0
  let totalLunch = 0
  let totalDinner = 0

  const addReasonMap = {}
  const deductReasonMap = {}
  const breakfastReasonMap = {}
  const lunchReasonMap = {}
  const dinnerReasonMap = {}
  const dailyScores = []

  records.forEach((r) => {
    const add = Number(r.addPoints) || 0
    const deduct = Number(r.deductPoints) || 0
    const breakfast = Number(r.breakfastAmount) || 0
    const lunch = Number(r.lunchAmount) || 0
    const dinner = Number(r.dinnerAmount) || 0

    totalAdd += add
    totalDeduct += deduct
    totalBreakfast += breakfast
    totalLunch += lunch
    totalDinner += dinner
    totalMeal += breakfast + lunch + dinner

    dailyScores.push({
      date: r.date,
      add,
      deduct,
      net: add - deduct,
      breakfast,
      lunch,
      dinner,
      mealTotal: breakfast + lunch + dinner,
    })

    accumulateReasons(r.addReason, addReasonMap)
    accumulateReasons(r.deductReason, deductReasonMap)
    accumulateReasons(r.breakfastContent, breakfastReasonMap)
    accumulateReasons(r.lunchContent, lunchReasonMap)
    accumulateReasons(r.dinnerContent, dinnerReasonMap)
  })

  return {
    totalAdd,
    totalDeduct,
    netScore: totalAdd - totalDeduct,
    totalMeal,
    totalBreakfast,
    totalLunch,
    totalDinner,
    addReasons: toSortedList(addReasonMap),
    deductReasons: toSortedList(deductReasonMap),
    breakfastReasons: toSortedList(breakfastReasonMap),
    lunchReasons: toSortedList(lunchReasonMap),
    dinnerReasons: toSortedList(dinnerReasonMap),
    dailyScores,
    dayCount: records.length,
  }
}

function accumulateReasons(text, map) {
  if (!text || !text.trim()) return
  const reasons = text.split(/[,，;；、\n]+/).map((s) => s.trim()).filter(Boolean)
  reasons.forEach((reason) => {
    map[reason] = (map[reason] || 0) + 1
  })
}

function toSortedList(map) {
  return Object.entries(map)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
}