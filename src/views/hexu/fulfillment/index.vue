<template>
  <div class="hx-fulfillment">
    <header class="hx-header">
      <div><div class="hx-eyebrow">禾序商贸 · DISTRIBUTION OPERATIONS</div><h1>拣货与直发售后</h1><p>订单拣货留痕、打印拣货单及关联公司批发售后</p></div>
      <div class="hx-tools">
        <el-select v-model="shopId" :disabled="saving" aria-label="选择商城" style="width:220px" @change="load">
          <el-option v-for="shop in shops" :key="shop.id" :value="shop.id" :label="shop.name" />
        </el-select>
        <el-button :loading="loading" @click="refresh">刷新数据</el-button>
      </div>
    </header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-result v-if="error" icon="warning" title="管理范围或拣货数据读取失败" :sub-title="error"><template #extra><el-button @click="refresh">重试读取</el-button></template></el-result>
    <section v-else class="hx-section" v-loading="loading">
      <el-alert v-if="trackingError" :title="trackingError" type="error" :closable="false" show-icon class="hx-alert"><el-button link type="primary" @click="load">重试配置读取</el-button></el-alert>
      <el-alert v-else-if="trackingConfig?.configured === false" title="承运商轨迹接口尚未在服务端配置。发货运单号仍会保存，但客户端不会显示虚构轨迹。" type="warning" :closable="false" show-icon class="hx-alert" />
      <el-alert v-else-if="trackingConfig?.configured === true" title="承运商轨迹接口已配置；订单详情可查看真实轨迹与异常。" type="success" :closable="false" class="hx-alert" />
      <el-tabs v-model="tab" :before-leave="() => !saving" @tab-change="load">
        <el-tab-pane label="订单拣货" name="pick" />
        <el-tab-pane label="直发售后关联" name="aftersale" />
      </el-tabs>
      <template v-if="tab === 'pick'">
        <el-alert title="按订单商品明细拣货；完成拣货后仍需在订单与履约页面录入承运商及真实运单号发货。" type="info" :closable="false" class="hx-alert" />
        <el-table :data="pickOrders" border stripe empty-text="当前商城没有待拣货订单">
          <el-table-column prop="orderId" label="订单编号" min-width="190" class-name="hx-pick-order-id" />
          <el-table-column prop="buyerId" label="客户编号" min-width="80" />
          <el-table-column prop="itemCount" label="商品种数" min-width="80" />
          <el-table-column label="订单状态" min-width="105"><template #default="{ row }">{{ labels[row.orderStatus] || row.orderStatus }}</template></el-table-column>
          <el-table-column label="拣货状态" min-width="105"><template #default="{ row }"><el-tag :type="pickStatusType(row.pickStatus)">{{ pickStatusLabel(row.pickStatus) }}</el-tag></template></el-table-column>
          <el-table-column label="下单时间" min-width="170"><template #default="{ row }">{{ businessDateTime('created_at', row.createdAt) }}</template></el-table-column>
          <el-table-column label="操作" fixed="right" width="170">
            <template #default="{ row }">
              <el-button v-if="row.orderStatus === 'PAID' && row.pickStatus === 'NOT_STARTED'" link type="primary" :disabled="saving" @click="changePick(row, 'start')">开始拣货</el-button>
              <el-button v-if="row.orderStatus === 'PAID' && row.pickStatus === 'IN_PROGRESS'" link type="primary" :disabled="saving" @click="changePick(row, 'complete')">完成拣货</el-button>
              <el-button link @click="printPick(row.orderId)">打印拣货单</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
      <template v-else>
        <div class="hx-toolbar"><p>客户售后由经销商审核后，再关联对应的公司批发订单与售后。两侧状态分别保留。</p><el-button type="primary" @click="openLink()">新增关联</el-button></div>
        <el-table :data="aftersaleLinks" border stripe empty-text="当前商城尚无直发售后关联">
          <el-table-column prop="customerRefundId" label="客户售后单" min-width="210" />
          <el-table-column prop="customerOrderId" label="客户订单" min-width="210" />
          <el-table-column label="客户售后状态" min-width="130"><template #default="{ row }">{{ labels[row.customerRefundStatus] || row.customerRefundStatus || '—' }}</template></el-table-column>
          <el-table-column prop="wholesaleOrderId" label="公司批发订单" min-width="210" />
          <el-table-column prop="wholesaleRefundId" label="公司批发售后" min-width="210" />
          <el-table-column label="批发售后状态" min-width="130"><template #default="{ row }">{{ labels[row.wholesaleRefundStatus] || row.wholesaleRefundStatus || '—' }}</template></el-table-column>
          <el-table-column prop="skuId" label="商品 SKU" min-width="130" />
          <el-table-column prop="qty" label="关联数量" min-width="100" />
          <el-table-column label="关联时间" min-width="180"><template #default="{ row }">{{ businessDateTime('created_at', row.createdAt) }}</template></el-table-column>
          <el-table-column label="操作" fixed="right" width="190"><template #default="{ row }"><el-button v-if="!row.wholesaleRefundId && eligibleCustomerRefund({ status: row.customerRefundStatus })" link type="primary" @click="openLink(row)">补关联售后</el-button><el-button v-else-if="row.wholesaleRefundId && row.wholesaleShopId" link type="primary" @click="viewWholesaleRefund(row)">查看公司售后</el-button><span v-else>暂不可补</span></template></el-table-column>
        </el-table>
      </template>
    </section>
    <el-dialog v-model="linkDialog" :show-close="!saving" :close-on-press-escape="!saving" title="关联公司批发售后" width="min(620px, 95vw)" :close-on-click-modal="false">
      <el-form label-position="top" :disabled="saving" @submit.prevent="saveLink">
        <el-form-item label="已受理的客户售后单" required>
          <el-select v-model="linkForm.customerRefundId" filterable :disabled="linkExisting" style="width:100%" placeholder="选择客户售后单" @change="loadCandidates">
            <el-option v-for="refund in eligibleRefunds" :key="refund.id" :value="refund.id" :label="`${refund.id} · ${refund.order_id} · ${refund.status}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="对应公司批发订单编号" required>
          <el-input v-if="linkExisting" v-model="linkForm.wholesaleOrderId" disabled />
          <el-select v-else v-model="linkForm.wholesaleOrderId" filterable :loading="candidateLoading" style="width:100%" placeholder="选择收货人、SKU 和数量核对后的采购单">
            <el-option v-for="order in wholesaleCandidates" :key="order.wholesaleOrderId" :value="order.wholesaleOrderId" :label="`${order.wholesaleOrderId} · ${order.skuId} · 可关联 ${order.availableQty} 件`" />
          </el-select>
        </el-form-item>
        <el-form-item :label="linkExisting ? '公司批发售后编号' : '公司批发售后编号（可后续补关联）'" :required="linkExisting"><el-input v-model.trim="linkForm.wholesaleRefundId" maxlength="100" /></el-form-item>
        <el-alert title="先关联客户售后与公司批发订单。经销商在小程序对该批发订单申请售后，公司审核后在此补售后编号；系统会核对商城、SKU 与数量。" type="info" :closable="false" />
      </el-form>
      <template #footer><el-button :disabled="saving" @click="linkDialog = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="candidateLoading" @click="saveLink">确认关联</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listShops, query } from '@/api/hexu'
