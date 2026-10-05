export const platformPointPaths = Object.freeze([
  'documents/points_rule', 'documents/points_risk', 'resources/points',
  'resources/pointBatches', 'resources/pointLedger', 'resources/pointTransfers',
  'resources/pointRiskCases'
])

export function workspaceQueryState(query, shops, { module = '', tab = '' } = {}) {
  const requested = query.shopId === '0' || query.shopId === 0 ? 0 : Number(query.shopId) || 2
  const shopId = requested === 0 && platformPointPaths.includes(tab) ? 0
    : shops.some(shop => shop.id === requested) ? requested : shops[0]?.id
  return { shopId, search: module === 'refunds' ? String(query.refundId || '') : null }
}

export const supportsReviewSupplement = tab => ['documents/review', 'documents/review_append'].includes(tab)

export function workspaceReviewPayload(form, tab) {
  if (!supportsReviewSupplement(tab)) return { ...form, decision: form.approve ? 'APPROVED' : 'REJECTED' }
  const { approve, ...payload } = form
  return { ...payload, decision: form.decision }
}

export const cloneProductForm = row => ({
  ...row,
  brand: row.brand ?? '',
  gallery: [...(Array.isArray(row.gallery) ? row.gallery : [])],
  expectedAvailable: row.available
})

export const emptyProductForm = () => ({
  id: '', name: '', brand: '', spec: '', product_group: '', category: '', description: '',
  freight_id: '', weight_grams: 1000, allow_loose: true, gallery: [], asset: '',
  retail_min: 0, retail_max: 0, retail: 0, cloud_price: 0, center_price: 0,
  owner_price: 0, box_size: 1, min_boxes: 1, min_qty: 1, point_price: 0
})

export function normalizeDecorationForm(body = {}) {
  const result = { ...body, customerPhone: body.customerPhone ?? body.servicePhone ?? '' }
  delete result.servicePhone
  return result
}

export const profileAvatarUrl = (avatarId, base = '') =>
  /^FILE[0-9a-f]{32}$/.test(String(avatarId || ''))
    ? `${base.replace(/\/$/, '')}/hexu/app/attachments/avatar/${encodeURIComponent(avatarId)}`
    : ''

export const profileRows = data => {
  const member = data?.member || {}, profile = data?.profile || {}
  return [
    ['会员编号', member.id], ['昵称', profile.name || member.name],
    ['手机号', member.phone || '未授权'], ['性别', profile.gender],
    ['生日', profile.birthday], ['所在地区', regionText(profile.region)], ['个性签名', profile.signature]
  ].map(([label, value]) => ({ label, value: value == null || value === '' ? '未填写' : value }))
}

export const regionText = value => Array.isArray(value)
  ? value.filter(part => typeof part === 'string' && part.trim()).map(part => part.trim()).join(' ')
  : value

export function productPreviewAsset(value) {
  const asset = typeof value === 'string' ? value.trim() : ''
  const orderCover = asset.match(/^\/hexu\/app\/attachments\/order-cover\/((?:HX|DH)[0-9a-f]{32})\/(\d+)$/)
  if (orderCover) return { type: 'orderCover', orderId: orderCover[1], lineId: orderCover[2] }
  const file = asset.match(/^(?:\/hexu\/app\/attachments\/product\/)?(FILE[0-9a-f]{32})$/i)
  if (file) return { type: 'attachment', id: file[1] }
  const ui = asset.match(/^(?:\/hexu\/app\/ui-assets\/)?([A-Za-z0-9_-]+)$/)
  return ui ? { type: 'ui', id: ui[1] } : null
}

const businessClock = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
})

