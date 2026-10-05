import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { memberProfilePath } from '../src/api/hexu/contracts.js'
import { cloneProductForm, emptyProductForm, normalizeDecorationForm, platformPointPaths, profileAvatarUrl, profileRows, selectedAttachmentIds, settingJsonError, workspaceActionError, imageUploadError, csvCell, decorationUploadError, removeDecorationAttachment, detailFieldLabel, detailFieldValue, workspaceListRow, workspaceListCell, workspaceStatusCell, workspaceRankCell, workspaceExportCell, formatCurrency, workspaceDetailRecord, detailFieldIsMoney, businessDateTime, productPreviewAsset } from '../src/views/hexu/workspace-model.js'
import { modules, labels, settingFields } from '../src/views/hexu/modules.js'
import { responseErrorMessage } from '../src/utils/http-error.js'
import { reportFilterError, reportDisplayCell } from '../src/views/hexu/reports/model.js'

test('现金售后验收后可由后台发起原路退款，并明确等待渠道回执', () => {
  const view = fs.readFileSync(new URL('../src/views/hexu/Workspace.vue', import.meta.url), 'utf8')
  const api = fs.readFileSync(new URL('../src/api/hexu/index.js', import.meta.url), 'utf8')
  assert.match(view, /row\.status==='APPROVED'&&Number\(row\.amount\)>0/)
  assert.match(view, /@click="submitChannelRefund\(row\)"/)
  assert.match(view, /已提交退款渠道，请等待回执确认/)
  assert.match(api, /channel\/refund\/.*encodeURIComponent\(id\)/)
})

test('只有已审核非银行提现显示渠道打款入口，提交后按沙盒或正式回执提示并刷新', () => {
  const view = fs.readFileSync(new URL('../src/views/hexu/Workspace.vue', import.meta.url), 'utf8')
  const api = fs.readFileSync(new URL('../src/api/hexu/index.js', import.meta.url), 'utf8')
  assert.match(view, /row\.channel&&row\.channel!=='BANK'&&row\.status==='APPROVED'/)
  assert.match(view, /:disabled="saving" @click="submitChannelPayout\(row\)"/)
  assert.match(view, /submit:\(\)=>channelPayout\(row\.id\)/)
  assert.match(view, /submit:\(\)=>channelRefund\(row\.id\)/)
  assert.match(view, /busy:saving/)
  assert.match(api, /channel\/payout\/.*encodeURIComponent\(id\)/)
})

test('后台将积分兑换订单类型映射为中文', () => {
  assert.equal(workspaceListCell('order_type', 'POINTS', labels), '积分兑换')
  assert.equal(detailFieldValue('order_type', 'POINTS', labels), '积分兑换')
  assert.equal(workspaceListCell('merchant_no', 'POINTS', labels), '不涉及收款')
  assert.equal(detailFieldValue('merchant_no', 'POINTS', labels), '不涉及收款')
})

test('已全额冲正收益在列表和导出中不再显示可用，部分冲正保持原状态', () => {
  const money = value => (Number(value) / 100).toFixed(2)
  for (const amount of [1000, -30]) {
    const row = { status: 'AVAILABLE', earning_type: amount < 0 ? 'PEER_COST' : 'RETAIL', amount, reversed: amount }
    assert.equal(workspaceStatusCell(row, 'finance', labels), '已全额冲正')
    assert.equal(workspaceExportCell(['status', '状态'], row, { module: 'finance', labels, money }), '已全额冲正')
  }
  assert.equal(workspaceStatusCell({ status: 'AVAILABLE', earning_type: 'RETAIL', amount: 1000, reversed: 300 }, 'finance', labels), labels.AVAILABLE)
})

