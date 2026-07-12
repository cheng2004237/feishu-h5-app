/**
 * GET /api/records?start=2026-07-06&end=2026-07-12
 *
 * 从飞书多维表格查询日期范围内的积分记录
 * 策略：拉取所有记录，前端按日期范围过滤（飞书的日期筛选条件不太好用）
 */
import { feishuHeaders, bitableBaseUrl } from './_feishu.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '仅支持 GET' })
  }

  try {
    const { start, end } = req.query
    if (!start || !end) {
      return res.status(400).json({ error: '需要 start 和 end 参数，格式 YYYY-MM-DD' })
    }

    const headers = await feishuHeaders()
    const baseUrl = bitableBaseUrl()

    // 拉取所有记录（多页），不依赖飞书的日期筛选
    let allItems = []
    let pageToken = ''

    do {
      const params = new URLSearchParams({ page_size: '500' })
      if (pageToken) params.set('page_token', pageToken)

      const url = `${baseUrl}?${params}`
      const response = await fetch(url, { headers })
      const data = await response.json()

      if (data.code !== 0) {
        console.error('飞书 API 错误:', data)
        return res.status(500).json({ error: data.msg, code: data.code })
      }

      allItems = allItems.concat(data.data?.items || [])
      pageToken = data.data?.page_token || ''
    } while (pageToken)

    // 转换为前端需要的格式
    const records = allItems
      .map((item) => {
        const f = item.fields
        return {
          id: item.record_id,
          date: extractText(f['日期']),
          addPoints: Number(f['加分']) || 0,
          addReason: extractText(f['加分原因']),
          deductPoints: Number(f['扣分']) || 0,
          deductReason: extractText(f['扣分原因']),
          breakfastAmount: Number(f['早餐金额']) || 0,
          breakfastContent: extractText(f['早餐内容']),
          lunchAmount: Number(f['午餐金额']) || 0,
          lunchContent: extractText(f['午餐内容']),
          dinnerAmount: Number(f['晚餐金额']) || 0,
          dinnerContent: extractText(f['晚餐内容']),
        }
      })
      .filter((r) => r.date >= start && r.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date))

    return res.status(200).json({ records })
  } catch (err) {
    console.error('查询记录失败:', err)
    return res.status(500).json({ error: err.message })
  }
}

/**
 * 飞书多维表格的文本字段可能是字符串或富文本数组，统一提取
 */
function extractText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map((seg) => seg.text || '').join('')
  }
  return String(value)
}