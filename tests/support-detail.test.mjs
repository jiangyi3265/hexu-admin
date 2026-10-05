import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceDetailRecord, detailFieldLabel, detailFieldValue } from '../src/views/hexu/workspace-model.js'

const context = { module: 'applications', tab: 'documents/support' }
const record = body => ({ id: 'DOC-support', shop_id: 2, member_id: 201, kind: 'support', status: 'PENDING', reviewer: null, review_note: '', created_at: '2026-09-27', updated_at: '2026-09-27', title: 'support', body })

test('客服详情沿用元数据与中文留言字段，保留Unicode正文不展开内部JSON', () => {
  const message = '客服留言🌿\n“联调”与 <script>不执行</script>，𠮷'
  const source = record({ question: '其他问题', message, orderId: 'HX001', shopId: 2, kind: 'support', rank: 1, uploads: [] })
  const detail = workspaceDetailRecord(source, context)
  assert.equal(detail.message, message)
  assert.equal(detail.question, '其他问题')
  assert.equal(detail.orderId, 'HX001')
  for (const key of ['id', 'shop_id', 'member_id', 'status', 'reviewer', 'review_note', 'created_at', 'updated_at']) assert.equal(detail[key], source[key])
  for (const key of ['title', 'body', 'kind', 'rank', 'shopId', 'uploads']) assert.equal(Object.hasOwn(detail, key), false)
  for (const [key, label] of Object.entries({ question: '问题类型', message: '留言内容', orderId: '关联订单' })) assert.equal(detailFieldLabel(key, context), label)
  assert.equal(detailFieldValue('message', detail.message, {}, context), message)
  assert.equal(source.body.rank, 1)
})

test('关联订单兼容新旧字段，空值未关联，数值0不丢失', () => {
  for (const body of [{}, { orderId: '' }, { '关联订单': '' }, { orderId: ' \n ' }, { orderId: null }]) assert.equal(detailFieldValue('orderId', workspaceDetailRecord(record(body), context).orderId, {}, context), '未关联')
  assert.equal(workspaceDetailRecord(record({ '关联订单': 'HX-old' }), context).orderId, 'HX-old')
  assert.equal(workspaceDetailRecord(record({ orderId: 'HX-new', '关联订单': 'HX-old' }), context).orderId, 'HX-new')
  assert.equal(workspaceDetailRecord(record({ orderId: null, '关联订单': 'HX-old' }), context).orderId, 'HX-old')
  assert.equal(detailFieldValue('orderId', workspaceDetailRecord(record({ orderId: '', '关联订单': 'HX-old' }), context).orderId, {}, context), '未关联')
  const detail = workspaceDetailRecord(record({ question: 0, message: 0, orderId: 0 }), context)
  for (const key of ['question', 'message', 'orderId']) assert.equal(detailFieldValue(key, detail[key], {}, context), 0)
})

test('非法结构化正文不被JSON化，其他kind与非客服上下文保持原详情', () => {
  const invalid = workspaceDetailRecord(record({ question: { internal: 1 }, message: ['不是正文'], orderId: {} }), context)
  assert.equal(invalid.message, '')
  assert.equal(invalid.question, '')
  assert.equal(invalid.orderId, '')
  const review = { ...record({ message: '原样资料' }), kind: 'review' }
  assert.equal(workspaceDetailRecord(review, context), review)
  const support = record({ message: '仍由原规范处理' })
  for (const other of [{ module: 'applications', tab: 'documents/review' }, { module: 'settings', tab: 'documents/support' }, {}]) assert.equal(workspaceDetailRecord(support, other), support)
  assert.equal(detailFieldLabel('message', { module: 'applications', tab: 'documents/review' }), 'message')
  assert.equal(detailFieldValue('orderId', '', {}, {}), '—')
})
