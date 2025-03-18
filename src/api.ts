export interface BuildEntity {
  id: number
  appName: string
  buildType: string
  branch: string
  buildTime: Date
  buildNumber: string
  downloadUrl: string
  filePath: string
  fileName: string
  createdAt: Date
}

export interface BuildQueryParams {
  appName?: string
  buildType?: string
  branch?: string
  pageSize?: number
  page?: number
}

/**
 * 通用请求函数，使用 fetch API
 */
export const request = async (
  url: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    params?: Record<string, any>
    data?: any
  }
) => {
  const { method, params, data } = options

  // 处理 GET 请求的查询参数
  let requestUrl = url
  if (params && Object.keys(params).length > 0) {
    const queryString = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryString.append(key, String(value))
      }
    })
    requestUrl = `${url}${url.includes('?') ? '&' : '?'}${queryString.toString()}`
  }

  // 设置请求选项
  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  }

  // 添加请求体（对于非 GET 请求）
  if (data && method !== 'GET') {
    fetchOptions.body = JSON.stringify(data)
  }

  // 发送请求
  const response = await fetch(requestUrl, fetchOptions)

  // 检查响应状态
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status} ${response.statusText}`)
  }

  // 解析响应数据
  const responseData = await response.json()
  return responseData
}

/**
 * Query build list
 */
export const queryBuilds = async (params: BuildQueryParams) => {
  const res = await request(`https://qa-fta-server.amh-group.com/harmony/build/query`, {
    method: 'GET',
    params,
  })
  return res
}

/**
 * Get config for harmony builds
 */
export const getHarmonyConfig = async () => {
  const res = await request('https://qa-fta-server.amh-group.com/config/getConfigByName', {
    method: 'GET',
    params: { configName: 'harmony-hdc-server' },
  })

  return (res?.data?.value?.url as string) ?? ''
}
