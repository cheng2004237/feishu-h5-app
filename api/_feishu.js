/**
 * 飞书鉴权 - 获取 tenant_access_token
 * 供其他 API 函数复用
 */

let cachedToken = ''
let tokenExpireAt = 0

export async function getTenantToken() {
  if (cachedToken && Date.now() < tokenExpireAt) {
    return cachedToken
  }

  const res = await fetch(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: process.env.FEISHU_APP_ID,
        app_secret: process.env.FEISHU_APP_SECRET,
      }),
    }
  )

  const data = await res.json()
  if (data.code !== 0) {
    throw new Error(`飞书鉴权失败: ${data.msg}`)
  }

  cachedToken = data.tenant_access_token
  // 提前 5 分钟刷新
  tokenExpireAt = Date.now() + (data.expire - 300) * 1000
  return cachedToken
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
  const appToken = process.env.BITABLE_APP_TOKEN
  const tableId = process.env.BITABLE_TABLE_ID
  return `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`
}