test('所有业务列表导出沿用页面状态、职级和字段文案，金额仍为可计算数字', () => {
  const money = value => (Number(value) / 100).toFixed(2)
  for (const [module, status, expected] of [
    ['products', 'ACTIVE', '正常'], ['products', 'PENDING', '待审核'],
    ['orders', 'PAID', '已支付'], ['finance', 'FAILED', '处理失败'],
    ['applications', 'SUPPLEMENT', '待补充'], ['settings', 'ARCHIVED', '历史版本'],
    ['audit', 'RUNNING', '运行中']
  ]) {
    const row = { status }
    assert.equal(workspaceExportCell(['status', '状态'], row, { module, labels, money }), expected)
    assert.equal(workspaceExportCell(['status', '状态'], row, { module, labels, money }), workspaceStatusCell(row, module, labels))
  }
  const exchange = { refund_type: 'EXCHANGE', status: 'CLOSED' }
  assert.equal(workspaceExportCell(['status', '状态'], exchange, { module: 'refunds', labels, money }), '换货已完成')
  assert.equal(workspaceExportCell(['status', '状态'], exchange, { module: 'orders', labels, money }), '已关闭')
  assert.equal(workspaceExportCell(['rank_no', '职级'], { rank_no: 2 }, { labels, money }), workspaceRankCell(2))
  assert.equal(workspaceExportCell(['order_type', '订单类型'], { order_type: 'POINTS' }, { labels, money }), '积分兑换')
  assert.equal(workspaceExportCell(['merchant_no', '收款商户'], { merchant_no: 'POINTS' }, { labels, money }), '不涉及收款')
  assert.equal(workspaceExportCell(['retail', '零售价', 'money'], { retail: 8900 }, { labels, money }), '89.00')
  assert.equal(workspaceExportCell(['retail', '零售价', 'money'], { retail: null }, { labels, money }), '—')
})

test('后台财务正负金额在列表和详情把符号置于币符前，CSV保留纯数字', () => {
  const money = value => (Number(value) / 100).toFixed(2)
  for (const [cents, display, csv] of [[-1, '-¥0.01', '-0.01'], [1, '¥0.01', '0.01'], [0, '¥0.00', '0.00']]) {
    assert.equal(formatCurrency(cents), display)
    assert.equal(detailFieldValue('amount', cents, {}, { module: 'finance', tab: 'resources/reconciliationAdjustments' }), display)
    assert.equal(workspaceExportCell(['amount', '调整金额', 'money'], { amount: cents }, { module: 'finance', money }), csv)
  }
})

test('经营报表页面的历史职级、订单状态和无销量提示有明确中文显示', () => {
  assert.equal(reportDisplayCell('rank_no', 1), '云代理')
  assert.equal(reportDisplayCell('rank_no', 2), '分货中心')
  assert.equal(reportDisplayCell('rank_no', 3), '总代理')
  assert.equal(reportDisplayCell('rank_no', 0), '未记录职级')
  assert.equal(reportDisplayCell('rank_no', 9), 9)
  assert.equal(reportDisplayCell('order_status', 'SHIPPED'), '已发货')
  assert.equal(reportDisplayCell('order_status', 'REFUNDED'), '已退款')
  assert.equal(reportDisplayCell('turnoverDays', null), '暂无销量')
  assert.equal(reportDisplayCell('turnoverDays', 3.25), 3.25)
  assert.equal(reportDisplayCell('sku_id', 'cup'), 'cup')
})

test('后台订单明细使用同单商品图片路径和中文支付时间，不接受任意外链', () => {
  const fileId = 'FILE' + 'a'.repeat(32)
  assert.deepEqual(productPreviewAsset('/hexu/app/ui-assets/cup'), { type: 'ui', id: 'cup' })
  assert.deepEqual(productPreviewAsset('/hexu/app/attachments/product/' + fileId), { type: 'attachment', id: fileId })
  assert.deepEqual(productPreviewAsset(fileId), { type: 'attachment', id: fileId })
  const orderId = 'HX' + 'b'.repeat(32)
  assert.deepEqual(productPreviewAsset('/hexu/app/attachments/order-cover/' + orderId + '/12'), { type: 'orderCover', orderId, lineId: '12' })
  for (const invalid of ['https://other.example/image.png', '/hexu/app/attachments/avatar/' + fileId, '/hexu/app/ui-assets/../secret', '/hexu/app/attachments/order-cover/' + orderId + '/12/other', '']) assert.equal(productPreviewAsset(invalid), null)
  assert.equal(detailFieldLabel('paid_at', { module: 'orders' }), '支付时间')
  assert.equal(detailFieldLabel('database', { module: 'audit', tab: 'backups' }), '备份数据库')
  assert.equal(detailFieldLabel('encrypted', { module: 'audit', tab: 'backups' }), '已加密')
  assert.equal(detailFieldLabel('scheduled', { module: 'audit', tab: 'backups' }), '自动备份已启用')
  const view = fs.readFileSync(new URL('../src/views/hexu/Workspace.vue', import.meta.url), 'utf8')
  const preview = fs.readFileSync(new URL('../src/views/hexu/OrderItemsPreview.vue', import.meta.url), 'utf8')
  assert.match(view, /<OrderItemsPreview v-if="drawer&&module==='orders'" :items="selected\.items"\/>/)
  assert.match(preview, /<ProductImagePreview v-if="line\.asset" :asset="line\.asset"/)
})

