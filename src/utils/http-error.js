export async function responseErrorMessage(error) {
  let data = error?.response?.data
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try { data = JSON.parse(await data.text()) } catch { data = null }
  }
  if (typeof data?.msg === 'string' && data.msg.trim()) return data.msg
  const message = String(error?.message || '请求失败，请稍后重试')
  if (message === 'Network Error') return '后端接口连接异常'
  if (message.includes('timeout')) return '系统接口请求超时'
  if (error?.response?.status) return `系统接口${error.response.status}异常`
  return message
}
