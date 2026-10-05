import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const view = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const workspace = view('../src/views/hexu/Workspace.vue')
const compliance = view('../src/views/hexu/compliance/index.vue')
const fulfillment = view('../src/views/hexu/fulfillment/index.vue')
const state = value => ({ value })

// 直接执行页面中的函数，注入可控接口响应，覆盖异步返回顺序。
function functionSource(source, name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`))
  assert.notEqual(start, -1, `${name} 未找到`)
  const body = source.indexOf('{', start)
  let depth = 0, quote = '', escaped = false
  for (let i = body; i < source.length; i++) {
    const char = source[i]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
    } else if ('\'"`'.includes(char)) quote = char
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) return source.slice(start, i + 1)
  }
  throw new Error(`${name} 函数未闭合`)
}

test('P2-3 同商城撤岗后刷新 403 清除详情，迟到详情不再回写', async () => {
  let resolveDetail, detailReads = 0, writes = 0, closedAttachments = 0
  const context = {
    clearTimeout() {}, setTimeout() { throw new Error('不应安排轮询') },
    platformPointPaths: [], activeTab: state('orders'), shopId: state(2), shops: state([{ id: 2 }]), statementBatch: state(''),
    loadRequest: 0, detailRequest: 0, refreshTimer: null, lastScope: 2, lastTab: 'orders',
    drawer: state(true), dialog: state(true), selected: state({ id: 'OLD', account: 'secret' }), form: state({ bankAccount: 'secret' }),
    tracking: state({ events: ['private'] }), trackingError: state(''), imageDialog: state(true),
    rows: state([{ id: 'OLD' }]), recentOrders: state([]), summary: state({}), loading: state(false), error: state(''),
    props: { module: 'orders' }, config: { path: 'orders' }, closeAttachment() { closedAttachments++ },
    query() { return Promise.reject(new Error('403 岗位已撤销')) },
    detail() { detailReads++; return new Promise(resolve => { resolveDetail = resolve }) },
    orderTracking() { throw new Error('迟到详情不应读取轨迹') },
    ElMessage: { error() {} }, workspaceListRow(value) { return value },
    command() { writes++; throw new Error('不应写入') }
  }
  runInNewContext(`${functionSource(workspace, 'load')}\n${functionSource(workspace, 'showDetail')}`, context)
  const pendingDetail = context.showDetail({ id: 'ORDER1' })
  await context.load()
  resolveDetail({ data: { id: 'ORDER1', bank_account: 'private' } })
  await pendingDetail
  assert.equal(detailReads, 1)
  assert.equal(context.error.value, '403 岗位已撤销')
  assert.equal(context.drawer.value, false)
  assert.equal(context.dialog.value, false)
  assert.equal(context.imageDialog.value, false)
  assert.equal(Object.keys(context.selected.value).length, 0)
  assert.equal(Object.keys(context.form.value).length, 0)
  assert.equal(context.tracking.value, null)
  assert.equal(closedAttachments, 1)
  assert.equal(writes, 0)
  assert.match(workspace, /v-else-if="error&&module!=='applications'" icon="warning" title="业务数据不可访问"/)
  assert.match(workspace, /v-if="error" icon="warning" title="当前页签不可访问"/)
})

for (const [name, source] of [['商户与协议', compliance], ['拣货与直发售后', fulfillment]]) {
  test(`P2-4 ${name} 空范围、异常格式及 403 均提示错误，可重试`, async () => {
    let answer, businessReads = 0, writes = 0
    const context = {
      shops: state([]), shopId: state(null), error: state(''),
      listShops() { return answer instanceof Error ? Promise.reject(answer) : Promise.resolve({ data: answer }) },
      load() { businessReads++; context.error.value = '' },
      command() { writes++ }
    }
    runInNewContext(`${functionSource(source, 'initialize')}\n${functionSource(source, 'refresh')}`, context)
    for (const [response, expected] of [[[], '没有可管理的商城'], [{ bad: true }, '管理范围格式无效'], [new Error('403 Forbidden'), '403 Forbidden']]) {
      answer = response
      await context.initialize()
      assert.match(context.error.value, new RegExp(expected))
      assert.equal(context.shopId.value, null)
      assert.equal(businessReads, 0)
    }
    answer = [{ id: 2, name: '测试商城' }]
    await context.refresh()
    assert.equal(context.shopId.value, 2)
    assert.equal(businessReads, 1)
    assert.equal(writes, 0)
    assert.match(source, /<el-result v-if="error"[^\n]*重试读取/)
    assert.match(source, /<section v-else class="hx-section"/)
  })
}