test('后台积分售后显示退回积分并保留现金退款原值', () => {
  const points = workspaceListRow({ order_type: 'POINTS', amount: 0, points_return: 1800 }, 'resources/refunds')
  const cash = workspaceListRow({ order_type: 'DEALER_RETAIL', amount: 2990 }, 'resources/refunds')
  assert.equal(points.refund_display, '1800积分')
  assert.equal(cash.refund_display, '¥29.90')
  const exchange = workspaceListRow({ refund_type: 'EXCHANGE', amount: 2990 }, 'resources/refunds')
  assert.equal(exchange.refund_display, '¥29.90')
  assert.equal(detailFieldLabel('amount', { module: 'refunds', record: exchange }), '换货商品价值')
  assert.equal(detailFieldLabel('amount', { module: 'refunds', record: cash }), '金额')
  assert.equal(workspaceDetailRecord(points, { module: 'refunds' }).amount, undefined)
  assert.equal(workspaceDetailRecord(cash, { module: 'refunds' }).amount, 2990)
  assert.equal(detailFieldLabel('points_return', { module: 'refunds' }), '退回积分')
  assert.equal(detailFieldLabel('order_type', { module: 'refunds' }), '订单类型')
  assert.equal(detailFieldLabel('points_scope', { module: 'refunds' }), '积分归属')
  assert.equal(detailFieldValue('points_scope', 0, labels), '平台积分')
  assert.equal(detailFieldValue('points_scope', 2, labels), '商城积分（商城编号 2）')
})

test('售后详情拆分问题描述和凭证数量，未知历史凭证不丢失', () => {
  const source = { id: 'SH1', amount: 2990, evidence_json: { description: '包装破损', uploads: ['FILEabc'] } }
  const detail = workspaceDetailRecord(source, { module: 'refunds' })
  assert.equal(detail.evidence_json, undefined)
  assert.equal(detail.problem_description, '包装破损')
  assert.equal(detail.evidence_upload_count, 1)
  assert.equal(detailFieldLabel('problem_description', { module: 'refunds' }), '问题描述')
  assert.equal(detailFieldLabel('evidence_upload_count', { module: 'refunds' }), '凭证图片数量')
  assert.deepEqual(selectedAttachmentIds(source), ['FILEabc'])
  const legacy = { evidence_json: { description: '历史资料', inspection: { checked: true } } }
  assert.deepEqual(workspaceDetailRecord(legacy, { module: 'refunds' }).evidence_json, legacy.evidence_json)
})

test('财务调整详情展示凭证入口和账单摘要，不把快照当售后 JSON', () => {
  const source = {
    id: 'ADJ1', line_id: 'DZL1', amount: -1,
    evidence_json: { uploads: ['FILEproof'], line: { expected_amount: 99, channel_amount: 100, difference: -1, note: '金额差异' } }
  }
  const detail = workspaceDetailRecord(source, { module: 'finance', tab: 'resources/reconciliationAdjustments' })
  assert.equal(detail.evidence_json, undefined)
  assert.equal(detail.finance_proof_count, 1)
  assert.equal(detailFieldValue('snapshot_difference', detail.snapshot_difference, {}, { module: 'finance', tab: 'resources/reconciliationAdjustments' }), '-¥0.01')
  assert.deepEqual(selectedAttachmentIds(source), ['FILEproof'])
  assert.equal(detailFieldLabel('line_id', { module: 'finance', tab: 'resources/reconciliationAdjustments' }), '对账明细编号')
  assert.equal(detailFieldLabel('finance_proof_count', { module: 'finance', tab: 'resources/reconciliationAdjustments' }), '财务凭证（张）')
  assert.equal(detailFieldLabel('evidence_json', { module: 'refunds' }), '售后凭证')
  const legacy = { evidence_json: { uploads: ['FILEproof'], manual_review: '需追溯' } }
  assert.deepEqual(workspaceDetailRecord(legacy, { module: 'finance', tab: 'resources/reconciliationAdjustments' }), legacy)
  assert.equal(detailFieldLabel('evidence_json', { module: 'finance', tab: 'resources/reconciliationAdjustments' }), '财务凭证资料')
})