export function businessDateTime(key, value) {
  if (!/(?:_at|_time|^at$|^next_attempt$)$/.test(key) || typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return value
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  const parts = Object.fromEntries(businessClock.formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

const commonDetailLabels = Object.freeze({
  database: '备份数据库', encrypted: '已加密', scheduled: '自动备份已启用',
  id: '编号', name: '名称', title: '名称', phone: '手机号（脱敏）', member_id: '会员编号', shop_id: '所属商城',
  agent_id: '代理编号', parent_id: '直接上级代理', rank_no: '职级', status: '状态', created_at: '创建时间',
  updated_at: '更新时间', approved_at: '审核通过时间', bound_at: '绑定时间', customer_count: '归属客户数',
  child_count: '直接下级代理数', order_count: '订单数', inviter_agent_id: '邀请代理编号', region: '所在地区',
  avatarId: '头像编号', gender: '性别', birthday: '生日', signature: '个性签名',
  snapshot_json: '下单快照', body_json: '业务资料', body: '资料明细', items: '商品明细',
  before_json: '变更前', after_json: '变更后', evidence_json: '售后凭证', payout_evidence_json: '打款凭证',
  gallery: '商品图库', reviewed_at: '审核时间', reviewed_by: '审核人', reviewer: '复核人',
  review_note: '审核意见', effective_at: '生效时间', requested_by: '申请人', amount: '金额',
  qty: '数量', sku_id: '商品编号', order_id: '订单编号', order_type: '订单类型', points_return: '退回积分', line_id: '订单明细编号', tracking: '物流单号',
  carrier: '承运商', address_json: '收货地址', account_ref: '结算账户编号', recipient_agent_id: '受益代理编号',
  buyer_id: '客户编号', user_id: '后台账号编号', user_name: '登录账号', nick_name: '昵称', role_code: '商城岗位',
  warning_qty: '库存预警数量', mix_group: '混批组编码', mix_units: '单件箱容积分', allow_loose: '允许零散销售', standard: '标准商品',
  destination_shop_id: '目标商城编号', cross_authorization_id: '跨店采购授权编号', subtotal: '商品金额', discount: '优惠金额',
  freight: '运费', points_used: '已抵扣积分', points_scope: '积分归属', points_earned: '赠送平台积分',
  shop_points_earned: '赠送商城积分', rule_id: '分红版本编号', shipping_json: '发货资料', expires_at: '截止时间', paid_at: '支付时间',
  completed_at: '完成时间', remark: '订单备注', buyerName: '客户昵称', ruleEffectiveAt: '分红版本生效日', customerAgentName: '客户归属代理', restock_qty: '可回库数量',
  review_by: '审核人', return_json: '退货资料', exchange_json: '换货资料', campaign_ref: '活动编号', kind: '记录类型',
  actor_id: '操作人编号', before: '变更前', after: '变更后', detail: '说明明细', fee: '手续费', net: '到账金额',
  merchant_no: '收款商户号', channel_ref: '渠道流水号', channel: '渠道', frozen_amount: '冻结收益',
  reversed: '已冲正金额', earning_type: '收益类型', available: '可用数量', locked: '锁定数量', defective: '残次数量',
  in_transit: '采购在途数量', reference_id: '关联单据', category: '类别', origin_ref: '来源单据', origin_kind: '获得来源',
  remaining: '剩余积分', expired: '过期积分', reclaimed_expired: '已追回过期积分', pending_reclaim: '待追回积分',
  expiring: '30天内到期积分', frozen: '已冻结', batches_initialized: '积分批次已初始化', sender_id: '转出会员编号',
  recipient_id: '接收会员编号', sender_name: '转出会员', recipient_name: '接收会员', credit: '到账积分', reviewer_id: '复核人编号',
  business_id: '业务单号', event_type: '渠道事件', payload_json: '渠道回执资料', error_message: '处理异常', processed_at: '处理时间',
  payout_operator: '打款登记人', payout_reason: '打款备注', payout_recorded_at: '打款登记时间', provider_out_bill_no: '渠道商家单号',
  provider_bill_no: '渠道业务单号', provider_state: '渠道状态', provider_package: '渠道确认资料', provider_updated_at: '渠道更新时间',
  campaign_id: '活动编号', subject_agent_id: '购买代理编号', reward_type: '奖励类型', origin_parent_id: '原直接推荐代理',
  marketing_parent_id: '营销上级代理', role: '营销身份', joined_at: '参与时间', created_by: '创建人',
  leader_id: '团长会员编号', target_size: '成团人数', price: '团价', formed_at: '成团时间', refunds: '退款明细',
  wallet: '账户余额（原始金额单位分）', expected_amount: '业务金额', channel_amount: '账单金额', difference: '账本差额',
  requested_at: '申请时间', review_reason: '复核意见', operation: '业务类型', status_before: '原状态', status_after: '新状态',
  received_qty: '实际收到数量', good_qty: '验收合格数量', assessment: '考核结果', chain: '代理关系链', customers: '归属客户数'
})

const monetaryFields = Object.freeze({
  products: ['retail', 'cloud_price', 'center_price', 'owner_price', 'retail_min', 'retail_max'],
  orders: ['subtotal', 'discount', 'freight', 'total', 'refunded'], refunds: ['amount'],
  'resources/withdrawals': ['amount', 'fee', 'net'], 'resources/earnings': ['amount', 'reversed', 'frozen_amount'],
  'resources/ledger': ['amount'], 'resources/reconciliationLines': ['expected_amount', 'channel_amount', 'difference'],
  'resources/reconciliationAdjustments': ['amount', 'snapshot_expected_amount', 'snapshot_channel_amount', 'snapshot_difference'], 'resources/groups': ['price'],
  'resources/groupRefunds': ['amount'], 'resources/linkRewards': ['amount']
})

export const detailFieldIsMoney = (key, { module = '', tab = '' } = {}) =>
  (['products', 'orders', 'refunds'].includes(module) ? monetaryFields[module] : monetaryFields[tab] || []).includes(key)

export const workspaceListRow = (row, path) => path.startsWith('documents/')
  ? { ...row, title: row.body?.name || row.body?.title || row.kind }
  : path === 'resources/refunds'
    ? { ...row, refund_display: row.order_type === 'POINTS' ? `${row.points_return}积分` : '¥' + (Number(row.amount) / 100).toFixed(2) }
    : { ...row }

export function workspaceListCell(key, value, labels = {}) {
  if (value == null) return '—'
  if (key === 'merchant_no' && value === 'POINTS') return '不涉及收款'
  return Object.hasOwn(labels, value) ? labels[value] : businessDateTime(key, value)
}

export const earningFullyReversed = row =>
  row?.earning_type != null && row.status === 'AVAILABLE' &&
  Number(row.amount) !== 0 && Number(row.reversed) === Number(row.amount)

export const workspaceStatusCell = (row, module, labels = {}) =>
  module === 'finance' && earningFullyReversed(row)
    ? '已全额冲正'
    : module === 'refunds' && row.refund_type === 'EXCHANGE' && row.status === 'CLOSED'
      ? '换货已完成'
      : labels[row.status] || row.status

export const workspaceRankCell = value => ({ 1: '云代理', 2: '分货中心', 3: '总代理' })[value] || ''

export const formatCurrency = cents => {
  const amount = Number(cents)
  return (amount < 0 ? '-' : '') + '¥' + (Math.abs(amount) / 100).toFixed(2)
}

export function workspaceExportCell(column, row, { module = '', labels = {}, money } = {}) {
  const [key, , kind] = column, value = row[key]
  if (key === 'status') return workspaceStatusCell(row, module, labels)
  if (kind === 'money') return value == null ? '—' : money(value)
  if (key === 'rank_no') return workspaceRankCell(value)
  return workspaceListCell(key, value, labels)
}

const memberDetailLabels = Object.freeze({
  'resources/customers': { member_id: '客户会员编号', agent_id: '归属代理编号', name: '客户昵称', title: '客户昵称' },
  'resources/agents': { id: '代理编号', name: '代理昵称', title: '代理昵称', member_id: '会员编号' }
})

const supportDetailContext = context => context.module === 'applications' && context.tab === 'documents/support'
const supportDetailLabels = Object.freeze({ question: '问题类型', message: '留言内容', orderId: '关联订单' })

export function workspaceDetailRecord(record = {}, context = {}) {
  if (context.module === 'finance' && context.tab === 'resources/reconciliationAdjustments') {
    const evidence = record.evidence_json
    if (evidence && typeof evidence === 'object' && !Array.isArray(evidence)) {
      if (Object.keys(evidence).some(key => !['uploads', 'line'].includes(key))) return record
      const line = evidence.line && typeof evidence.line === 'object' && !Array.isArray(evidence.line) ? evidence.line : null
      if (evidence.uploads != null && !Array.isArray(evidence.uploads) || evidence.line != null && !line) return record
      const summary = { finance_proof_count: Array.isArray(evidence.uploads) ? evidence.uploads.length : 0 }
      if (line) {
        if ('expected_amount' in line) summary.snapshot_expected_amount = line.expected_amount
        if ('channel_amount' in line) summary.snapshot_channel_amount = line.channel_amount
        if ('difference' in line) summary.snapshot_difference = line.difference
        if (line.note) summary.snapshot_note = line.note
      }
      const detail = {}
      for (const [key, value] of Object.entries(record)) {
        if (key === 'evidence_json') Object.assign(detail, summary)
        else detail[key] = value
      }
      return detail
    }
  }
  if (context.module === 'refunds') {
    const { refund_display, ...detail } = record
    const evidence = record.evidence_json
    const inspection = evidence?.inspection
    if (evidence && typeof evidence === 'object' && !Array.isArray(evidence) &&
        Object.keys(evidence).every(key => ['description', 'uploads', 'inspection'].includes(key)) &&
        (!inspection || typeof inspection === 'object' && !Array.isArray(inspection) &&
          Object.keys(inspection).every(key => ['receivedQty', 'goodQty', 'note', 'uploads', 'inspector'].includes(key)))) {
      delete detail.evidence_json
      detail.problem_description = typeof evidence.description === 'string' ? evidence.description : ''
      detail.evidence_upload_count = Array.isArray(evidence.uploads) ? evidence.uploads.length : 0
      if (inspection) {
        detail.inspection_received_qty = inspection.receivedQty
        detail.inspection_good_qty = inspection.goodQty
        detail.inspection_note = inspection.note
        detail.inspection_upload_count = Array.isArray(inspection.uploads) ? inspection.uploads.length : 0
        detail.inspection_operator = inspection.inspector
      }
    }
    const returned = record.return_json
    if (returned && typeof returned === 'object' && !Array.isArray(returned) &&
        Object.keys(returned).every(key => ['carrier', 'tracking', 'uploads'].includes(key))) {
      delete detail.return_json
      detail.return_carrier = returned.carrier
      detail.return_tracking = returned.tracking
      detail.return_upload_count = Array.isArray(returned.uploads) ? returned.uploads.length : 0
    }
    if (record.order_type === 'POINTS') delete detail.amount
    return detail
  }
  if (!supportDetailContext(context) || record.kind !== 'support') return record
  const body = record.body && typeof record.body === 'object' && !Array.isArray(record.body) ? record.body : {}
  const text = value => typeof value === 'string' || typeof value === 'number' ? value : ''
  return {
    ...Object.fromEntries(['id', 'shop_id', 'member_id', 'status', 'reviewer', 'review_note', 'created_at', 'updated_at'].filter(key => Object.hasOwn(record, key)).map(key => [key, record[key]])),
    question: text(body.question), message: text(body.message), orderId: text(body.orderId ?? body['关联订单'])
  }
}

export function detailFieldLabel(key, { module = '', tab = '', columns = [], productFields = [], settingFields = [], record = {} } = {}) {
  if (module === 'finance' && tab === 'resources/reconciliationAdjustments') {
    const labels = {
      line_id: '对账明细编号', evidence_json: '财务凭证资料', finance_proof_count: '财务凭证（张）',
      snapshot_expected_amount: '申请时业务金额', snapshot_channel_amount: '申请时账单金额',
      snapshot_difference: '申请时账本差额', snapshot_note: '申请时核对说明'
    }
    if (labels[key]) return labels[key]
  }
  if (module === 'refunds' && key === 'points_return') return '退回积分'
  if (module === 'refunds' && key === 'amount' && record.refund_type === 'EXCHANGE') return '换货商品价值'
  if (module === 'refunds' && key === 'problem_description') return '问题描述'
  if (module === 'refunds' && key === 'evidence_upload_count') return '凭证图片数量'
  if (module === 'refunds' && key === 'return_carrier') return '退货快递公司'
  if (module === 'refunds' && key === 'return_tracking') return '退货运单号'
  if (module === 'refunds' && key === 'return_upload_count') return '退货凭证图片数量'
  if (module === 'refunds' && key === 'inspection_received_qty') return '实际收到数量'
  if (module === 'refunds' && key === 'inspection_good_qty') return '验收合格数量'
  if (module === 'refunds' && key === 'inspection_note') return '验收备注'
  if (module === 'refunds' && key === 'inspection_upload_count') return '验收凭证图片数量'
  if (module === 'refunds' && key === 'inspection_operator') return '验收人编号'
  if (supportDetailContext({ module, tab }) && supportDetailLabels[key]) return supportDetailLabels[key]
  const memberLabel = module === 'agents' && memberDetailLabels[tab]?.[key]
  if (memberLabel) return memberLabel
  const fields = [...columns, ...(module === 'products' ? productFields : []), ...(tab.startsWith('documents/') ? settingFields : [])]
  const label = fields.find(field => field[0] === key)?.[1] || commonDetailLabels[key] || key
  return detailFieldIsMoney(key, { module, tab }) ? label.replace('（分', '（元') : label
}

export function detailFieldValue(key, value, labels = {}, context = {}) {
  if (supportDetailContext(context) && key === 'orderId' && (value == null || typeof value === 'string' && !value.trim())) return '未关联'
  if (key === 'merchant_no' && value === 'POINTS') return '不涉及收款'
  if (key === 'points_scope' && value != null && value !== '') return Number(value) === 0 ? '平台积分' : '商城积分（商城编号 ' + value + '）'
  if (key === 'region') value = regionText(value)
  if (value == null || value === '' || Array.isArray(value) && value.length === 0) return '—'
  value = businessDateTime(key, value)
  if (detailFieldIsMoney(key, context) && ['number', 'string'].includes(typeof value) && Number.isFinite(Number(value))) return formatCurrency(value)
  if (key === 'rank_no') return ({ 1: '云代理', 2: '分货中心', 3: '总代理' })[value] || value
  if (typeof value === 'boolean') return value ? '是' : '否'
  const enumField = /^(status|role|role_code|actor_kind|type|kind|category|order_type|refund_type|channel|source|origin_kind|earning_type|reward_type|event_type|operation)$/.test(key)
  return enumField && Object.hasOwn(labels, value) ? labels[value] : value
}

export function selectedAttachmentIds(record = {}) {
  const body = record.body || {}, evidence = record.evidence_json || {}, returned = record.return_json || {}
  const candidates = [
    ...(Array.isArray(record.gallery) ? record.gallery : []),
    ...(Array.isArray(body.uploads) ? body.uploads : []),
    ...(Array.isArray(evidence.uploads) ? evidence.uploads : []),
    ...(Array.isArray(evidence.inspection?.uploads) ? evidence.inspection.uploads : []),
    ...(Array.isArray(returned.uploads) ? returned.uploads : []),
    ...(Array.isArray(record.payout_evidence_json?.files) ? record.payout_evidence_json.files : []),
    body.confirmationFile, body.asset,
    ...Object.values(body.assets && typeof body.assets === 'object' ? body.assets : {}),
    ...(Array.isArray(body.banners) ? body.banners.map(banner => banner.image) : [])
  ]
  return [...new Set(candidates.filter(id => typeof id === 'string' && /^FILE[A-Za-z0-9_-]{1,64}$/.test(id)))]
}

export function settingJsonError(field, value) {
  if (['assets', 'screens'].includes(field)) return value && typeof value === 'object' && !Array.isArray(value) ? '' : '必须填写 JSON 对象'
  return Array.isArray(value) ? '' : '必须填写 JSON 数组'
}

export function imageUploadError(file) {
  if (!file || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > 5 * 1024 * 1024) return '图片大小须在5MB以内且不能是空文件'
  if (file.type && !['image/png', 'image/jpeg'].includes(file.type)) return '仅支持PNG或JPEG图片'
  return ''
}

export const csvCell = value => '"' + String(value ?? '').replaceAll('"', '""').replace(/^(\s*)([=+@-])/, "'$1$2") + '"'

export function decorationUploadError(form) {
  try {
    const assets = JSON.parse(form.assets || '{}'), banners = JSON.parse(form.banners || '[]')
    if (settingJsonError('assets', assets) || settingJsonError('banners', banners)) return '上传图片前请将全局图片资源填写为JSON对象、轮播配置填写为JSON数组'
  } catch { return '上传图片前请先修正图片资源和轮播配置JSON' }
  return ''
}

export function removeDecorationAttachment(form, id) {
  const result = { ...form }
  if (result.asset === id) result.asset = ''
  try {
    const assets = JSON.parse(form.assets || '{}')
    if (assets && typeof assets === 'object' && !Array.isArray(assets)) result.assets = JSON.stringify(Object.fromEntries(Object.entries(assets).filter(([, value]) => value !== id)), null, 2)
  } catch { /* Keep invalid user input intact for the form validation. */ }
  try {
    const banners = JSON.parse(form.banners || '[]')
    if (Array.isArray(banners)) result.banners = JSON.stringify(banners.map(banner => banner?.image === id ? { ...banner, image: '' } : banner), null, 2)
  } catch { /* Keep invalid user input intact for the form validation. */ }
  return result
}

export function workspaceActionError(mode, form, { tab = '', selected = {}, shopId, now = Date.now() } = {}) {
  const integer = (value, min, max) => value !== null && value !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max
  if (['ship', 'exchange'].includes(mode)) {
    const carrier = form.carrier
    if (typeof carrier !== 'string' || !carrier.trim() || Array.from(carrier.trim()).length > 60 || /[\u0000-\u001f\u007f-\u009f]/.test(carrier)) return '请填写有效快递公司'
    if (typeof form.tracking !== 'string' || !/^[A-Za-z0-9]{8,40}$/.test(form.tracking)) return '请填写8至40位字母或数字运单号，不得包含空格'
  }
  if (mode === 'review') {
    if (form.reason !== undefined && typeof form.reason !== 'string') return '审核意见必须为文本'
    const reason = form.reason ?? ''
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(reason)) return '审核意见不能包含非法控制字符'
    if (Array.from(reason.trim()).length > 500) return '审核意见最多500个Unicode字符'
  }
  const note = String(form.reason || '').trim()
  if (mode === 'review' && supportsReviewSupplement(tab)) {
    if (!['APPROVED', 'REJECTED', 'SUPPLEMENT'].includes(form.decision)) return '请选择有效审核结果'
    if (form.decision !== 'APPROVED' && !note) return form.decision === 'SUPPLEMENT' ? '待补充资料必须填写原因' : '驳回必须填写原因'
  }
  if (mode === 'adjustment' && (note.length < 2 || note.length > 500)) return '请填写2至500字的账务调整原因'
  if (mode === 'adjustment' && (!Array.isArray(form.uploads) || form.uploads.length < 1 || form.uploads.length > 9)) return '请上传1至9张财务凭证'
  if (mode === 'review' && tab === 'resources/reconciliationAdjustments' && note.length < 2) return '请填写至少2字的账务调整复核意见'
  if (mode === 'review' && tab === 'resources/withdrawals' && !form.approve && note.length < 2) return '提现驳回须填写至少2字的原因'
  if (mode === 'review' && tab === 'documents/support' && form.approve && note.length < 2) return '请填写客服回复内容'
  if (mode === 'review' && ['documents/link_relation', 'documents/stocktake'].includes(tab) && form.approve && note.length < 2) return '请填写至少2字的审核依据'
  if (mode === 'inspect') {
    const qty = Number(selected.qty)
    if (!integer(form.receivedQty, 0, 2147483647) || Number(form.receivedQty) !== qty) return '实际收到数量须与申请一致，数量不符请先处理退货差异'
    if (!integer(form.goodQty, 0, qty)) return '验收合格数量须在实际收到数量范围内'
    if (String(form.note || '').length > 500) return '验收备注最多500字'
  }
  if (mode === 'migration' && (!integer(form.rootAgentId, 1, Number.MAX_SAFE_INTEGER) || !integer(form.targetShopId, 1, Number.MAX_SAFE_INTEGER) || Number(form.targetShopId) === Number(shopId))) return '请选择有效团队根代理和其他目标商城'
  if (mode === 'rule') {
    if (['cloud_bps', 'center_bps', 'owner_bps'].some(key => !integer(form[key], 0, 10000))) return '分红比例须为0至10000的整数基点'
    const effective = new Date(String(form.effectiveAt || '').replace(' ', 'T')).getTime()
    if (!Number.isFinite(effective) || effective < now - 60000) return '请选择有效分红生效时间，不能追溯生效'
  }
  if (mode === 'product') {
    if (!String(form.asset || '').trim()) return '请先上传商品主图'
    if (typeof form.name !== 'string' || !form.name.trim() || (form.spec != null && typeof form.spec !== 'string') || /[\u0000-\u001F\u007F-\u009F]/.test(form.name) || /[\u0000-\u001F\u007F-\u009F]/.test(form.spec || '')) return '商品名称和规格须为不含控制字符的单行文本'
    if (String(form.name || '').length > 160 || String(form.spec || '').length > 160 || String(form.asset || '').length > 100) return '商品名称、规格或封面编号过长'
    if ((form.brand != null && typeof form.brand !== 'string') || String(form.brand || '').length > 80 || /[\u0000-\u001F\u007F-\u009F]/.test(String(form.brand || ''))) return '品牌最多80字且不能包含控制字符'
    if (!integer(form.weight_grams, 1, 1000000)) return '单件重量须为1至1000000克'
    if (['box_size', 'min_boxes', 'min_qty'].some(key => !integer(form[key], 1, 100000))) return '箱规和起订量须为1至100000的整数'
    if (!integer(form.retail, 1, 100000000)) return '零售价须为1至100000000的整数分'
    if (!integer(form.retail_min, 0, Number.MAX_SAFE_INTEGER) || !integer(form.retail_max, 0, Number.MAX_SAFE_INTEGER) || Number(form.retail_max) !== 0 && Number(form.retail_max) < Number(form.retail_min)) return '最低和最高允许零售价范围无效'
    if (String(form.category || '').length > 80 || !/^[A-Za-z0-9_-]{0,64}$/.test(String(form.product_group || '')) || String(form.description || '').length > 10000) return '分类、商品组编号或商品描述格式无效'
  }
  if (mode === 'box') {
    if (['box_size', 'min_boxes', 'min_qty', 'mix_units'].some(key => !integer(form[key], 1, 100000))) return '箱规、起订量和箱容积分须为1至100000的整数'
    if (!/^[A-Za-z0-9_-]{0,64}$/.test(String(form.mix_group || ''))) return '混批组编号仅支持64位以内字母、数字、下划线或连字符'
    if (form.mixedEnabled && (!integer(form.mixCapacity, 1, 1000000) || !integer(form.minMixBoxes, 1, 100000))) return '启用混批须填写有效箱容和最低箱数'
  }
  if (mode === 'stock' && !integer(form.quantity, -2147483648, 2147483647)) return '库存调整数量须为有效整数'
  if (mode === 'staff' && (!integer(form.userId, 2, Number.MAX_SAFE_INTEGER) || !['OWNER', 'CATALOG', 'ORDER', 'FINANCE', 'WAREHOUSE', 'SUPPORT', 'OPERATOR'].includes(form.role) || note.length < 2 || note.length > 500)) return '请核对有效后台账号、岗位并填写2至500字的变更原因'
  if (mode === 'setting' && tab === 'documents/freight') {
    const name = typeof form.name === 'string' ? form.name.trim() : ''
    if (!name || Array.from(name).length > 80 || /[\u0000-\u001f\u007f-\u009f]/u.test(name)) return '请填写1至80字的运费模板名称'
  }
  if (mode === 'setting' && ['documents/promotion_rule', 'documents/bundle'].includes(tab) && !String(form.name || '').trim()) return '请填写活动名称'
  if (mode === 'setting' && tab === 'documents/group_campaign' && !String(form.name || '').trim()) return '请填写拼团名称'
  if (mode === 'setting' && tab === 'documents/group_campaign' && form.enabled && (!String(form.skuId || '').trim() || !integer(form.price, 1, Number.MAX_SAFE_INTEGER))) return '请填写活动商品和有效团价'
  return ''
}
