const merchantFields = {
  application: ['subjectType', 'subjectName', 'legalRepresentative', 'licenseNo', 'contactPhone', 'settlementBank', 'settlementAccountRef', 'attachmentIds', 'applicationRef'],
  authorization: ['appId', 'merchantNo', 'authorizationRef'],
  certificate: ['serialNo', 'expiresAt', 'certificateRef', 'contractedFeeBps', 'settlementDays']
}

export function merchantPayload(mode, shopId, form) {
  if (!merchantFields[mode]) throw new Error('未知商户资料阶段')
  return Object.fromEntries([['shopId', shopId], ...merchantFields[mode].map(key => [key, form[key]])])
}

export function certificateError(form) {
  const date = String(form.expiresAt || '')
  const parts = date.split('-').map(Number)
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && parts.length === 3 && parts.every(Number.isInteger) && (() => { const value = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])); return value.getUTCFullYear() === parts[0] && value.getUTCMonth() === parts[1] - 1 && value.getUTCDate() === parts[2] })()
  if (!/^[A-Za-z0-9]{8,100}$/.test(form.serialNo || '') || !validDate) return '请填写有效证书序列号和到期日期'
  if (!Number.isInteger(form.contractedFeeBps) || form.contractedFeeBps < 0 || form.contractedFeeBps > 10000) return '请填写渠道实际签约费率'
  if (!Number.isInteger(form.settlementDays) || form.settlementDays < 0 || form.settlementDays > 365) return '请填写渠道实际结算周期'
  return ''
}

export function applicationError(form) {
  if (!['ENTERPRISE', 'INDIVIDUAL'].includes(form.subjectType)) return '请选择有效商户主体类型'
  if ((form.subjectName?.trim().length || 0) < 2 || (form.legalRepresentative?.trim().length || 0) < 2) return '请填写商户主体及法定代表人'
  if (!/^[0-9A-Z]{18}$/.test(form.licenseNo || '')) return '统一社会信用代码须为 18 位大写字母或数字'
  if (!/^1[3-9][0-9]{9}$/.test(form.contactPhone || '')) return '请填写有效联系人手机号'
  if (!Array.isArray(form.attachmentIds) || form.attachmentIds.length < 1 || form.attachmentIds.length > 12) return '请上传至少 1 张主体证明图片'
  return ''
}

export function authorizationError(form) {
  if (!/^wx[0-9a-fA-F]{16}$/.test(form.appId || '')) return '请填写有效小程序 AppID'
  if (!/^[0-9]{8,20}$/.test(form.merchantNo || '')) return '请填写有效收款商户号'
  return ''
}

export function eligibleCustomerRefund(refund) {
  return !['PENDING', 'REJECTED', 'CLOSED'].includes(refund.status)
}

export function printableAddress(address) {
  if (address == null) return ''
  if (typeof address === 'string') {
    const value = address.trim()
    if (!value.startsWith('{')) return value.slice(0, 500)
    try { address = JSON.parse(value) } catch { return '地址资料格式异常，请核对原订单' }
  }
  if (typeof address !== 'object' || Array.isArray(address)) return ''
  const region = address.region || [address.province, address.city, address.district].filter(Boolean).join(' ')
  return [region, address.detail].filter(Boolean).join(' ')
}

export function printableRecipient(address) {
  if (typeof address === 'string') {
    try { address = JSON.parse(address) } catch { return '' }
  }
  if (!address || typeof address !== 'object' || Array.isArray(address)) return ''
  return [address.name, address.phone].filter(Boolean).join(' · ')
}