test('退货运单与验收资料按中文字段回显，未知历史结构原样保留', () => {
  const record = {
    return_json: { carrier: '顺丰速运', tracking: 'TEST2026100304', uploads: ['FILEone'] },
    evidence_json: { description: '包装破损', uploads: [], inspection: { receivedQty: 1, goodQty: 0, note: '破损', uploads: ['FILEtwo'], inspector: 101 } }
  }
  const detail = workspaceDetailRecord(record, { module: 'refunds' })
  assert.equal(detail.return_json, undefined)
  assert.equal(detail.evidence_json, undefined)
  assert.equal(detail.return_carrier, '顺丰速运')
  assert.equal(detail.return_tracking, 'TEST2026100304')
  assert.equal(detail.return_upload_count, 1)
  assert.equal(detail.inspection_received_qty, 1)
  assert.equal(detail.inspection_good_qty, 0)
  assert.equal(detail.inspection_note, '破损')
  assert.equal(detail.inspection_upload_count, 1)
  assert.equal(detail.inspection_operator, 101)
  assert.deepEqual(selectedAttachmentIds(record), ['FILEtwo', 'FILEone'])
  assert.equal(detailFieldLabel('return_tracking', { module: 'refunds' }), '退货运单号')
  assert.equal(detailFieldLabel('inspection_good_qty', { module: 'refunds' }), '验收合格数量')
  const legacy = { return_json: { tracking: 'OLD', extra: true }, evidence_json: { inspection: { unexpected: true } } }
  assert.deepEqual(workspaceDetailRecord(legacy, { module: 'refunds' }).return_json, legacy.return_json)
  assert.deepEqual(workspaceDetailRecord(legacy, { module: 'refunds' }).evidence_json, legacy.evidence_json)
})

test('售后审核弹窗标明当前售后单号，避免相邻记录误审', () => {
  const source = fs.readFileSync(new URL('../src/views/hexu/Workspace.vue', import.meta.url), 'utf8')
  assert.match(source, /mode\.value==='review'&&props\.module==='refunds'\)return '审核售后 · '\+selected\.value\.id/)
})

test('平台积分转赠和冻结复核保留平台商城范围', () => {
  assert.ok(platformPointPaths.includes('resources/pointTransfers'))
  assert.ok(platformPointPaths.includes('resources/pointRiskCases'))
  assert.equal(platformPointPaths.includes('resources/withdrawals'), false)
})

test('后台发货与换货运单不接受空格或特殊字符', () => {
  const valid = { carrier: '顺丰速运', tracking: 'SF12345678' }
  for (const mode of ['ship', 'exchange']) {
    assert.equal(workspaceActionError(mode, valid), '')
    for (const tracking of [' SF12345678', 'SF12345678 ', 'SF-12345678', '1234567']) {
      assert.match(workspaceActionError(mode, { ...valid, tracking }), /运单号/)
    }
    for (const carrier of ['', '顺丰\n速运', 'x'.repeat(61)]) {
      assert.match(workspaceActionError(mode, { ...valid, carrier }), /快递公司/)
    }
  }
})

test('取消商品图库编辑不会改变查询得到的商品', () => {
  const row = { id: 'SKU1', available: 5, gallery: ['FILE1', 'FILE2'] }
  const form = cloneProductForm(row)
  form.gallery.splice(0, 1)
  assert.deepEqual(row.gallery, ['FILE1', 'FILE2'])
  assert.deepEqual(form.gallery, ['FILE2'])
  assert.equal(form.expectedAvailable, 5)
  assert.equal(form.brand, '')
})

test('新商品草稿不预填示例封面或价格，且每次创建独立图库', () => {
  const first = emptyProductForm(), second = emptyProductForm()
  assert.equal(first.asset, '')
  assert.deepEqual([first.retail, first.cloud_price, first.center_price, first.owner_price], [0, 0, 0, 0])
  first.gallery.push('FILE1')
  assert.deepEqual(second.gallery, [])
})

test('后台空拼团草稿不能保存；启用时须指定商品和有效团价', () => {
  const context = { tab: 'documents/group_campaign' }
  assert.equal(workspaceActionError('setting', { name: '', enabled: false }, context), '请填写拼团名称')
  assert.equal(workspaceActionError('setting', { name: '待配置拼团', enabled: false }, context), '')
  assert.equal(workspaceActionError('setting', { name: '二人团', enabled: true, skuId: '', price: 0 }, context), '请填写活动商品和有效团价')
})

test('后台新促销和套餐需要明确活动名称', () => {
  for (const tab of ['documents/promotion_rule', 'documents/bundle']) {
    assert.equal(workspaceActionError('setting', { name: '  ' }, { tab }), '请填写活动名称')
    assert.equal(workspaceActionError('setting', { name: '真实活动' }, { tab }), '')
  }
})

test('后台运费模板名称与移动端同一长度和控制字符契约', () => {
  const context = { tab: 'documents/freight' }
  for (const name of ['', '  ', '运费\n模板', '模'.repeat(81)]) assert.equal(workspaceActionError('setting', { name }, context), '请填写1至80字的运费模板名称')
  assert.equal(workspaceActionError('setting', { name: ' 本地运费模板 ' }, context), '')
})

