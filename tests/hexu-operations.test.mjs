import test from 'node:test'
import assert from 'node:assert/strict'
import { adminPaths, pickOrderPath, trackingPath } from '../src/api/hexu/contracts.js'
import { applicationError, authorizationError, certificateError, eligibleCustomerRefund, merchantPayload, printableAddress, printableRecipient } from '../src/views/hexu/compliance/model.js'
import { bankPayoutError, bankPayoutPayload, channelSubmissionFeedback, runConfirmedChannelAction } from '../src/views/hexu/finance/model.js'

test('管理端专用接口路径按订单编号安全编码', () => {
  assert.equal(adminPaths.merchantSubmit, '/merchant/submit')
  assert.equal(adminPaths.merchantReference, '/merchant/reference')
  assert.equal(adminPaths.policyConsents, '/policies/consents')
  assert.equal(adminPaths.aftersaleLinks, '/aftersale-links')
  assert.equal(adminPaths.aftersaleCandidates, '/aftersale-links/candidates')
  assert.equal(adminPaths.trackingConfiguration, '/tracking/configuration')
  assert.equal(pickOrderPath('ORD/1', 'print'), '/fulfillment/pick/ORD%2F1/print')
  assert.equal(trackingPath('ORD/1'), '/orders/ORD%2F1/tracking')
})

test('商户三个阶段请求只提交契约字段，并保留实际费率 0', () => {
  const application = merchantPayload('application', 2, {
    subjectType: 'ENTERPRISE', subjectName: '某商贸公司', legalRepresentative: '张某', licenseNo: 'ABC', contactPhone: '13800000000',
    settlementBank: '某银行', settlementAccountRef: 'DOC1', attachmentIds: ['FILE1'], applicationRef: 'WX1', ignored: '不要提交'
  })
  assert.deepEqual(Object.keys(application), ['shopId', 'subjectType', 'subjectName', 'legalRepresentative', 'licenseNo', 'contactPhone', 'settlementBank', 'settlementAccountRef', 'attachmentIds', 'applicationRef'])
  assert.equal(application.ignored, undefined)
  const certificate = merchantPayload('certificate', 2, { serialNo: 'SER1', expiresAt: '2027-01-01', certificateRef: 'REF1', contractedFeeBps: 0, settlementDays: 1 })
  assert.equal(certificate.contractedFeeBps, 0)
  assert.equal(certificate.settlementDays, 1)
})

test('证书资料缺少实际渠道费率或结算周期时不可提交', () => {
  const valid = { serialNo: 'SERIAL01', expiresAt: '2099-01-01', certificateRef: 'REF1', contractedFeeBps: 20, settlementDays: 1 }
  assert.equal(certificateError(valid), '')
  assert.match(certificateError({ ...valid, contractedFeeBps: null }), /费率/)
  assert.match(certificateError({ ...valid, settlementDays: null }), /结算周期/)
  assert.match(certificateError({ ...valid, expiresAt: 'bad' }), /到期日期/)
  assert.match(certificateError({ ...valid, expiresAt: '2026-02-31' }), /到期日期/)
})

test('进件与授权资料拒绝掩码值和无效渠道编号', () => {
  const application = { subjectType: 'ENTERPRISE', subjectName: '某商贸公司', legalRepresentative: '张三', licenseNo: '91330100MA12345678', contactPhone: '13800000000', attachmentIds: ['FILE1'], applicationRef: 'CHANNEL1' }
  assert.equal(applicationError(application), '')
  assert.match(applicationError({ ...application, licenseNo: '**************5678' }), /信用代码/)
  assert.match(applicationError({ ...application, contactPhone: '*******0000' }), /手机号/)
  assert.match(applicationError({ ...application, attachmentIds: [] }), /图片/)
  assert.equal(applicationError({ ...application, applicationRef: '' }), '')
  const authorization = { appId: 'wx1234567890abcdef', merchantNo: '12345678', authorizationRef: 'AUTH1' }
  assert.equal(authorizationError(authorization), '')
  assert.equal(authorizationError({ ...authorization, authorizationRef: '' }), '')
  assert.match(authorizationError({ ...authorization, merchantNo: '1234' }), /商户号/)
})

