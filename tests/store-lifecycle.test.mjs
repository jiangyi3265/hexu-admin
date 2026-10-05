import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { computed, reactive, ref, watch, nextTick } from 'vue'
import { readLayoutSetting } from '../src/store/state-utils.js'
import * as workspaceModel from '../src/views/hexu/workspace-model.js'
import { createLatestContextGate, workspaceExportSnapshot } from '../src/views/hexu/workspace-async.js'
import { modules, labels, settingFields } from '../src/views/hexu/modules.js'

const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8').replace(/^import .*\r?\n/gm, '').replace(/^export default .*$/gm, '').replace(/^export (function|const|let) /gm, '$1 ')
function store(path, globals) {
  let result
  vm.runInNewContext(source(path).replace(/import\.meta\.glob\([^\n]+\)/, '{}').replaceAll('import.meta.env.VITE_APP_BASE_API', "'/dev-api'"), {
    ...globals, defineStore: (_id, definition) => { result = Object.assign(definition.state(), definition.actions); return result }
  })
  return result
}

for (const failure of [false, true, 'sync']) test(`退出 ${failure ? '失败' : '成功'} 均清本地身份和令牌，Promise仍可导航（${failure}）`, async () => {
  let removed = 0
  const user = store('store/modules/user.js', { getToken: () => 'old-token', logout: () => { if (failure === 'sync') throw new Error('offline'); return failure ? Promise.reject(new Error('timeout')) : Promise.resolve() }, removeToken: () => { removed++ } })
  Object.assign(user, { id: 1, name: '旧姓名', nickName: '旧昵称', avatar: '旧头像', roles: ['admin'], permissions: ['*:*:*'] })
  await user.logOut()
  for (const key of ['token', 'id', 'name', 'nickName', 'avatar']) assert.equal(user[key], '')
  assert.equal(user.roles.length, 0); assert.equal(user.permissions.length, 0); assert.equal(removed, 1)
})

test('菜单传输失败和nullable/非数组响应实际reject，不悬挂', async () => {
  const globals = { constantRoutes: [], dynamicRoutes: [], router: { addRoute() {} }, auth: {} }
  const failed = store('store/modules/permission.js', { ...globals, getRouters: () => Promise.reject(new Error('offline')) })
  await assert.rejects(failed.generateRoutes(), /offline/)
  for (const data of [null, undefined, {}]) {
    const malformed = store('store/modules/permission.js', { ...globals, getRouters: () => Promise.resolve({ data }) })
    await assert.rejects(malformed.generateRoutes(), /菜单数据格式无效/)
  }
  const valid = store('store/modules/permission.js', { ...globals, getRouters: () => Promise.resolve({ data: [] }) })
  assert.equal((await valid.generateRoutes()).length, 0)
})

for (const failedStep of ['info', 'menus', null]) test(`路由 guard 返回完整Promise，${failedStep || '正常'}分支完成next和收尾`, async () => {
  let guard, progressDone = 0, logouts = 0; const navigations = [], messages = [], added = []
  const user = { roles: [], getInfo: () => failedStep === 'info' ? Promise.reject(new Error('信息失败')) : Promise.resolve(), logOut: async () => { logouts++ } }
  const relogin = { show: false }
  vm.runInNewContext(source('permission.js'), {
    router: { beforeEach: callback => { guard = callback }, afterEach() {}, addRoute: route => added.push(route) },
    NProgress: { configure() {}, start() {}, done() { progressDone++ } },
    getToken: () => 'token', useUserStore: () => user, useSettingsStore: () => ({ setTitle() {} }),
    usePermissionStore: () => ({ generateRoutes: () => failedStep === 'menus' ? Promise.reject(new Error('菜单失败')) : Promise.resolve([{ path: '/hexu/overview' }]) }),
    isRelogin: relogin, ElMessage: { error: message => messages.push(message) }, isHttp: () => false, isPathMatch: (pattern, path) => pattern === path
  })
  const returned = guard({ path: '/hexu/overview', fullPath: '/hexu/overview?shopId=2', meta: {} }, {}, destination => navigations.push(destination))
  assert.equal(typeof returned?.then, 'function'); await returned
  assert.equal(navigations.length, 1); assert.equal(relogin.show, false)
  if (failedStep) {
    assert.equal(logouts, 1); assert.equal(progressDone, 1); assert.equal(messages.length, 1)
    assert.equal(navigations[0].path, '/login'); assert.equal(navigations[0].query.redirect, '/hexu/overview?shopId=2')
  } else { assert.equal(logouts, 0); assert.equal(added.length, 1); assert.equal(navigations[0].replace, true) }
})

