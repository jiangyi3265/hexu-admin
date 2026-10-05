import test from 'node:test'
import assert from 'node:assert/strict'
import { reactive } from 'vue'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRetryablePost,createSessionRetryKeys } from '../src/api/hexu/idempotency.js'
import { createLatestContextGate, workspaceExportSnapshot } from '../src/views/hexu/workspace-async.js'

test('未知结果失败后同 scope/body 重试复用键，确认成功后新意图换键', async () => {
  const calls = []; let sequence = 0, fail = true
  const post = createRetryablePost(async config => { calls.push(config); if (fail) throw new Error('timeout'); return { saved: true } }, () => 'actor-a', () => `KEY${++sequence}`)
  await assert.rejects(post('/stock', { shopId: 2, skuId: 'paper', quantity: 1 }), /timeout/)
  fail = false
  await post('/stock', { quantity: 1, skuId: 'paper', shopId: 2 })
  assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key'])
  await post('/stock', { shopId: 2, skuId: 'paper', quantity: 1 })
  assert.notEqual(calls[1].headers['Idempotency-Key'], calls[2].headers['Idempotency-Key'])
})

test('失败意图按商城、操作和完整正文隔离，回到原正文仍复用原键', async () => {
  const calls = []; let sequence = 0
  const post = createRetryablePost(async config => { calls.push(config); throw new Error('unknown') }, () => 'actor-a', () => `KEY${++sequence}`)
  for (const [url, body] of [['/stock', { shopId: 2, quantity: 1 }], ['/stock', { shopId: 3, quantity: 1 }], ['/stock', { shopId: 2, quantity: 2 }], ['/other', { shopId: 2, quantity: 1 }], ['/stock', { quantity: 1, shopId: 2 }]]) await assert.rejects(post(url, body))
  assert.equal(new Set(calls.slice(0, 4).map(c => c.headers['Idempotency-Key'])).size, 4)
  assert.equal(calls[0].headers['Idempotency-Key'], calls[4].headers['Idempotency-Key'])
})

test('身份变化不复用前一身份键；旧身份晚到成功不清掉新身份失败意图', async () => {
  const calls = []; let actor = 'a', sequence = 0, finishA
  const post = createRetryablePost(config => { calls.push(config); if (actor === 'a') return new Promise(resolve => { finishA = resolve }); return Promise.reject(new Error('unknown')) }, () => actor, () => `KEY${++sequence}`)
  const pendingA = post('/write', { shopId: 2 }); await Promise.resolve()
  actor = 'b'; await assert.rejects(post('/write', { shopId: 2 }))
  finishA('saved'); await pendingA
  await assert.rejects(post('/write', { shopId: 2 }))
  assert.notEqual(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key'])
  assert.equal(calls[1].headers['Idempotency-Key'], calls[2].headers['Idempotency-Key'])
})

test('同一在途意图只发送一次，正文为点击时JSON快照', async () => {
  const calls = []; let finish
  const post = createRetryablePost(config => { calls.push(config); return new Promise(resolve => { finish = resolve }) }, () => 'a', () => 'KEYfixed')
  const body = reactive({ shopId: 2, nested: { quantity: 1 }, rows: ['FILE1'] })
  const first = post('/write', body), second = post('/write', { nested: { quantity: 1 }, rows: ['FILE1'], shopId: 2 })
  assert.equal(first, second)
  body.shopId = 3; body.nested.quantity = 9; body.rows.push('FILE2')
  await Promise.resolve(); assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].data, { shopId: 2, nested: { quantity: 1 }, rows: ['FILE1'] })
  finish({ saved: true }); await first
})

test('显式调用方幂等键保持原契约，不由缓存替换', async () => {
  const calls = []
  const post = createRetryablePost(async config => { calls.push(config); return true }, () => 'a', () => 'generated')
  await post('/write', { shopId: 2 }, 'CALLER-KEY-1')
  assert.equal(calls[0].headers['Idempotency-Key'], 'CALLER-KEY-1')
  assert.equal(calls[0].headers.repeatSubmit, false)
})

const retryStorage = () => {
  const items = new Map()
  return { items, getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) }
}
const digest = async value => createHash('sha256').update(value).digest('hex')

