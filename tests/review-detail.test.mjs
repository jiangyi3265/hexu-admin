import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, compileTemplate } from '@vue/compiler-sfc'
import { reviewDisplay } from '../src/views/hexu/review-detail-model.js'

test('长文和多图评价在详情模型中完整保留，重复附件只显示一次', () => {
  const content = '长文核对。'.repeat(100)
  const uploads = Array.from({ length: 9 }, (_, index) => `FILE-${index}`)
  const record = { kind: 'review', body: { orderId: 'HX-1', skuId: 'SKU-1', rating: 4, content, anonymous: true, uploads: [...uploads, uploads[0]] } }
  const display = reviewDisplay(record)
  assert.equal(display.body.content, content)
  assert.equal(display.body.orderId, 'HX-1')
  assert.equal(display.body.skuId, 'SKU-1')
  assert.equal(display.body.anonymous, true)
  assert.equal(display.stars, 4)
  assert.deepEqual(display.uploads, uploads)
  assert.equal(reviewDisplay({ kind: 'review_append', body: { parentId: 'DOC-1' } }).body.parentId, 'DOC-1')
})

test('评价专用模板保留换行、图片网格和预览，通用售后详情仍独立', async () => {
  const source = await readFile(new URL('../src/views/hexu/ReviewDocumentDetail.vue', import.meta.url), 'utf8')
  const workspace = await readFile(new URL('../src/views/hexu/Workspace.vue', import.meta.url), 'utf8')
  const { descriptor, errors } = parse(source)
  assert.deepEqual(errors, [])
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: 'ReviewDocumentDetail.vue', id: 'review-detail' }).errors, [])
  assert.match(source, /white-space:pre-wrap;overflow-wrap:anywhere/)
  assert.match(source, /v-for="\(id, index\) in uploads"/)
  assert.match(source, /@click="preview\(id\)"/)
  assert.match(workspace, /<ReviewDocumentDetail v-if="reviewDetail"/)
  assert.match(workspace, /:key="detailRequest" v-model="drawer"/)
  assert.match(workspace, /activeTab==='documents\/support'\?'回复这条留言':'审核这条申请'/)
})