import { completePick, createAftersaleLink, listAftersaleCandidates, listAftersaleLinks, listPickOrders, pickPrintData, startPick, trackingConfiguration } from '@/api/hexu/compliance'
import { eligibleCustomerRefund, printableAddress, printableRecipient } from '../compliance/model'
import { labels } from '../modules'
import { businessDateTime } from '../workspace-model'

const shops = ref([])
const router = useRouter()
const shopId = ref(null)
const tab = ref('pick')
const pickOrders = ref([])
const aftersaleLinks = ref([])
const refunds = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const trackingConfig = ref(null)
const trackingError = ref('')
const linkDialog = ref(false)
const linkExisting = ref(false)
const linkForm = ref({})
const wholesaleCandidates = ref([])
const candidateLoading = ref(false)
let candidateRequest = 0
let loadRequest = 0, lastShop, lastTab
const eligibleRefunds = computed(() => refunds.value.filter(eligibleCustomerRefund))
const pickStatusLabel = status => ({ NOT_STARTED: '待拣货', IN_PROGRESS: '拣货中', COMPLETED: '已完成' }[status] || status || '待拣货')
const pickStatusType = status => ({ NOT_STARTED: 'info', IN_PROGRESS: 'warning', COMPLETED: 'success' }[status] || 'info')

