/**
 * GET /api/records?start=2024-01-01&end=2024-01-31
 *
 * 从飞书多维表格查询日期范围内的积分记录
 */
import { feishuHeaders, bitableBaseUrl } from './_feishu.js'

export default async function handler(req, res) {
  // 允许跨域（本地开发用）
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

    // 构建筛选条件：日期 >= start AND 日期 <= end
    const filter = JSON.stringify({
      conjunction: 'and',
      conditions: [
        { field_name: '日期', operator: 'isGreater', value: [start + ' 00:00'] },
        { field_name: '日期', operator: 'isLess', value: [end + ' 23:59'] },
      ],
    })

    // 尝试用文本字段直接筛选
    const sort = JSON.stringify([{ field_name: '日期', desc: false }])
    const params = new URLSearchParams({ page_size: '100', sort })

    const url = `${baseUrl}?${params}`
    const response = await fetch(url, { headers })
    const data = await response.json()

    if (data.code !== 0) {
      console.error('飞书 API 错误:', data)
      return res.status(500).json({ error: data.msg })
    }

    // 把飞书的记录格式转成前端需要的格式
    const records = (data.data?.items || [])
      .map((item) => {
        const f = item.fields
        return {
          id: item.record_id,
          date: extractText(f['日期']),
          addPoints: Number(f['加分']) || 0,
          addReason: extractText(f['加分原因']),
          deductPoints: Number(f['扣分']) || 0,
          deductReason: extractText(f['扣分原因']),
        }
      })
      // 在前端侧也做一次日期过滤（兜底）
      .filter((r) => r.date >= start && r.date <= end)

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
