<template>
  <div class="structured-detail">
    <template v-if="Array.isArray(content)">
      <span v-if="!content.length">—</span>
      <span v-else-if="content.every(isSimple)">{{ content.map(item => display(item)).join('、') }}</span>
      <div v-else v-for="(item, index) in content" :key="index" class="structured-detail-item">
        <strong>第 {{ index + 1 }} 项</strong>
        <StructuredDetail :value="item" :field-key="fieldKey" :field-labels="fieldLabels" :labels="labels" />
      </div>
    </template>
    <template v-else-if="content && typeof content === 'object'">
      <span v-if="!Object.keys(content).length">—</span>
      <div v-else v-for="(item, key) in content" :key="key" class="structured-detail-row">
        <span class="structured-detail-label">{{ label(key) }}</span>
        <StructuredDetail :value="item" :field-key="key" :field-labels="fieldLabels" :labels="labels" />
      </div>
    </template>
    <span v-else>{{ display(content) }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { detailFieldLabel, detailFieldValue } from './workspace-model'

const props = defineProps({
  value: { required: true },
  fieldKey: { type: String, default: '' },
  fieldLabels: { type: Object, default: () => ({}) },
  labels: { type: Object, default: () => ({}) }
})

const nestedLabels = {
  image: '图片', icon: '图标', subtitle: '副标题', buttonText: '按钮文字', target: '跳转目标',
  sort: '排序', enabled: '已启用', skuId: '商品编号', unit_price: '单价（分）',
  refunded_qty: '已退数量', paid: '实付（分）', refunded_paid: '已退金额（分）',
  threshold: '门槛（分）', rateBps: '折扣基点', uploads: '附件',
  phone: '联系电话', spec: '规格', asset: '图片资源', shippedAt: '发货时间戳',
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
const content = computed(() => {
  if (typeof props.value !== 'string' || !props.fieldKey.endsWith('_json')) return props.value
  try {
    const parsed = JSON.parse(props.value)
    return parsed && typeof parsed === 'object' ? parsed : props.value
  } catch { return props.value }
})
const isSimple = item => item === null || typeof item !== 'object'
const display = item => detailFieldValue(props.fieldKey, item, props.labels)
const label = key => props.fieldLabels[key] || nestedLabels[key] || detailFieldLabel(key)
</script>

<style scoped>
.structured-detail{min-width:0;overflow-wrap:anywhere;white-space:pre-wrap}
.structured-detail-row{display:grid;grid-template-columns:minmax(100px,35%) minmax(0,1fr);gap:12px;padding:7px 0;border-bottom:1px solid #ebeef5}
.structured-detail-row:last-child{border-bottom:0}
.structured-detail-label{color:#606266}
.structured-detail-item{padding:10px 12px;margin:8px 0;border:1px solid #e4e7ed;border-radius:6px}
.structured-detail-item>strong{display:block;margin-bottom:6px}
@media(max-width:600px){.structured-detail-row{grid-template-columns:1fr;gap:3px}}
</style>
