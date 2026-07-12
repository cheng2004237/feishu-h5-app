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

    // 1. 先查询当天是否已有记录
    const existingId = await findRecordByDate(baseUrl, headers, date)

    const fields = {
      '日期': date,
      '加分': Number(addPoints) || 0,
      '加分原因': addReason || '',
      '扣分': Number(deductPoints) || 0,
      '扣分原因': deductReason || '',
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
 */
async function findRecordByDate(baseUrl, headers, date) {
  const filter = JSON.stringify({
    conjunction: 'and',
    conditions: [
      { field_name: '日期', operator: 'is', value: [date] },
    ],
  })

  const params = new URLSearchParams({ filter, page_size: '1' })
  const response = await fetch(`${baseUrl}?${params}`, { headers })
  const data = await response.json()

  if (data.code !== 0) {
    console.error('查询已有记录失败:', data)
    return null
  }

  const items = data.data?.items || []
  return items.length > 0 ? items[0].record_id : null
}
