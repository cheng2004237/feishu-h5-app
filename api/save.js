/**
 * POST /api/save
 *
 * 保存一天的积分记录到飞书多维表格
 * 如果当天已有记录则更新，没有则新增
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST' })
  }

  try {
    const body = req.body || {}
    const date = typeof body.date === 'string' ? body.date.trim() : ''

    if (!isValidDateStr(date)) {
      return res.status(400).json({ error: '缺少或非法的 date 字段，格式应为 YYYY-MM-DD' })
    }

    const headers = await feishuHeaders()
    const baseUrl = bitableBaseUrl()

    // 若查询出错直接抛异常，绝不误判为“无记录”导致重复新增
    const existingId = await findRecordByDate(baseUrl, headers, date)

    const fields = {
      '日期': date,
      '加分': nonNegativeNumber(body.addPoints, 2),
      '加分原因': String(body.addReason || '').trim(),
      '扣分': nonNegativeNumber(body.deductPoints, 2),
      '扣分原因': String(body.deductReason || '').trim(),
      '早餐金额': nonNegativeNumber(body.breakfastAmount, 2),
      '早餐内容': String(body.breakfastContent || '').trim(),
      '午餐金额': nonNegativeNumber(body.lunchAmount, 2),
      '午餐内容': String(body.lunchContent || '').trim(),
      '晚餐金额': nonNegativeNumber(body.dinnerAmount, 2),
      '晚餐内容': String(body.dinnerContent || '').trim(),
      '其他消费': nonNegativeNumber(body.otherExpense, 2),
      '其他消费原因': String(body.otherExpenseReason || '').trim(),
      '跑步用时': Math.floor(nonNegativeNumber(body.runTime, 0)),
      '跑步距离': nonNegativeNumber(body.runDistance, 2),
    }

    let response
    if (existingId) {
      response = await fetch(`${baseUrl}/${existingId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ fields }),
      })
    } else {
      response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields }),
      })
    }

    if (!response.ok) {
      throw new Error(`飞书写入 HTTP 错误: ${response.status}`)
    }

    const result = await response.json()
    if (result.code !== 0) {
      console.error('飞书 API 错误:', result)
      return res.status(500).json({ error: result.msg || '飞书保存失败', code: result.code })
    }

    return res.status(200).json({
      success: true,
      action: existingId ? 'updated' : 'created',
      id: result.data?.record?.record_id || existingId || '',
    })
  } catch (err) {
    console.error('保存记录失败:', err)
    return res.status(500).json({ error: err.message })
  }
}

/**
 * 按日期查找已有记录，返回 record_id 或 null
 * 查询失败时直接抛错，避免误新建重复记录
 */
async function findRecordByDate(baseUrl, headers, date) {
  const allItems = await fetchAllRecords(baseUrl, headers)
  const target = String(date).trim()

  for (const item of allItems) {
    const fieldText = extractText(item.fields?.['日期'])
    if (fieldText === target) {
      return item.record_id
    }
  }

  return null
}
