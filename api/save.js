/**
 * POST /api/save
 *
 * 保存一天的积分记录到飞书多维表格
 * 如果当天已有记录则更新，没有则新增
 *
 * Body: { date, addPoints, addReason, deductPoints, deductReason }
 */
import { feishuHeaders, bitableBaseUrl } from './_feishu.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST' })
  }

  try {
    const { date, addPoints, addReason, deductPoints, deductReason } = req.body

    if (!date) {
      return res.status(400).json({ error: '缺少 date 字段' })
    }

    const headers = await feishuHeaders()
    const baseUrl = bitableBaseUrl()

    // 1. 拉取所有记录，按 date 精确匹配（飞书的 filter is 筛选对文本字段不稳定）
    const existingId = await findRecordByDate(baseUrl, headers, date)

    const fields = {
      '日期': date,
      '加分': Number(addPoints) || 0,
      '加分原因': addReason || '',
      '扣分': Number(deductPoints) || 0,
      '扣分原因': deductReason || '',
      '早餐金额': Number(req.body.breakfastAmount) || 0,
      '早餐内容': req.body.breakfastContent || '',
      '午餐金额': Number(req.body.lunchAmount) || 0,
      '午餐内容': req.body.lunchContent || '',
      '晚餐金额': Number(req.body.dinnerAmount) || 0,
      '晚餐内容': req.body.dinnerContent || '',
      '其他消费': Number(req.body.otherExpense) || 0,
      '其他消费原因': req.body.otherExpenseReason || '',
      '跑步用时': Number(req.body.runTime) || 0,
      '跑步距离': Number(req.body.runDistance) || 0,
    }

    let result

    if (existingId) {
      // 2a. 已有记录 → 更新
      const updateRes = await fetch(`${baseUrl}/${existingId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ fields }),
      })
      result = await updateRes.json()
    } else {
      // 2b. 没有记录 → 新增
      const createRes = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields }),
      })
      result = await createRes.json()
    }

    if (result.code !== 0) {
      console.error('飞书 API 错误:', result)
      return res.status(500).json({ error: result.msg })
    }

    return res.status(200).json({
      success: true,
      action: existingId ? 'updated' : 'created',
    })
  } catch (err) {
    console.error('保存记录失败:', err)
    return res.status(500).json({ error: err.message })
  }
}

/**
 * 按日期查找已有记录，返回 record_id 或 null
 * 策略：拉取所有记录（多页），前端按日期精确匹配
 */
async function findRecordByDate(baseUrl, headers, date) {
  let allItems = []
  let pageToken = ''

  do {
    const params = new URLSearchParams({ page_size: '500' })
    if (pageToken) params.set('page_token', pageToken)

    const response = await fetch(`${baseUrl}?${params}`, { headers })
    const data = await response.json()

    if (data.code !== 0) {
      console.error('查询已有记录失败:', data)
      return null
    }

    allItems = allItems.concat(data.data?.items || [])
    pageToken = data.data?.page_token || ''
  } while (pageToken)

  // 精确匹配日期字符串
  const target = String(date).trim()
  for (const item of allItems) {
    const fieldValue = item.fields?.['日期']
    const fieldText =
      typeof fieldValue === 'string'
        ? fieldValue.trim()
        : Array.isArray(fieldValue)
        ? fieldValue.map((s) => s.text || '').join('').trim()
        : ''

    if (fieldText === target) {
      return item.record_id
    }
  }

  return null
}
