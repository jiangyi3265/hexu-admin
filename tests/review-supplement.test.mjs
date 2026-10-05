import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, compileTemplate } from '@vue/compiler-sfc'
import { supportsReviewSupplement, workspaceReviewPayload, workspaceActionError } from '../src/views/hexu/workspace-model.js'

test('只有首评与追评开放三态决策，其他业务仍按原approve布尔映射', () => {
  for (const tab of ['documents/review', 'documents/review_append']) {
    assert.equal(supportsReviewSupplement(tab), true)
    for (const decision of ['APPROVED', 'REJECTED', 'SUPPLEMENT']) {
      const form = Object.freeze({ id: 'DOC-test', approve: true, decision, reason: '联调意见' })
      const payload = workspaceReviewPayload(form, tab)
      assert.equal(payload.decision, decision)
      assert.equal(payload.id, form.id)
      assert.equal(Object.hasOwn(payload, 'approve'), false)
      assert.equal(form.approve, true)
    }
  }
  for (const tab of ['documents/promotion', 'documents/shop_transfer', 'documents/stocktake', 'documents/support', 'resources/withdrawals', 'resources/reconciliationAdjustments', 'refunds']) {
    assert.equal(supportsReviewSupplement(tab), false)
    assert.equal(workspaceReviewPayload({ approve: true, decision: 'SUPPLEMENT' }, tab).decision, 'APPROVED')
    assert.equal(workspaceReviewPayload({ approve: false, decision: 'SUPPLEMENT' }, tab).decision, 'REJECTED')
  }
})

test('首评和追评驳回与补充必须原因，通过不强制且非法决策被拒绝', () => {
  for (const tab of ['documents/review', 'documents/review_append']) {
    assert.equal(workspaceActionError('review', { decision: 'APPROVED', reason: '' }, { tab }), '')
    for (const decision of ['REJECTED', 'SUPPLEMENT']) {
      for (const reason of ['', '  \n\t']) assert.ok(workspaceActionError('review', { decision, approve: true, reason }, { tab }))
      assert.equal(workspaceActionError('review', { decision, approve: false, reason: '请补充使用体验' }, { tab }), '')
    }
    for (const decision of [undefined, null, '', true, false, 'PENDING', 'supplement']) assert.equal(workspaceActionError('review', { decision, reason: '有说明' }, { tab }), '请选择有效审核结果')
  }
})

test('既有提现及盘点/联动/调整原因约束不因三态增加被弱化', () => {
  assert.equal(workspaceActionError('review', { approve: false, reason: '' }, { tab: 'resources/withdrawals' }), '提现驳回须填写至少2字的原因')
  assert.equal(workspaceActionError('review', { approve: true, reason: '' }, { tab: 'resources/reconciliationAdjustments' }), '请填写至少2字的账务调整复核意见')
  for (const tab of ['documents/stocktake', 'documents/link_relation']) assert.equal(workspaceActionError('review', { approve: true, reason: '' }, { tab }), '请填写至少2字的审核依据')
})

test('真实Workspace模板可编译，三态控件明确绑定decision且保留其他二态表单', async () => {
  const source = await readFile(new URL('../src/views/hexu/Workspace.vue', import.meta.url), 'utf8')
  const { descriptor, errors } = parse(source)
  assert.deepEqual(errors, [])
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: 'Workspace.vue', id: 'review-supplement' }).errors, [])
  assert.match(source, /v-if="contentReview" v-model="form\.decision"/)
  assert.match(source, /el-radio value="SUPPLEMENT">待补充资料/)
  assert.match(source, /v-else v-model="form\.approve"/)
  assert.match(source, /next==='review'&&contentReview\.value\?\{decision:'APPROVED'\}/)
  assert.match(source, /workspaceReviewPayload\(form\.value,activeTab\.value\)/)
})
