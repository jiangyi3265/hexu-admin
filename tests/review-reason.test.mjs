import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { workspaceActionError, workspaceReviewPayload } from '../src/views/hexu/workspace-model.js'

const review = (reason, tab = 'documents/review', decision = 'APPROVED') => workspaceActionError('review', { reason, decision, approve: decision === 'APPROVED' }, { tab })

test('审核原因缺失或空通过允许，非法类型不强转为文本', () => {
  for (const reason of [undefined, '']) assert.equal(review(reason), '')
  for (const reason of [null, 0, 42, true, false, [], {}, ['说明'], { toString() { throw new Error('不得强转') } }, Symbol('说明')]) assert.equal(review(reason), '审核意见必须为文本')
  assert.ok(review(undefined, 'documents/review', 'REJECTED'))
  assert.ok(review(undefined, 'documents/review_append', 'SUPPLEMENT'))
})

test('审核意见按Unicode码点允许500个字符拒绝501，不使用UTF16长度误限emoji', () => {
  for (const tab of ['documents/review', 'documents/review_append', 'documents/support', 'resources/withdrawals', 'resources/reconciliationAdjustments']) {
    assert.equal(review('🌿'.repeat(500), tab), '')
    assert.equal(review('𠮷'.repeat(500), tab), '')
    assert.equal(review('中'.repeat(499) + '🌿', tab), '')
    assert.equal(review('\u00a0\u3000\ufeff' + '🌿'.repeat(500) + '\t\r\n', tab), '')
    assert.equal(review('中'.repeat(501), tab), '审核意见最多500个Unicode字符')
    assert.equal(review('🌿'.repeat(501), tab), '审核意见最多500个Unicode字符')
  }
  const reason = '🌿'.repeat(500), form = { id: 'DOC', reason, decision: 'SUPPLEMENT', approve: true }
  assert.equal(review(reason, 'documents/review_append', 'SUPPLEMENT'), '')
  assert.equal(workspaceReviewPayload(form, 'documents/review_append').reason, reason)
  assert.equal(workspaceReviewPayload(form, 'documents/review_append').decision, 'SUPPLEMENT')
})

test('审核允许LF CR TAB正常排版，逐个拒绝其它C0 DEL和C1', () => {
  assert.equal(review('审核\t意见\r\n多行说明'), '')
  for (let code = 0; code <= 0x9f; code++) {
    if (!(code <= 0x1f || code >= 0x7f)) continue
    const reason = '审核' + String.fromCharCode(code) + '意见'
    if ([0x09, 0x0a, 0x0d].includes(code)) assert.equal(review(reason), '', `allowed ${code}`)
    else assert.equal(review(reason), '审核意见不能包含非法控制字符', `rejected ${code}`)
  }
  assert.equal(review('审核\u00a0意见，正常标点'), '')
  assert.equal(review('\u000b审核意见'), '审核意见不能包含非法控制字符')
  assert.equal(review('\u00a0\u3000\ufeff', 'documents/review_append', 'SUPPLEMENT'), '待补充资料必须填写原因')
})

test('审核前置校验保留原两字业务下限且不扩大到其他mode', () => {
  for (const [tab, decision] of [['resources/withdrawals', 'REJECTED'], ['resources/reconciliationAdjustments', 'APPROVED'], ['documents/stocktake', 'APPROVED'], ['documents/link_relation', 'APPROVED']]) {
    assert.ok(review('一', tab, decision))
    assert.equal(review('依据', tab, decision), '')
  }
  assert.equal(workspaceActionError('setting', { reason: { original: 'unchanged' } }), '')
  assert.equal(workspaceActionError('setting', { reason: '文'.repeat(501) + '\u0000' }), '')
})

test('审核textarea未设置maxlength，避免浏览器按UTF16截断合法500码点', async () => {
  const source = await readFile(new URL('../src/views/hexu/Workspace.vue', import.meta.url), 'utf8')
  const template = source.match(/<template v-else-if="mode==='review'">([\s\S]*?)<\/template>/)?.[1]
  assert.ok(template)
  const reasonInput = template.match(/<el-input v-model="form.reason"[^>]*>/)?.[0]
  assert.ok(reasonInput)
  assert.doesNotMatch(reasonInput, /maxlength|max-length/)
})