test('模拟reload后同身份/操作/正文恢复失败键，storage只含opaque索引和随机键', async () => {
  const storage = retryStorage(), calls = [], actor = 'secret-auth-token', body = { shopId: 2, bankAccount: '6222000000000000', reason: '私有审核正文', uploads: ['FILEprivate'] }
  let sequence = 0
  const factory = fail => createRetryablePost(async config => { calls.push(config); if (fail) throw new Error('timeout'); return true }, () => actor, () => `opaque-retry-${++sequence}`, createSessionRetryKeys(() => storage, digest))
  await assert.rejects(factory(true)('/bank', body))
  assert.equal(storage.items.size, 1)
  const serialized = JSON.stringify([...storage.items])
  for (const secret of [actor, body.bankAccount, body.reason, 'FILEprivate', '/bank', 'shopId']) assert.equal(serialized.includes(secret), false)
  assert.match([...storage.items.keys()][0], /^hexu-command-retry:[0-9a-f]{64}$/)
  await factory(false)('/bank', { uploads: ['FILEprivate'], reason: body.reason, bankAccount: body.bankAccount, shopId: 2 })
  assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key'])
  assert.equal(storage.items.size, 0)
  await factory(false)('/bank', body)
  assert.notEqual(calls[1].headers['Idempotency-Key'], calls[2].headers['Idempotency-Key'])
})

test('跨reload的opaque存储仍按身份/商城/正文/操作隔离', async () => {
  const storage = retryStorage(), keys = []; let sequence = 0
  for (const [actor, url, body] of [['a', '/stock', { shopId: 2, qty: 1 }], ['b', '/stock', { shopId: 2, qty: 1 }], ['a', '/stock', { shopId: 3, qty: 1 }], ['a', '/stock', { shopId: 2, qty: 2 }], ['a', '/other', { shopId: 2, qty: 1 }], ['a', '/stock', { shopId: 2, qty: 1 }]]) {
    const post = createRetryablePost(async config => { keys.push(config.headers['Idempotency-Key']); throw new Error('unknown') }, () => actor, () => `opaque-retry-${++sequence}`, createSessionRetryKeys(() => storage, digest))
    await assert.rejects(post(url, body))
  }
  assert.equal(new Set(keys.slice(0, 5)).size, 5); assert.equal(keys[0], keys[5]); assert.equal(storage.items.size, 5)
})

test('存储或摘要不可用回退同实例内存；无效存储键不可复用', async () => {
  for (const failure of ['storage', 'digest']) {
    const keys = []; let sequence = 0
    const retained = createSessionRetryKeys(() => { throw new Error('storage disabled') }, failure === 'digest' ? async () => { throw new Error('no crypto') } : digest)
    const post = createRetryablePost(async config => { keys.push(config.headers['Idempotency-Key']); throw new Error('unknown') }, () => 'a', () => `opaque-retry-${++sequence}`, retained)
    await assert.rejects(post('/write', { shopId: 2 })); await assert.rejects(post('/write', { shopId: 2 }))
    assert.equal(keys[0], keys[1])
  }
  const storage = retryStorage(), retained = createSessionRetryKeys(() => storage, digest)
  const record = await retained.load('a', 'body')
  storage.setItem(record.name, '<invalid key>')
  assert.equal((await retained.load('a', 'body')).key, null)
})

test('storage旧成功响应不删除同索引下另一键；默认WebCrypto摘要实际运行', async () => {
  const storage = retryStorage(), retained = createSessionRetryKeys(() => storage)
  const record = await retained.load('a', 'body')
  assert.match(record.name, /^hexu-command-retry:[0-9a-f]{64}$/)
  retained.save(record.name, 'new-retry-key')
  retained.remove(record.name, 'old-retry-key')
  assert.equal(storage.getItem(record.name), 'new-retry-key')
  retained.remove(record.name, 'new-retry-key')
  assert.equal(storage.getItem(record.name), null)
})

test('摘要等待中切换身份，旧正文不会发到新账号，未发送键不落存储', async () => {
  const storage = retryStorage(), calls = []; let actor = 'a', finishDigest, hashingStarted, defer = true
  const started = new Promise(resolve => { hashingStarted = resolve })
  const retained = createSessionRetryKeys(() => storage, value => defer ? new Promise(resolve => { finishDigest = () => resolve(digest(value)); hashingStarted() }) : digest(value))
  const post = createRetryablePost(async config => { calls.push(config); return true }, () => actor, () => 'opaque-retry-key', retained)
  const pending = post('/write', { shopId: 2, privateBody: '原账号正文' })
  await started; actor = 'b'; finishDigest()
  await assert.rejects(pending, /登录账号已变化/)
  assert.equal(calls.length, 0); assert.equal(storage.items.size, 0)
  defer = false
  await post('/write', { shopId: 2, privateBody: '新账号正文' })
  assert.equal(calls.length, 1); assert.equal(calls[0].data.privateBody, '新账号正文'); assert.equal(storage.items.size, 0)
})