async function load() {
  if (shopId.value == null) return
  const requestId = ++loadRequest
  const selectedShop = shopId.value
  const selectedTab = tab.value
  if (selectedShop !== lastShop || selectedTab !== lastTab) {
    linkDialog.value = false
    candidateRequest++
    candidateLoading.value = false
    wholesaleCandidates.value = []
  }
  lastShop = selectedShop
  lastTab = selectedTab
  loading.value = true
  error.value = ''
  trackingConfig.value = null
  trackingError.value = ''
  pickOrders.value = []
  aftersaleLinks.value = []
  refunds.value = []
  try {
    // 轨迹配置与业务数据并行读取；配置读取失败不伪装成“尚未配置”。
    const businessRequest = selectedTab === 'pick'
      ? listPickOrders(selectedShop)
      : Promise.all([listAftersaleLinks(selectedShop), query('resources/refunds', selectedShop)])
    const [configuration, business] = await Promise.allSettled([trackingConfiguration(selectedShop), businessRequest])
    if (requestId !== loadRequest) return
    if (configuration.status === 'fulfilled') trackingConfig.value = configuration.value.data ?? null
    else trackingError.value = '承运商轨迹配置读取失败，配置状态未知，请重试'
    if (business.status === 'rejected') throw business.reason
    if (selectedTab === 'pick') pickOrders.value = business.value.data || []
    else {
      aftersaleLinks.value = business.value[0].data || []
      refunds.value = business.value[1].data || []
    }
  } catch (e) {
    if (requestId === loadRequest) {
      error.value = e.message || '数据读取失败'
      linkDialog.value = false; candidateRequest++; wholesaleCandidates.value = []
    }
  } finally {
    if (requestId === loadRequest) loading.value = false
  }
}

async function changePick(row, operation) {
  if (saving.value) return
  const selectedShop = shopId.value
  try {
    await ElMessageBox.confirm(operation === 'start' ? '确认开始拣货？' : '已核对商品及数量，确认完成拣货？', '订单拣货')
  } catch { return }
  if (selectedShop !== shopId.value) { ElMessage.warning('商城已切换，请重新选择当前商城订单'); return }
  saving.value = true
  try {
    if (operation === 'start') await startPick(row.orderId)
    else await completePick(row.orderId)
    ElMessage.success('拣货状态已更新')
    await load()
  } catch (e) {
    ElMessage.error(e.message || '拣货操作失败')
  } finally {
    saving.value = false
  }
}

async function printPick(orderId) {
  const popup = window.open('', '_blank', 'width=850,height=700')
  if (!popup) {
    ElMessage.error('浏览器阻止打印窗口，请允许此站点打开弹窗')
    return
  }
  try {
    const data = (await pickPrintData(orderId)).data
    renderPrint(popup.document, data)
    popup.focus()
    popup.print()
  } catch (e) {
    popup.close()
    ElMessage.error(e.message || '拣货单读取失败')
  }
}

function renderPrint(doc, data) {
  doc.title = `拣货单 ${data.orderId}`
  const style = doc.createElement('style')
  style.textContent = 'body{font:14px/1.6 Arial,sans-serif;padding:28px;color:#222}h1{font-size:22px}dl{display:grid;grid-template-columns:120px 1fr;gap:6px 10px}dt{font-weight:bold}dd{margin:0}table{width:100%;border-collapse:collapse;margin-top:22px}th,td{border:1px solid #888;padding:8px;text-align:left}th{background:#eee}@page{size:A4;margin:16mm}'
  doc.head.append(style)
  const add = (parent, tag, value) => { const node = doc.createElement(tag); node.textContent = String(value ?? ''); parent.append(node); return node }
  add(doc.body, 'h1', '订单拣货单')
  const details = doc.createElement('dl')
  const address = printableAddress(data.address)
  for (const [label, value] of [['订单编号', data.orderId], ['商城', data.shopName], ['收件人', data.recipient || printableRecipient(data.address)], ['收货地址', address], ['承运商', data.carrier], ['运单号', data.tracking], ['拣货状态', pickStatusLabel(data.pickStatus)], ['打印时间', businessDateTime('created_at', data.printedAt)]]) {
    add(details, 'dt', label)
    add(details, 'dd', value || '—')
  }
  doc.body.append(details)
  const table = doc.createElement('table')
  const head = doc.createElement('tr')
  for (const label of ['商品 SKU', '商品名称', '数量']) add(head, 'th', label)
  table.append(head)
  for (const item of data.items || []) {
    const row = doc.createElement('tr')
    for (const value of [item.skuId, item.name, item.qty]) add(row, 'td', value)
    table.append(row)
  }
  doc.body.append(table)
}

