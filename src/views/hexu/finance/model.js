/** Pure helpers shared by the manual bank-remittance form and its tests. */
export function bankPayoutPayload(shopId, row, form) {
  return {
    shopId,
    id: row?.id,
    success: form?.success === true,
    bankReference: String(form?.bankReference || '').trim(),
    reason: String(form?.reason || '').trim(),
    evidenceIds: Array.isArray(form?.evidenceIds || form?.uploads)
      ? [...(form.evidenceIds || form.uploads)]
      : []
  }
}

export function bankPayoutError(payload) {
  if (!payload?.id) return '提现编号缺失'
  if (!payload?.shopId) return '商城编号缺失'
  if (!/^[A-Za-z0-9_./:-]{4,100}$/.test(payload.bankReference || '')) return '请填写有效的银行外部流水号'
  if (!payload.reason || payload.reason.length < 2 || payload.reason.length > 500) return payload.success ? '请记录打款备注' : '请填写银行失败原因'
  if (!Array.isArray(payload.evidenceIds) || payload.evidenceIds.length < 1 || payload.evidenceIds.length > 9) return '请上传1至9份银行回单或失败凭证'
  return ''
}

export function channelSubmissionFeedback(response, completedStatus, pendingMessage) {
  const channel = response?.data
  if (channel?.sandbox !== true) return { type: 'success', message: pendingMessage }
  if (channel.status !== completedStatus) return { type: 'warning', message: '本地模拟已返回，请刷新核对状态' }
  const reference = String(channel.channelRef || '').trim()
  return { type: 'success', message: '本地模拟完成' + (reference ? ' · ' + reference : '') }
}

export async function runConfirmedChannelAction({ busy, confirm, submit, success, failure }) {
  if (busy.value) return false
  busy.value = true
  try {
    try { await confirm() } catch { return false }
    try {
      await success(await submit())
      return true
    } catch (error) {
      failure(error)
      return false
    }
  } finally {
    busy.value = false
  }
}