test('直发售后仅展示已受理客户售后，拣货单正确拼接地址', () => {
  assert.equal(eligibleCustomerRefund({ status: 'PENDING' }), false)
  assert.equal(eligibleCustomerRefund({ status: 'APPROVED' }), true)
  assert.equal(printableAddress({ region: '浙江省杭州市', detail: '西湖区 1 号' }), '浙江省杭州市 西湖区 1 号')
  assert.equal(printableAddress({ province: '浙江省', city: '杭州市', district: '西湖区', detail: '1 号' }), '浙江省 杭州市 西湖区 1 号')
  assert.equal(printableAddress('北京市朝阳区'), '北京市朝阳区')
  assert.equal(printableAddress('{"name":"李四","phone":"13800000000","region":"浙江省杭州市","detail":"西湖区 1 号"}'), '浙江省杭州市 西湖区 1 号')
  assert.equal(printableRecipient('{"name":"李四","phone":"13800000000","region":"浙江省杭州市"}'), '李四 · 13800000000')
  assert.match(printableAddress('{broken'), /格式异常/)
})

test('银行卡线下打款表单只提交外部流水、备注和凭证编号', () => {
  const payload = bankPayoutPayload(2, { id: 'TX-1' }, {
    success: true,
    bankReference: 'BANK/2026-001',
    reason: '已核对银行回单',
    uploads: ['FILE-1'],
    ignored: '不得提交'
  })
  assert.deepEqual(payload, { shopId: 2, id: 'TX-1', success: true, bankReference: 'BANK/2026-001', reason: '已核对银行回单', evidenceIds: ['FILE-1'] })
  assert.equal(bankPayoutError(payload), '')
  assert.match(bankPayoutError({ ...payload, bankReference: '***' }), /流水号/)
  assert.match(bankPayoutError({ ...payload, evidenceIds: [] }), /凭证/)
})

test('只有明确成功的沙盒回执才显示本地模拟完成，正式渠道仍提示待回执', () => {
  const pending = '已提交渠道，请等待回执确认'
  assert.deepEqual(channelSubmissionFeedback({ data: { sandbox: true, status: 'SUCCESS', channelRef: 'SANDBOX-REFUND' } }, 'SUCCESS', pending),
    { type: 'success', message: '本地模拟完成 · SANDBOX-REFUND' })
  assert.deepEqual(channelSubmissionFeedback({ data: { sandbox: true, status: 'PAID', channelRef: 'SANDBOX-PAYOUT' } }, 'PAID', pending),
    { type: 'success', message: '本地模拟完成 · SANDBOX-PAYOUT' })
  assert.deepEqual(channelSubmissionFeedback({ data: { sandbox: true, status: 'APPROVED' } }, 'PAID', pending),
    { type: 'warning', message: '本地模拟已返回，请刷新核对状态' })
  assert.deepEqual(channelSubmissionFeedback({ data: { status: 'PAID' } }, 'PAID', pending),
    { type: 'success', message: pending })
})

test('渠道确认弹窗和请求全程只允许一次操作，取消后释放提交锁', async () => {
  const busy = { value: false }
  let resolveConfirm
  const confirmation = new Promise(resolve => { resolveConfirm = resolve })
  let confirms = 0, submits = 0, successes = 0, failures = 0
  const action = {
    busy,
    confirm: () => { confirms++; return confirmation },
    submit: async () => { submits++; return { data: { sandbox: true, status: 'PAID' } } },
    success: async () => { successes++ },
    failure: () => { failures++ }
  }
  const first = runConfirmedChannelAction(action)
  assert.equal(busy.value, true)
  assert.equal(await runConfirmedChannelAction(action), false)
  assert.equal(confirms, 1)
  assert.equal(submits, 0)
  resolveConfirm()
  assert.equal(await first, true)
  assert.deepEqual([confirms, submits, successes, failures, busy.value], [1, 1, 1, 0, false])
  const cancelled = await runConfirmedChannelAction({ ...action, confirm: () => { throw new Error('cancelled') } })
  assert.equal(cancelled, false)
  assert.equal(busy.value, false)
  assert.equal(submits, 1)
})