test('后台商品品牌允许为空或80字以内文本，拒绝控制字符及非文本', () => {
  const product = { name: '商品', brand: '清风', spec: '6包', asset: 'FILEtest', weight_grams: 1000, box_size: 1, min_boxes: 1, min_qty: 1, retail: 2000, retail_min: 0, retail_max: 0 }
  assert.equal(workspaceActionError('product', product), '')
  assert.equal(workspaceActionError('product', { ...product, asset: '' }), '请先上传商品主图')
  assert.equal(workspaceActionError('product', { ...product, brand: '' }), '')
  for (const brand of ['牌'.repeat(81), '无效\n品牌', { name: '伪造' }]) assert.match(workspaceActionError('product', { ...product, brand }), /品牌/)
})

test('后台商品名称和规格在提交前拒绝空白、非文本及控制字符', () => {
  const product = { name: '商品', spec: '6包', asset: 'FILEtest', weight_grams: 1000, box_size: 1, min_boxes: 1, min_qty: 1, retail: 2000, retail_min: 0, retail_max: 0 }
  for (const name of ['\u00a0\u2003', '商品\n改名', '商品\u0085改名', 123]) assert.match(workspaceActionError('product', { ...product, name }), /名称和规格/)
  for (const spec of ['规格\t注入', '规格\u0085注入', { value: '6包' }]) assert.match(workspaceActionError('product', { ...product, spec }), /名称和规格/)
  assert.equal(workspaceActionError('product', product), '')
})

test('后台商品封面只能通过图库上传或移除选择，删光图片不回退示例图', () => {
  const screen = fs.readFileSync(new URL('../src/views/hexu/Workspace.vue', import.meta.url), 'utf8')
  assert.match(screen, /f\[0\]==='asset'/)
  assert.match(screen, /form\.gallery\[0\]\|\|''/)
  assert.doesNotMatch(screen, /form\.gallery\[0\]\|\|'stapler'/)
})

test('后台装修客服电话与小程序共用 customerPhone，旧 servicePhone 可回填', () => {
  assert.equal(settingFields.decoration.some(field => field[0] === 'customerPhone'), true)
  assert.equal(settingFields.decoration.some(field => field[0] === 'servicePhone'), false)
  assert.deepEqual(normalizeDecorationForm({servicePhone:'0571-12345678',banners:[1]}),{customerPhone:'0571-12345678',banners:[1]})
  assert.deepEqual(normalizeDecorationForm({servicePhone:'old',customerPhone:'new'}),{customerPhone:'new'})
  const screen = fs.readFileSync(new URL('../src/views/hexu/Workspace.vue',import.meta.url),'utf8')
  assert.match(screen,/normalizeDecorationForm\(row\?\.body\)/)
})

test('会员详情仅呈现可读资料，手机号取脱敏会员记录', () => {
  const data = { member: { id: 201, name: '会员甲', phone: '138****5678' }, profile: { name: '新昵称', gender: '女', birthday: '1995-09-23', region: '浙江省 杭州市 西湖区', signature: '', phone: '恶意原始手机号', uploads: ['IDENTITY1'] } }
  assert.equal(memberProfilePath('member/1'), '/members/member%2F1/profile')
  const rows = profileRows(data)
  assert.equal(rows.find(row => row.label === '昵称').value, '新昵称')
  assert.equal(rows.find(row => row.label === '手机号').value, '138****5678')
  assert.equal(rows.find(row => row.label === '个性签名').value, '未填写')
  assert.equal(rows.some(row => row.value === '恶意原始手机号' || row.value === 'IDENTITY1'), false)
})

test('头像地址只使用已绑定头像公开路由，不接受任意远程地址', () => {
  const validId = 'FILE' + 'a'.repeat(32)
  assert.equal(profileAvatarUrl(validId, '/dev-api/'), `/dev-api/hexu/app/attachments/avatar/${validId}`)
  assert.equal(profileAvatarUrl('FILEabc', '/dev-api/'), '')
  assert.equal(profileAvatarUrl('FILE' + 'A'.repeat(32), '/dev-api/'), '')
  assert.equal(profileAvatarUrl('https://example.com/private.png'), '')
  assert.equal(profileAvatarUrl('FILE/../IDENTITY1'), '')
  assert.equal(profileAvatarUrl(null), '')
})