test('布局存储损坏、空、nullable、非对象或不可用时回退默认；合法false/0保持', () => {
  for (const value of ['{broken', '', null, 'null', '[]', 'true', '42', '"text"']) assert.deepEqual(readLayoutSetting(() => ({ getItem: () => value })), {})
  assert.deepEqual(readLayoutSetting(() => { throw new Error('storage disabled') }), {})
  assert.deepEqual(readLayoutSetting(() => ({ getItem: () => '{"tagsView":false,"navType":0}' })), { tagsView: false, navType: 0 })
})

test('字典拒绝null/undefined/空key，同key更新并清重复旧条目，零key保持原兼容', () => {
  const dict = store('store/modules/dict.js', {})
  for (const key of [undefined, null, '']) { dict.setDict(key, 'bad'); assert.equal(dict.getDict(key), null) }
  assert.equal(dict.dict.length, 0)
  dict.setDict('status', 'old'); dict.setDict('status', 'new')
  assert.equal(dict.getDict('status'), 'new'); assert.equal(dict.dict.length, 1)
  dict.dict.push({ key: 'status', value: 'stale duplicate' }); dict.setDict('status', 'latest')
  assert.equal(dict.dict.length, 1); assert.equal(dict.getDict('status'), 'latest')
  assert.equal(dict.removeDict('status'), true); assert.equal(dict.getDict('status'), undefined)
  dict.setDict(0, 'zero'); assert.equal(dict.getDict(0), 'zero')
})

test('关闭左右标签目标不存在也resolve，保留当前标签及缓存', { timeout: 1000 }, async () => {
  const tags = store('store/modules/tagsView.js', {})
  tags.visitedViews = [{ path: '/a', name: 'A', meta: {} }]; tags.cachedViews = ['A']
  assert.equal((await tags.delRightTags({ path: '/missing' })).length, 1)
  assert.equal((await tags.delLeftTags({ path: '/missing' })).length, 1)
  assert.equal(tags.visitedViews[0].path, '/a'); assert.equal(tags.cachedViews[0], 'A')
})

const infoStore = response => store('store/modules/user.js', {
  getToken: () => 'token', getInfo: () => Promise.resolve(response), isHttp: value => typeof value === 'string' && value.startsWith('https:'), isEmpty: value => !value, defAva: 'default-avatar'
})
test('getInfo不接受nullable/非对象user，失败清旧权限；nullable身份字段有默认', async () => {
  for (const response of [null, {}, { user: null }, { user: [] }, { user: 'bad' }]) {
    const user = infoStore(response); user.roles = ['admin']; user.permissions = ['*:*:*']
    await assert.rejects(user.getInfo(), /用户信息格式无效/)
    assert.equal(user.roles.length, 0); assert.equal(user.permissions.length, 0)
  }
  const user = infoStore({ user: { userId: null, userName: null, nickName: null, avatar: {} }, roles: [], permissions: ['old'] })
  await user.getInfo()
  assert.equal(user.id, ''); assert.equal(user.name, ''); assert.equal(user.nickName, ''); assert.equal(user.avatar, 'default-avatar')
})

test('getInfo角色权限必须数组，空角色清旧权限，过滤非文本条目', async () => {
  for (const roles of [null, undefined, 'admin', {}, []]) {
    const user = infoStore({ user: {}, roles, permissions: ['*:*:*'] }); user.permissions = ['old']
    await user.getInfo(); assert.equal(user.roles[0], 'ROLE_DEFAULT'); assert.equal(user.permissions.length, 0)
  }
  for (const permissions of [null, undefined, '*:*:*', {}]) {
    const user = infoStore({ user: {}, roles: ['SUPPORT'], permissions }); await user.getInfo(); assert.equal(user.permissions.length, 0)
  }
  const user = infoStore({ user: {}, roles: ['admin', null, 9, ''], permissions: ['read', null, 9, ''] })
  await user.getInfo(); assert.equal(user.roles.length, 1); assert.equal(user.roles[0], 'admin'); assert.equal(user.permissions.length, 1); assert.equal(user.permissions[0], 'read')
})