test('P3 配置 GET 500、拣货 GET 200 时仍显示拣货，并明确配置读取失败', async () => {
  let pickReads = 0, writes = 0
  const context = {
    shopId: state(2), tab: state('pick'), loadRequest: 0, lastShop: 2, lastTab: 'pick',
    linkDialog: state(false), candidateRequest: 0, candidateLoading: state(false), wholesaleCandidates: state([]),
    loading: state(false), error: state(''), trackingConfig: state(null), trackingError: state(''),
    pickOrders: state([]), aftersaleLinks: state([]), refunds: state([]),
    trackingConfiguration() { return Promise.reject(new Error('500')) },
    listPickOrders() { pickReads++; return Promise.resolve({ data: [{ orderId: 'SANDBOX-1' }] }) },
    query() { throw new Error('不应读取退款') }, listAftersaleLinks() { throw new Error('不应读取关联') },
    command() { writes++ }
  }
  runInNewContext(functionSource(fulfillment, 'load'), context)
  await context.load()
  assert.equal(pickReads, 1)
  assert.equal(context.pickOrders.value[0].orderId, 'SANDBOX-1')
  assert.match(context.trackingError.value, /配置读取失败.*状态未知/)
  assert.equal(context.trackingConfig.value, null)
  assert.equal(context.error.value, '')
  assert.equal(writes, 0)
  assert.match(fulfillment, /v-if="trackingError"[^>]*type="error"/)
  assert.match(fulfillment, /v-else-if="trackingConfig\?\.configured === false"/)
})

test('P2-4 已选商城的业务 GET 403 隐藏旧业务弹窗并显示错误', async () => {
  const policy = {
    shopId: state(2), tab: state('merchant'), loadRequest: 0, lastShop: 2, lastTab: 'merchant',
    merchantDialog: state(true), policyDialog: state(true), policyDetail: state(true),
    loading: state(false), error: state(''), merchant: state({ secret: true }), policies: state([1]), consents: state([1]),
    merchantStatus() { return Promise.reject(new Error('403 无权限')) },
    listPolicies() { throw new Error('不应请求') }, listPolicyConsents() { throw new Error('不应请求') }
  }
  runInNewContext(functionSource(compliance, 'load'), policy)
  await policy.load()
  assert.match(policy.error.value, /403/)
  for (const dialog of ['merchantDialog', 'policyDialog', 'policyDetail']) assert.equal(policy[dialog].value, false)

  const pick = {
    shopId: state(2), tab: state('pick'), loadRequest: 0, lastShop: 2, lastTab: 'pick',
    linkDialog: state(true), candidateRequest: 0, candidateLoading: state(false), wholesaleCandidates: state([{ id: 'OLD' }]),
    loading: state(false), error: state(''), trackingConfig: state(null), trackingError: state(''),
    pickOrders: state([{ id: 'OLD' }]), aftersaleLinks: state([]), refunds: state([]),
    trackingConfiguration() { return Promise.resolve({ data: { configured: true } }) },
    listPickOrders() { return Promise.reject(new Error('403 无权限')) }
  }
  runInNewContext(functionSource(fulfillment, 'load'), pick)
  await pick.load()
  assert.match(pick.error.value, /403/)
  assert.equal(pick.linkDialog.value, false)
  assert.equal(pick.pickOrders.value.length, 0)
  assert.equal(pick.wholesaleCandidates.value.length, 0)
})