test('身份改变导致发送前拒绝时，不删除已发且结果未知的恢复键', async () => {
  const storage = retryStorage(); let actor = 'a', finishDigest, hashingStarted
  const normal = createSessionRetryKeys(() => storage, digest), oldKeys = []
  await assert.rejects(createRetryablePost(async config => { oldKeys.push(config.headers['Idempotency-Key']); throw new Error('unknown') }, () => actor, () => 'old-unknown-key', normal)('/write', { shopId: 2 }))
  const before = [...storage.items]
  const started = new Promise(resolve => { hashingStarted = resolve })
  const deferred = createSessionRetryKeys(() => storage, value => new Promise(resolve => { finishDigest = () => resolve(digest(value)); hashingStarted() }))
  const pending = createRetryablePost(async () => { assert.fail('旧正文不应发送') }, () => actor, () => 'new-unused-key', deferred)('/write', { shopId: 2 })
  await started; actor = 'b'; finishDigest(); await assert.rejects(pending, /登录账号已变化/)
  assert.deepEqual([...storage.items], before)
  actor = 'a'
  await createRetryablePost(async config => { assert.equal(config.headers['Idempotency-Key'], oldKeys[0]); return true }, () => actor, () => 'new-key', normal)('/write', { shopId: 2 })
  assert.equal(storage.items.size, 0)
})

test('图片 gate 拒绝旧请求、商城/tab/记录/表单变化、关闭及卸载晚到结果', () => {
  let scope = [2, 'documents/support', {}, {}, true, false]
  const gate = createLatestContextGate(() => scope)
  const first = gate.begin(), latest = gate.begin()
  assert.equal(first(), false); assert.equal(latest(), true)
  for (let i = 0; i < scope.length; i++) {
    const valid = gate.begin(), old = scope[i]
    scope = [...scope]; scope[i] = typeof old === 'object' ? {} : typeof old === 'boolean' ? !old : `${old}-changed`
    assert.equal(valid(), false); scope[i] = old
  }
  const closed = gate.begin(); gate.invalidate(); assert.equal(closed(), false)
  const unmounted = gate.begin(); gate.dispose(); assert.equal(unmounted(), false); assert.equal(gate.begin()(), false)
})

test('导出和审计共同使用点击时快照，兼容Vue proxy，修改搜索/列/嵌套行不串店', () => {
  const source = reactive({ shopId: 2, resource: 'resources/refunds', title: '售后工作台', filter: 'A', columns: [['amount', '金额', 'money']], rows: [{ id: 'A', amount: 2990, body: { uploads: ['FILEA'] } }] })
  const snapshot = workspaceExportSnapshot(source)
  source.shopId = 3; source.resource = 'orders'; source.filter = 'B'; source.title = '订单'
  source.columns[0][1] = 'B列'; source.rows[0].id = 'B'; source.rows[0].body.uploads.push('FILEB'); source.rows.push({ id: 'B2' })
  assert.equal(snapshot.shopId, 2); assert.equal(snapshot.resource, 'resources/refunds'); assert.equal(snapshot.filter, 'A'); assert.equal(snapshot.title, '售后工作台')
  assert.deepEqual(snapshot.columns, [['amount', '金额', 'money']])
  assert.deepEqual(snapshot.rows, [{ id: 'A', amount: 2990, body: { uploads: ['FILEA'] } }])
})

test('Workspace 接线使用图片 gate 和导出快照，命令入口使用失败重试helper', () => {
  const workspace = readFileSync(new URL('../src/views/hexu/Workspace.vue', import.meta.url), 'utf8')
  assert.match(workspace, /const current=attachmentGate\.begin\(\)/)
  assert.match(workspace, /attachmentGate\.dispose\(\)/)
  assert.match(workspace, /function closeAttachment\(\)\{attachmentGate\.invalidate\(\)/)
  assert.match(workspace, /rowCount:snapshot\.rows\.length,filter:snapshot\.filter/)
  assert.match(workspace, /snapshot\.rows\.map/)
  assert.match(workspace, /a\.download=snapshot\.title/)
  assert.match(readFileSync(new URL('../src/api/hexu/index.js', import.meta.url), 'utf8'), /command=\(operation,data,key\)=>idempotentPost/)
  assert.match(readFileSync(new URL('../src/api/hexu/compliance.js', import.meta.url), 'utf8'), /retryablePost\(base \+ url, data\)/)
})