test('请求拦截器错误回调返回真正reject，不转成undefined成功值', async () => {
  let rejected
  const service = { interceptors: { request: { use: (_fulfilled, error) => { rejected = error } }, response: { use() {} } } }
  vm.runInNewContext(source('utils/request.js').replaceAll('import.meta.env.VITE_APP_BASE_API', "'/dev-api'"), { axios: { defaults: { headers: {} }, create: () => service }, console: { log() {} } })
  const failure = new Error('request setup error')
  await assert.rejects(rejected(failure), error => error === failure)
})

test('报表platform随实际响应式角色变化，不固定初始快照', () => {
  const text = readFileSync(new URL('../src/views/hexu/reports/index.vue', import.meta.url), 'utf8')
  const script = text.split('<script setup>')[1].split('</script>')[0].replace(/^import .*\r?\n/gm, '')
  const user = reactive({ roles: ['SUPPORT'] }); let platform
  vm.runInNewContext(script + '\ncapture(platform)', { ref, computed, useUserStore: () => user, onMounted() {}, onActivated() {}, onDeactivated() {}, onBeforeUnmount() {}, capture: result => { platform = result } })
  assert.equal(platform.value, false); user.roles.push('admin'); assert.equal(platform.value, true)
  user.roles = []; assert.equal(platform.value, false)
})

test('query解析按授权商城和平台白名单，退款筛选更新而其他模块不覆写搜索', () => {
  const shops = [{ id: 1 }, { id: 2 }, { id: 3 }]
  assert.deepEqual(workspaceModel.workspaceQueryState({ shopId: '3', refundId: 'R2' }, shops, { module: 'refunds' }), { shopId: 3, search: 'R2' })
  assert.deepEqual(workspaceModel.workspaceQueryState({ shopId: '999', refundId: '' }, shops, { module: 'refunds' }), { shopId: 1, search: '' })
  assert.deepEqual(workspaceModel.workspaceQueryState({}, [], { module: 'refunds' }), { shopId: undefined, search: '' })
  assert.equal(workspaceModel.workspaceQueryState({ shopId: '0' }, shops, { tab: 'resources/points' }).shopId, 0)
  assert.equal(workspaceModel.workspaceQueryState({ shopId: '0' }, shops, { tab: 'resources/withdrawals' }).shopId, 1)
  assert.equal(workspaceModel.workspaceQueryState({}, shops, { module: 'products' }).search, null)
})

test('真实Workspace脚本同路径query更换更新scope/search并清详情；在途保存完成后再应用query', async () => {
  const text = readFileSync(new URL('../src/views/hexu/Workspace.vue', import.meta.url), 'utf8')
  const script = text.split('<script setup>')[1].split('</script>')[0].replace(/^import .*\r?\n/gm, '')
  const route = reactive({ query: { shopId: '1', refundId: 'R1' } }), reads = [], stops = []
  let mounted, state
  vm.runInNewContext(script + '\ncapture({shopId,search,drawer,selected,saving,uploading})', {
    ...workspaceModel, createLatestContextGate, workspaceExportSnapshot, modules, labels, settingFields, ref, computed,
    watch: (...args) => { const stop = watch(...args); stops.push(stop); return stop }, useRoute: () => route, defineProps: () => ({ module: 'refunds' }),
    onMounted: callback => { mounted = callback }, onUnmounted() {}, listShops: async () => ({ data: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
    query: async (path, shopId) => { reads.push({ path, shopId }); return { data: [] } }, clearTimeout() {}, URL: { revokeObjectURL() {} },
    capture: result => { state = result }, ElMessage: { error() {} }
  })
  try {
    await mounted(); assert.equal(state.shopId.value, 1); assert.equal(state.search.value, 'R1')
    state.drawer.value = true; state.selected.value = { id: 'old' }
    route.query = { shopId: '3', refundId: 'R2' }; await nextTick(); await Promise.resolve()
    assert.equal(state.shopId.value, 3); assert.equal(state.search.value, 'R2'); assert.equal(state.drawer.value, false); assert.equal(Object.keys(state.selected.value).length, 0)
    state.saving.value = true; route.query = { shopId: '1', refundId: 'R3' }; await nextTick()
    assert.equal(state.shopId.value, 3); assert.equal(state.search.value, 'R2')
    state.saving.value = false; await nextTick(); await Promise.resolve()
    assert.equal(state.shopId.value, 1); assert.equal(state.search.value, 'R3'); assert.equal(reads.at(-1).shopId, 1)
  } finally { stops.forEach(stop => stop()) }
})
