<template>
  <div class="structured-detail">
    <template v-if="Array.isArray(content)">
      <span v-if="!content.length">—</span>
      <span v-else-if="content.every(isSimple) && !imageCollection">{{ displayArray(content) }}</span>
      <div v-else v-for="(item, index) in content" :key="index" class="structured-detail-item">
        <strong>{{ imageCollection ? '图片' : '第' }} {{ index + 1 }} {{ imageCollection ? '' : '项' }}</strong>
        <StructuredDetail :value="item" :field-key="fieldKey" :parent-key="imageCollection?fieldKey:parentKey" :field-labels="fieldLabels" :labels="labels" />
      </div>
    </template>
    <template v-else-if="content && typeof content === 'object'">
      <span v-if="!Object.keys(content).length">—</span>
      <div v-else v-for="(item, key) in content" :key="key" class="structured-detail-row">
        <span class="structured-detail-label">{{ label(key) }}</span>
        <StructuredDetail :value="item" :field-key="key" :parent-key="fieldKey" :field-labels="fieldLabels" :labels="labels" />
      </div>
    </template>
    <ProductImagePreview v-else-if="imageValue" :asset="content" :alt="label(fieldKey)" />
    <span v-else>{{ display(content) }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { detailFieldLabel, detailFieldValue, formatCurrency, productPreviewAsset } from './workspace-model'
import ProductImagePreview from './ProductImagePreview.vue'

const props = defineProps({
  value: { required: true },
  fieldKey: { type: String, default: '' },
  parentKey: { type: String, default: '' },
  fieldLabels: { type: Object, default: () => ({}) },
  labels: { type: Object, default: () => ({}) }
})

const nestedLabels = {
  image: '图片', icon: '图标', subtitle: '副标题', buttonText: '按钮文字', target: '跳转目标',
  sort: '排序', enabled: '已启用', skuId: '商品编号', unit_price: '单价（分）',
  refunded_qty: '已退数量', paid: '实付（分）', refunded_paid: '已退金额（分）',
  threshold: '门槛（分）', rateBps: '折扣基点', uploads: '附件',
  phone: '联系电话', spec: '规格', asset: '商品图片', shippedAt: '发货时间',
  autoReceiveDays: '自动收货天数', buyerAgentId: '客户代理编号', linkCampaign: '联动活动',
  group: '拼团', invitation: '邀请活动', prices: '各职级价格（分）', bps: '分红基点',
  rank: '职级', promotions: '促销明细', pointsScope: '积分归属', pointsPerYuan: '每元积分',
  ruleId: '规则编号', agentId: '代理编号', memberId: '会员编号', boxSize: '每箱数量',
  minBoxes: '最低箱数', merchant: '收款商户', pointsExpiryDays: '积分有效天数',
  pointsRate: '平台积分倍率', shopPointsRate: '商城积分倍率',
  shopPointsExpiryDays: '商城积分有效天数', reviewPoints: '评价积分',
  shopReviewPoints: '商城评价积分', afterSalesDays: '售后期限（天）',
  blocks: '页面内容', layout: '布局', nav: '导航', footer: '页脚'
}
const contextLabels = {
  address_json: { name: '收货人', region: '所在地区', province: '省份', city: '城市', district: '区县', detail: '详细地址', phone: '联系电话' },
  shipping_json: { carrier: '承运商', tracking: '物流单号', shippedAt: '发货时间', autoReceiveDays: '自动收货天数' },
  snapshot_json: { asset: '下单时商品图片', prices: '各职级价格', bps: '各职级分红比例', rank: '下单时身份' },
  items: { id: '订单明细编号', unit_price: '单价', paid: '实付', refunded_paid: '已退金额', snapshot_json: '下单快照' }
}
const content = computed(() => {
  if (typeof props.value !== 'string' || !props.fieldKey.endsWith('_json')) return props.value
  try {
    const parsed = JSON.parse(props.value)
    return parsed && typeof parsed === 'object' ? parsed : props.value
  } catch { return props.value }
})
const isSimple = item => item === null || typeof item !== 'object'
const imageCollection = computed(() => ['gallery', 'images', 'photos'].includes(props.fieldKey))
const imageValue = computed(() => typeof content.value === 'string' &&
  (['asset', 'image', 'icon', 'cover', 'logo', 'banner', 'confirmationFile', 'avatarId'].includes(props.fieldKey) ||
    ['assets', 'gallery', 'images', 'photos'].includes(props.parentKey)) &&
  !!productPreviewAsset(content.value))
const rankName = value => ({ 0: '普通客户', 1: '云代理', 2: '分货中心', 3: '总代理' })[value] || value
function display(item) {
  if (item != null && props.parentKey === 'items' && ['unit_price', 'paid', 'refunded_paid'].includes(props.fieldKey) && Number.isFinite(Number(item))) return formatCurrency(item)
  if (props.fieldKey === 'pointsScope' && item != null && item !== '') return Number(item) === 0 ? '平台积分' : `商城积分（商城编号 ${item}）`
  if (props.fieldKey === 'rank' && item != null) return rankName(item)
  if (/(?:At|Time)$/.test(props.fieldKey) && typeof item === 'number' && item > 1e11 && item < 1e14) return new Date(item).toLocaleString('zh-CN', { hour12: false })
  return detailFieldValue(props.fieldKey, item, props.labels)
}
function displayArray(items) {
  if (props.fieldKey === 'prices') return items.map((value, index) => `${['零售', '云代理', '分货中心', '总代理'][index] || `职级${index}`} ${value == null ? '—' : formatCurrency(value)}`).join(' · ')
  if (props.fieldKey === 'bps') return items.map((value, index) => `${rankName(index)} ${value == null ? '—' : Number(value) / 100 + '%'}`).join(' · ')
  return items.map(display).join('、')
}
const label = key => contextLabels[props.fieldKey]?.[key] || props.fieldLabels[key] || nestedLabels[key] || detailFieldLabel(key)
</script>

<style scoped>
.structured-detail{min-width:0;overflow-wrap:anywhere;white-space:pre-wrap}
.structured-detail-row{display:grid;grid-template-columns:minmax(130px,28%) minmax(0,1fr);gap:12px;padding:8px 0;border-bottom:1px solid #ebeef5}
.structured-detail-row:last-child{border-bottom:0}
.structured-detail-label{color:#606266}
.structured-detail-item{padding:12px 16px;margin:8px 0;border:1px solid #e4e7ed;border-radius:8px;background:#fff}
.structured-detail-item>strong{display:block;margin-bottom:6px}
@media(max-width:600px){.structured-detail-row{grid-template-columns:1fr;gap:3px}}
</style>