test('详情字段按客户、代理、商品与当前配置上下文命名', () => {
  const productFields = [['name', '商品名称'], ['spec', '规格']]
  const customer = { module: 'agents', tab: 'resources/customers', columns: [['member_id', '客户']], productFields }
  assert.equal(detailFieldLabel('name', customer), '客户昵称')
  assert.equal(detailFieldLabel('agent_id', customer), '归属代理编号')
  assert.equal(detailFieldLabel('member_id', customer), '客户会员编号')
  for (const [key, label] of Object.entries({ phone: '手机号（脱敏）', order_count: '订单数', inviter_agent_id: '邀请代理编号', bound_at: '绑定时间', region: '所在地区' })) assert.equal(detailFieldLabel(key, customer), label)
  const agent = { ...customer, tab: 'resources/agents', columns: [['id', '代理编号']] }
  assert.equal(detailFieldLabel('name', agent), '代理昵称')
  assert.equal(detailFieldLabel('child_count', agent), '直接下级代理数')
  assert.equal(detailFieldLabel('customer_count', agent), '归属客户数')
  assert.equal(detailFieldLabel('approved_at', agent), '审核通过时间')
  assert.equal(detailFieldLabel('name', { module: 'products', productFields }), '商品名称')
  assert.equal(detailFieldLabel('name', { module: 'finance', productFields }), '名称')
  assert.equal(detailFieldLabel('name', { module: 'settings', tab: 'documents/coupon', productFields, settingFields: [['name', '券名称']] }), '券名称')
  assert.equal(detailFieldLabel('name', { module: 'settings', tab: 'resources/pointRiskCases', columns: [['name', '会员']], productFields }), '会员')
})

test('会员地区按中文层级展示，详情空值不输出null且零值不丢失', () => {
  const data = { member: { id: 201 }, profile: { region: ['浙江省', '杭州市', '西湖区'], birthday: null } }
  assert.equal(profileRows(data).find(row => row.label === '所在地区').value, '浙江省 杭州市 西湖区')
  assert.equal(profileRows({ profile: { region: [] } }).find(row => row.label === '所在地区').value, '未填写')
  assert.equal(detailFieldValue('region', ['浙江省', null, ' 杭州市 ', '']), '浙江省 杭州市')
  for (const value of [null, undefined, '', []]) assert.equal(detailFieldValue('parent_id', value), '—')
  assert.equal(detailFieldValue('order_count', 0), 0)
  assert.equal(detailFieldValue('rank_no', 2), '分货中心')
  assert.equal(detailFieldValue('frozen', false), '否')
  assert.equal(detailFieldValue('status', 'ACTIVE', { ACTIVE: '正常' }), '正常')
  assert.equal(detailFieldValue('name', 'ACTIVE', { ACTIVE: '正常' }), 'ACTIVE')
})

test('后台时间与小程序按设备时区展示，不改日期字段或无效原值', () => {
  const timestamp = '2026-09-25T05:12:54.000-04:00'
  const date = new Date(timestamp)
  const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
  assert.equal(businessDateTime('bound_at', timestamp), expected)
  assert.equal(workspaceListCell('bound_at', timestamp), expected)
  assert.equal(workspaceListCell('created_at', timestamp), expected)
  assert.equal(workspaceListCell('status', 'PAID', { PAID: '已支付' }), '已支付')
  assert.equal(workspaceListRow({ id: 'HX1', created_at: timestamp }, 'orders').created_at, timestamp)
  assert.equal(detailFieldValue('bound_at', timestamp), expected)
  assert.equal(businessDateTime('birthday', '1995-09-23'), '1995-09-23')
  assert.equal(businessDateTime('bound_at', '无效时间'), '无效时间')
})

test('资金账本列表和详情均回显中文类别，未知类别保留原值供排查', () => {
  const ledger = { module: 'finance', tab: 'resources/ledger' }
  for (const [code, display] of [['RECEIPT', '订单收款'], ['REFUND', '退款'], ['PAYOUT', '提现打款'], ['REFUND_LEVEL', '级差收益冲正']]) {
    assert.equal(workspaceListCell('category', code, labels), display)
    assert.equal(detailFieldValue('category', code, labels, ledger), display)
  }
  assert.equal(detailFieldValue('category', 'UNKNOWN_CATEGORY', labels, ledger), 'UNKNOWN_CATEGORY')
})

