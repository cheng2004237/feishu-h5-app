/**
 * GET /api/records?start=2026-07-06&end=2026-07-12
 *
 * 从飞书多维表格查询日期范围内的积分记录
 */
import {
  feishuHeaders,
  bitableBaseUrl,
  extractText,
  fetchAllRecords,
  isValidDateStr,
  nonNegativeNumber,
} from './_feishu.js'

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

    const records = allItems
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
      .filter((r) => isValidDateStr(r.date) && r.date >= start && r.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date))

    return res.status(200).json({ records })
  } catch (err) {
    console.error('查询记录失败:', err)
    return res.status(500).json({ error: err.message, code: err.code })
  }
}
