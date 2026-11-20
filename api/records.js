/**
 * GET /api/records?start=2026-07-06&end=2026-07-12
 *
 * 从飞书多维表格查询日期范围内的积分记录，
 * 并顺带从全量历史记录中提取最近使用过的 6 类原因/内容标签（跨设备同步，零额外 API 消耗）
 */
import {
  feishuHeaders,
  bitableBaseUrl,
  extractText,
  fetchAllRecords,
  isValidDateStr,
  nonNegativeNumber,
} from './_feishu.js'

const REASON_SPLIT_RE = /[,，;；、\n]+/

function buildRecentTags(mappedAll) {
  const buckets = {
    add: [],
    deduct: [],
    breakfast: [],
    lunch: [],
    dinner: [],
    otherExpense: [],
  }
  const seen = {
    add: new Set(),
    deduct: new Set(),
    breakfast: new Set(),
    lunch: new Set(),
    dinner: new Set(),
    otherExpense: new Set(),
  }
  const fields = [
    ['add', 'addReason'],
    ['deduct', 'deductReason'],
    ['breakfast', 'breakfastContent'],
    ['lunch', 'lunchContent'],
    ['dinner', 'dinnerContent'],
    ['otherExpense', 'otherExpenseReason'],
  ]

  // 按日期从新到旧扫描，确保最近用过的排在最前面
  const sortedDesc = [...mappedAll].sort((a, b) => b.date.localeCompare(a.date))
  for (const r of sortedDesc) {
    for (const [key, field] of fields) {
      if (buckets[key].length >= 25) continue
      const text = r[field]
      if (!text) continue
      const parts = text
        .split(REASON_SPLIT_RE)
        .map((s) => s.trim())
        .filter(Boolean)
      for (const p of parts) {
        if (!seen[key].has(p) && buckets[key].length < 25) {
          seen[key].add(p)
          buckets[key].push(p)
        }
      }
    }
  }

  return buckets
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '仅支持 GET' })
  }

  try {
    const { start, end } = req.query || {}
    if (!isValidDateStr(start) || !isValidDateStr(end)) {
      return res.status(400).json({ error: '需要合法的 start 和 end 参数，格式 YYYY-MM-DD' })
    }

    const headers = await feishuHeaders()
    const baseUrl = bitableBaseUrl()
    const allItems = await fetchAllRecords(baseUrl, headers)

    const mappedAll = allItems
      .map((item) => {
        const f = item.fields || {}
        return {
          id: item.record_id,
          date: extractText(f['日期']),
          addPoints: nonNegativeNumber(f['加分'], 2),
          addReason: extractText(f['加分原因']),
          deductPoints: nonNegativeNumber(f['扣分'], 2),
          deductReason: extractText(f['扣分原因']),
          breakfastAmount: nonNegativeNumber(f['早餐金额'], 2),
          breakfastContent: extractText(f['早餐内容']),
          lunchAmount: nonNegativeNumber(f['午餐金额'], 2),
          lunchContent: extractText(f['午餐内容']),
          dinnerAmount: nonNegativeNumber(f['晚餐金额'], 2),
          dinnerContent: extractText(f['晚餐内容']),
          otherExpense: nonNegativeNumber(f['其他消费'], 2),
          otherExpenseReason: extractText(f['其他消费原因']),
          runTime: Math.floor(nonNegativeNumber(f['跑步用时'], 0)),
          runDistance: nonNegativeNumber(f['跑步距离'], 2),
        }
      })
      .filter((r) => isValidDateStr(r.date))

    const recentTags = buildRecentTags(mappedAll)

    const records = mappedAll
      .filter((r) => r.date >= start && r.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date))

    return res.status(200).json({ records, recentTags })
  } catch (err) {
    console.error('查询记录失败:', err)
    return res.status(500).json({ error: err.message, code: err.code })
  }
}