test('详情仅将已知货币分字段换元，积分、箱规、编号及数量不变', () => {
  const product = { module: 'products' }, order = { module: 'orders' }
  assert.equal(detailFieldValue('retail', 2000, {}, product), '¥20.00')
  assert.equal(detailFieldValue('total', 8900, {}, order), '¥89.00')
  assert.equal(detailFieldValue('freight', 0, {}, order), '¥0.00')
  assert.equal(detailFieldValue('amount', -165, {}, { module: 'audit', tab: 'resources/ledger' }), '-¥1.65')
  assert.equal(detailFieldValue('difference', 100, {}, { module: 'finance', tab: 'resources/reconciliationLines' }), '¥1.00')
  assert.equal(detailFieldValue('amount', 8900, {}, { module: 'refunds' }), '¥89.00')
  assert.equal(detailFieldValue('price', 1800, {}, { module: 'settings', tab: 'resources/groups' }), '¥18.00')
  for (const tab of ['resources/pointLedger', 'resources/pointTransfers', 'resources/pointBatches', 'resources/pointRiskCases', 'resources/points']) {
    assert.equal(detailFieldIsMoney('amount', { module: 'finance', tab }), false)
    assert.equal(detailFieldValue('amount', 8900, {}, { module: 'finance', tab }), 8900)
  }
  for (const key of ['point_price', 'box_size', 'min_qty', 'available', 'id', 'weight_grams']) assert.equal(detailFieldValue(key, 24, {}, product), 24)
  for (const key of ['points_used', 'points_earned', 'buyer_id', 'rule_id']) assert.equal(detailFieldValue(key, 201, {}, order), 201)
  assert.equal(detailFieldValue('total', null, {}, order), '—')
  assert.equal(detailFieldValue('total', '不是金额', {}, order), '不是金额')
  assert.equal(detailFieldLabel('retail_min', { ...product, productFields: [['retail_min', '最低零售价（分，0不限）']] }), '最低零售价（元，0不限）')
})

test('业务详情中文标签覆盖已点检原字段，列表不为会员生成重复空标题', () => {
  for (const key of ['warning_qty', 'mix_group', 'mix_units', 'allow_loose', 'standard', 'subtotal', 'discount', 'freight', 'points_scope', 'shipping_json', 'expires_at', 'remark', 'buyerName', 'ruleEffectiveAt', 'restock_qty', 'return_json', 'actor_id', 'before', 'after']) assert.notEqual(detailFieldLabel(key), key)
  const customer = { member_id: 201, name: '林小禾' }
  assert.deepEqual(workspaceListRow(customer, 'resources/customers'), customer)
  assert.equal(Object.hasOwn(workspaceListRow(customer, 'resources/agents'), 'title'), false)
  assert.equal(workspaceListRow({ kind: 'coupon', body: { name: '九折券' } }, 'documents/coupon').title, '九折券')
  assert.equal(modules.applications.tabs.find(tab => tab[1] === 'documents/review_append')?.[0], '商品追评')
})

test('后端400业务拒绝保留可读原因，包含图片接口blob响应', async () => {
  assert.equal(await responseErrorMessage({ message: 'Request failed with status code 400', response: { status: 400, data: { code: 400, msg: '该岗位无此操作权限' } } }), '该岗位无此操作权限')
  assert.equal(await responseErrorMessage({ message: 'Request failed with status code 400', response: { status: 400, data: new Blob([JSON.stringify({ msg: '资料不存在或无权读取' })], { type: 'application/json' }) } }), '资料不存在或无权读取')
  assert.equal(await responseErrorMessage({ message: 'Network Error' }), '后端接口连接异常')
  assert.equal(await responseErrorMessage({ message: 'timeout of 10000ms exceeded' }), '系统接口请求超时')
  assert.equal(await responseErrorMessage({ message: 'Request failed with status code 502', response: { status: 502, data: '<html>Bad gateway</html>' } }), '系统接口502异常')
})

test('业务详情收集银行卡、活动和装修已保存的附件并去重', () => {
  assert.deepEqual(selectedAttachmentIds({ body: { uploads: ['FILE1'], confirmationFile: 'FILE2', asset: 'FILE3', assets: { custom: 'FILE4', static: 'stapler' }, banners: [{ image: 'FILE3' }] }, payout_evidence_json: { files: ['FILE5'] }, evidence_json: { inspection: { uploads: ['FILE6'] } }, return_json: { uploads: ['FILE7'] } }), ['FILE1', 'FILE6', 'FILE7', 'FILE5', 'FILE2', 'FILE3', 'FILE4'])
  assert.deepEqual(selectedAttachmentIds({ body: { uploads: {}, assets: null } }), [])
})

test('JSON语法合法仍须匹配配置对象和数组契约', () => {
  assert.equal(settingJsonError('screens', { M01: {} }), '')
  assert.ok(settingJsonError('screens', []))
  assert.ok(settingJsonError('assets', null))
  assert.equal(settingJsonError('banners', []), '')
  assert.ok(settingJsonError('banners', {}))
})