function openLink(row = null) {
  candidateRequest++
  candidateLoading.value = false
  linkExisting.value = !!row
  linkForm.value = { customerRefundId: row?.customerRefundId || '', wholesaleOrderId: row?.wholesaleOrderId || '', wholesaleRefundId: '' }
  wholesaleCandidates.value = []
  linkDialog.value = true
}

async function loadCandidates(customerRefundId) {
  const requestId = ++candidateRequest
  linkForm.value.wholesaleOrderId = ''
  wholesaleCandidates.value = []
  if (!customerRefundId || linkExisting.value) { candidateLoading.value = false; return }
  candidateLoading.value = true
  try {
    const response = await listAftersaleCandidates(shopId.value, customerRefundId)
    if (requestId !== candidateRequest) return
    wholesaleCandidates.value = response.data || []
    if (!wholesaleCandidates.value.length) ElMessage.warning('没有收货人与商品匹配、且数量充足的已付款直发采购单')
  } catch (e) {
    if (requestId === candidateRequest) ElMessage.error(e.message || '候选采购单读取失败')
  } finally {
    if (requestId === candidateRequest) candidateLoading.value = false
  }
}

function viewWholesaleRefund(row) {
  router.push({ path: '/hexu/refunds', query: { shopId: row.wholesaleShopId, refundId: row.wholesaleRefundId } })
}

async function saveLink() {
  if (saving.value || candidateLoading.value) return
  if (!linkForm.value.customerRefundId || !linkForm.value.wholesaleOrderId?.trim() || (linkExisting.value && !linkForm.value.wholesaleRefundId?.trim())) {
    ElMessage.warning('请填写客户售后与对应公司批发订单')
    return
  }
  if (!linkExisting.value && !wholesaleCandidates.value.some(order => order.wholesaleOrderId === linkForm.value.wholesaleOrderId)) {
    ElMessage.warning('请选择已核对收货人、商品和数量的候选采购单')
    return
  }
  saving.value = true
  try {
    await createAftersaleLink({ shopId: shopId.value, ...linkForm.value })
    ElMessage.success('直发售后关联已建立')
    linkDialog.value = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '关联失败')
  } finally {
    saving.value = false
  }
}

async function initialize() {
  try {
    const response = await listShops()
    // 管理范围错误不能显示为“没有待拣货订单”。
    if (!Array.isArray(response.data)) throw new Error('管理范围格式无效')
    if (!response.data.length) throw new Error('当前账号没有可管理的商城')
    shops.value = response.data
    shopId.value = shops.value[0]?.id ?? null
    await load()
  } catch (e) {
    shops.value = []
    shopId.value = null
    error.value = e.message || '无法获取商城管理范围'
  }
}

function refresh() { return shopId.value == null ? initialize() : load() }
onMounted(initialize)
</script>

<style scoped>
.hx-fulfillment{padding:28px;background:#f4f6f2;min-height:calc(100vh - 90px);--el-color-primary:#155641;--el-color-primary-light-3:#50816c;--el-color-primary-light-9:#eff5ef;--el-border-radius-base:7px}.hx-header,.hx-toolbar{display:flex;align-items:center;justify-content:space-between;gap:20px}.hx-header{margin-bottom:28px}.hx-eyebrow{font-size:10px;letter-spacing:2px;color:#869581}.hx-header h1{font-size:26px;font-weight:600;color:#203e2c;margin:10px 0}.hx-header p,.hx-toolbar p{font-size:13px;color:#627262;margin:0}.hx-tools{display:flex;gap:10px}.hx-section{background:#fdfefd;border:1px solid #e3e9df;border-radius:12px;padding:22px}.hx-alert,.hx-toolbar{margin-bottom:20px}.hx-fulfillment :deep(.el-table th){background:#f0f4ed;color:#68805c;font-weight:500}.hx-fulfillment :deep(.hx-pick-order-id .cell){white-space:normal;overflow-wrap:anywhere;line-height:1.4}
@media(max-width:800px){.hx-header,.hx-toolbar{align-items:flex-start;flex-direction:column}.hx-section{padding:14px}}@media(max-width:600px){.hx-fulfillment{padding:16px}.hx-header h1{font-size:23px}.hx-tools{flex-wrap:wrap}}
</style>
