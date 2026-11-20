/**
 * 飞书鉴权与多维表格公共工具
 */

let cachedToken = ''
let tokenExpireAt = 0
let pendingTokenPromise = null

function requireEnv(name) {
  const val = process.env[name]
  if (!val) {
    throw new Error(`缺少环境变量: ${name}`)
  }
  return val
}

export async function getTenantToken() {
  if (cachedToken && Date.now() < tokenExpireAt) {
    return cachedToken
  }

  if (pendingTokenPromise) {
    return pendingTokenPromise
  }

  pendingTokenPromise = (async () => {
    const appId = requireEnv('FEISHU_APP_ID')
    const appSecret = requireEnv('FEISHU_APP_SECRET')

    const res = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret,
        }),
      }
    )

    if (!res.ok) {
      throw new Error(`飞书鉴权 HTTP 错误: ${res.status}`)
    }

    const data = await res.json()
    if (data.code !== 0) {
      throw new Error(`飞书鉴权失败: ${data.msg || data.code}`)
    }

    cachedToken = data.tenant_access_token
    // 提前 5 分钟刷新
    tokenExpireAt = Date.now() + Math.max(60, (data.expire || 7200) - 300) * 1000
    return cachedToken
  })()

  try {
    return await pendingTokenPromise
  } finally {
    pendingTokenPromise = null
  }
}

/**
 * 构建飞书 API 请求的通用 headers
 */
export async function feishuHeaders() {
  const token = await getTenantToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

/**
 * 多维表格的 base URL
 */
export function bitableBaseUrl() {
  const appToken = requireEnv('BITABLE_APP_TOKEN')
  const tableId = requireEnv('BITABLE_TABLE_ID')
  return `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`
}

/**
 * 飞书多维表格的文本字段可能是字符串或富文本数组，统一提取并去首尾空格
 */
export function extractText(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value.map((seg) => seg?.text || '').join('').trim()
  }
  return String(value).trim()
}

/**
 * 分页拉取多维表格全部记录，任何一步异常直接抛错（避免误判为空）
 */
export async function fetchAllRecords(baseUrl, headers) {
  let allItems = []
  let pageToken = ''

  do {
    const params = new URLSearchParams({ page_size: '500' })
    if (pageToken) params.set('page_token', pageToken)

    const response = await fetch(`${baseUrl}?${params}`, { headers })
    if (!response.ok) {
      throw new Error(`飞书查询 HTTP 错误: ${response.status}`)
    }

    const data = await response.json()
    if (data.code !== 0) {
      const err = new Error(`飞书 API 错误: ${data.msg || data.code}`)
      err.code = data.code
      throw err
    }

    allItems = allItems.concat(data.data?.items || [])
    pageToken = data.data?.page_token || ''
  } while (pageToken)

  return allItems
}

/**
 * 校验 YYYY-MM-DD 日期格式
 */
export function isValidDateStr(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  )
}

/**
 * 规范化非负数字
 */
export function nonNegativeNumber(value, decimals = 2) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  const factor = Math.pow(10, decimals)
  return Math.round(n * factor) / factor
}
