export function reportFilterError(range, filters, today) {
  const day = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  const [from, to] = range || []
  if (!day(from) || !day(to) || from > to || to > today || (Date.parse(to) - Date.parse(from)) / 86400000 >= 3660) return '请选择有效报表日期，结束日期不能晚于今天且区间须少于3660天'
  if (String(filters.county || '').length > 100 || String(filters.skuId || '').length > 64) return '县域或商品编号过长'
  if (!Number.isInteger(filters.rank) || filters.rank < 0 || filters.rank > 3 || ['agentId', 'customerId'].some(key => !Number.isSafeInteger(filters[key]) || filters[key] < 0)) return '职级和人员编号须为有效整数'
  return ''
}

const reportRankLabels = { 1: '云代理', 2: '分货中心', 3: '总代理' }
const reportOrderStatusLabels = { PAID: '已支付', SHIPPED: '已发货', COMPLETED: '已完成', REFUNDED: '已退款' }

export function reportDisplayCell(key, value) {
  if (key === 'rank_no') return reportRankLabels[value] || (value == null || Number(value) === 0 ? '未记录职级' : value)
  if (key === 'order_status') return reportOrderStatusLabels[value] || value
  if (key === 'turnoverDays') return value ?? '暂无销量'
  return value
}
