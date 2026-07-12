/**
 * 数据存储工具
 *
 * 积分数据 → 飞书多维表格（通过 /api/* 后端接口）
 * 历史原因候选 → localStorage（仅 UI 便利功能）
 */
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'

dayjs.extend(isoWeek)

// ============ 后端 API 调用 ============

/**
 * 获取今天的日期 key，格式 YYYY-MM-DD
 */
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
  return {
    date: dateKey,
    addPoints: 0,
    addReason: '',
    deductPoints: 0,
    deductReason: '',
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

  // 把本次输入的原因存入本地历史候选
  if (record.addReason && record.addReason.trim()) {
    const reasons = record.addReason.split(/[,，;；、\n]+/).map((s) => s.trim()).filter(Boolean)
    reasons.forEach((r) => addReasonToHistory('add', r))
  }
  if (record.deductReason && record.deductReason.trim()) {
    const reasons = record.deductReason.split(/[,，;；、\n]+/).map((s) => s.trim()).filter(Boolean)
    reasons.forEach((r) => addReasonToHistory('deduct', r))
  }

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

/** 获取本周记录（周一到周日） */
export async function getThisWeekRecords() {
  const start = dayjs().startOf('isoWeek').format('YYYY-MM-DD')
  const end = dayjs().endOf('isoWeek').format('YYYY-MM-DD')
  return getRecordsInRange(start, end)
}

/** 获取本月记录 */
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
    return raw ? JSON.parse(raw) : { add: [], deduct: [] }
  } catch {
    return { add: [], deduct: [] }
  }
}

function saveReasonHistory(history) {
  localStorage.setItem(REASON_HISTORY_KEY, JSON.stringify(history))
}

function addReasonToHistory(type, reason) {
  const history = loadReasonHistory()
  const list = history[type] || []
  const filtered = list.filter((r) => r !== reason)
  filtered.unshift(reason)
  history[type] = filtered.slice(0, 30)
  saveReasonHistory(history)
}

export function getReasonHistory(type) {
  const history = loadReasonHistory()
  return history[type] || []
}

// ============ 统计汇总（纯前端计算） ============

/**
 * 统计一组记录的汇总数据
 */
export function summarizeRecords(records) {
  let totalAdd = 0
  let totalDeduct = 0
  const addReasonMap = {}
  const deductReasonMap = {}
  const dailyScores = []

  records.forEach((r) => {
    const add = Number(r.addPoints) || 0
    const deduct = Number(r.deductPoints) || 0
    totalAdd += add
    totalDeduct += deduct

    dailyScores.push({
      date: r.date,
      add,
      deduct,
      net: add - deduct,
    })

    if (r.addReason && r.addReason.trim()) {
      const reasons = r.addReason.split(/[,，;；、\n]+/).map((s) => s.trim()).filter(Boolean)
      reasons.forEach((reason) => {
        addReasonMap[reason] = (addReasonMap[reason] || 0) + 1
      })
    }

    if (r.deductReason && r.deductReason.trim()) {
      const reasons = r.deductReason.split(/[,，;；、\n]+/).map((s) => s.trim()).filter(Boolean)
      reasons.forEach((reason) => {
        deductReasonMap[reason] = (deductReasonMap[reason] || 0) + 1
      })
    }
  })

  const addReasons = Object.entries(addReasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  const deductReasons = Object.entries(deductReasonMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  return {
    totalAdd,
    totalDeduct,
    netScore: totalAdd - totalDeduct,
    addReasons,
    deductReasons,
    dailyScores,
    dayCount: records.length,
  }
}