test('账务调整必填凭证及双人复核意见；退货验收拒绝数量差异', () => {
  assert.ok(workspaceActionError('adjustment', { reason: '差额复核', uploads: [] }))
  assert.equal(workspaceActionError('adjustment', { reason: '差额复核', uploads: ['FILE1'] }), '')
  assert.ok(workspaceActionError('review', { approve: true, reason: '' }, { tab: 'resources/reconciliationAdjustments' }))
  const context = { selected: { qty: 3 } }, form = { receivedQty: 3, goodQty: 2, note: '一件破损' }
  assert.equal(workspaceActionError('inspect', form, context), '')
  assert.ok(workspaceActionError('inspect', { ...form, receivedQty: 2 }, context))
  assert.ok(workspaceActionError('inspect', { ...form, goodQty: 4 }, context))
  assert.ok(workspaceActionError('inspect', { ...form, note: '备注'.repeat(251) }, context))
})

test('提交前拒绝过去分红生效时间和非法混批参数', () => {
  const now = Date.parse('2026-09-27T10:00:00'), rule = { cloud_bps: 300, center_bps: 200, owner_bps: 100, effectiveAt: '2026-09-27 11:00:00' }
  assert.equal(workspaceActionError('rule', rule, { now }), '')
  assert.ok(workspaceActionError('rule', { ...rule, effectiveAt: '' }, { now }))
  assert.ok(workspaceActionError('rule', { ...rule, effectiveAt: '2026-09-26 11:00:00' }, { now }))
  const box = { box_size: 24, min_boxes: 1, min_qty: 1, mix_units: 1, mix_group: '', mixedEnabled: true, mixCapacity: 24, minMixBoxes: 1 }
  assert.equal(workspaceActionError('box', box), '')
  assert.ok(workspaceActionError('box', { ...box, mixCapacity: 0 }))
  assert.ok(workspaceActionError('box', { ...box, mix_group: '混批组' }))
})

test('图片上传拒绝空文件、超5MB和非支持类型', () => {
  assert.equal(imageUploadError({ size: 4096, type: 'image/png' }), '')
  assert.ok(imageUploadError({ size: 0, type: 'image/png' }))
  assert.ok(imageUploadError({ size: 5 * 1024 * 1024 + 1, type: 'image/jpeg' }))
  assert.ok(imageUploadError({ size: 4096, type: 'image/gif' }))
})

test('报表日期与编号契约在生成前校验', () => {
  const filters = { county: '', skuId: '', rank: 0, agentId: 0, customerId: 0 }
  assert.equal(reportFilterError(['2026-09-01', '2026-09-27'], filters, '2026-09-27'), '')
  assert.ok(reportFilterError(['2026-02-31', '2026-09-27'], filters, '2026-09-27'))
  assert.ok(reportFilterError(['2026-09-01', '2026-09-28'], filters, '2026-09-27'))
  assert.ok(reportFilterError(['2026-09-27', '2026-09-01'], filters, '2026-09-27'))
  assert.ok(reportFilterError(['2026-09-01', '2026-09-27'], { ...filters, customerId: 1.5 }, '2026-09-27'))
})

test('当前列表导出对带空白前缀的公式和引号正确转义', () => {
  assert.equal(csvCell('  =SUM(A1)'), '"\'  =SUM(A1)"')
  assert.equal(csvCell('\t@SUM(A1)'), '"\'\t@SUM(A1)"')
  assert.equal(csvCell('禾序"商城'), '"禾序""商城"')
})

test('装修上传不覆盖无效JSON输入；移除图片同步清除轮播和资源引用', () => {
  assert.ok(decorationUploadError({ assets: '{broken', banners: '[]' }))
  assert.ok(decorationUploadError({ assets: '[]', banners: '{}' }))
  const form = { asset: 'FILE1', assets: '{"uploaded":"FILE1","other":"FILE2"}', banners: '[{"image":"FILE1","title":"轮播"},{"image":"FILE2"}]' }
  assert.equal(decorationUploadError(form), '')
  const removed = removeDecorationAttachment(form, 'FILE1')
  assert.equal(removed.asset, '')
  assert.deepEqual(JSON.parse(removed.assets), { other: 'FILE2' })
  assert.deepEqual(JSON.parse(removed.banners), [{ image: '', title: '轮播' }, { image: 'FILE2' }])
  assert.equal(form.asset, 'FILE1')
  assert.equal(removeDecorationAttachment({ assets: '{broken', banners: 'bad' }, 'FILE1').assets, '{broken')
})
