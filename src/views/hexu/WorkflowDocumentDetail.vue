<template>
  <div class="workflow-detail">
    <el-descriptions :column="1" :label-width="120" border>
      <el-descriptions-item label="单据编号">{{ record.id }}</el-descriptions-item>
      <el-descriptions-item label="所属商城">{{ record.shop_id }}</el-descriptions-item>
      <el-descriptions-item :label="record.kind === 'system_parameter' ? '记录会员' : '申请会员'">{{ record.member_id || '—' }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ labels[record.status] || record.status }}</el-descriptions-item>
      <template v-if="record.kind === 'agent_application'">
        <el-descriptions-item label="申请人">{{ body.name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="手机号码">{{ maskedPhone }}</el-descriptions-item>
        <el-descriptions-item label="申请职级">{{ rankName }}</el-descriptions-item>
        <el-descriptions-item label="所在县域">{{ body['所在县域'] || '—' }}</el-descriptions-item>
        <el-descriptions-item label="填写的推荐人">{{ body['推荐人'] || '—' }}</el-descriptions-item>
        <el-descriptions-item label="上级代理编号">{{ body.parentId || '未记录' }}</el-descriptions-item>
        <el-descriptions-item label="协议版本">{{ body.agreementVersion || '—' }}</el-descriptions-item>
        <el-descriptions-item label="协议编号">{{ body.agreementPolicyId || '—' }}</el-descriptions-item>
        <el-descriptions-item label="资料附件">{{ uploads.length }} 张{{ uploads.length ? '（点击上方“查看资料”核对）' : '' }}</el-descriptions-item>
      </template>
      <template v-else-if="record.kind === 'system_parameter'">
        <el-descriptions-item label="参数名称">{{ body.name || '系统参数' }}</el-descriptions-item>
        <el-descriptions-item label="待支付有效期">{{ body.unpaidMinutes ?? '—' }} 分钟</el-descriptions-item>
        <el-descriptions-item label="自动收货期限">{{ body.autoReceiveDays ?? '—' }} 天</el-descriptions-item>
        <el-descriptions-item label="售后申请期限">{{ body.afterSalesDays ?? '—' }} 天</el-descriptions-item>
        <el-descriptions-item v-for="item in notices" :key="item[0]" :label="item[1]">{{ body[item[0]] === true ? '开启' : body[item[0]] === false ? '关闭' : '—' }}</el-descriptions-item>
      </template>
      <el-descriptions-item label="审核意见">{{ record.review_note || '—' }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ detailFieldValue('created_at', record.created_at) }}</el-descriptions-item>
      <el-descriptions-item label="更新时间">{{ detailFieldValue('updated_at', record.updated_at) }}</el-descriptions-item>
    </el-descriptions>
    <section v-if="record.kind === 'stocktake'" class="stocktake-items">
      <h3>盘点商品（{{ items.length }}）</h3>
      <article v-for="(item, index) in items" :key="item.skuId || index">
        <strong>{{ item.name || '未记录商品名称' }}</strong>
        <div class="sku-id">商品编号：{{ item.skuId || '—' }}</div>
        <div class="stocktake-values">
          <span>账面可售 <b>{{ item.available ?? '—' }}</b></span>
          <span>账面锁定 <b>{{ item.locked ?? '—' }}</b></span>
          <span>实盘 <b>{{ item.actual ?? '—' }}</b></span>
          <span>差异 <b>{{ signed(item.delta) }}</b></span>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { labels } from './modules'
import { detailFieldValue, selectedAttachmentIds } from './workspace-model'

const props = defineProps({ record: { type: Object, required: true } })
const body = computed(() => props.record.body && typeof props.record.body === 'object' ? props.record.body : {})
const uploads = computed(() => selectedAttachmentIds(props.record))
const items = computed(() => Array.isArray(body.value.items) ? body.value.items : [])
const maskedPhone = computed(() => String(body.value.phone || '').replace(/^(\d{3})\d+(\d{4})$/, '$1****$2') || '—')
const rankName = computed(() => ({ 1: '云代理', 2: '分货中心', 3: '总代理' })[body.value.rank] || body.value['拟申请职级'] || '—')
const notices = [['notifyPaid', '支付站内通知'], ['notifyShipped', '发货站内通知'], ['notifyRefund', '售后站内通知'], ['notifyWithdrawal', '提现站内通知'], ['notifyInventory', '库存站内通知']]
const signed = value => value == null ? '—' : Number(value) > 0 ? `+${value}` : String(value)
</script>

<style scoped>
.workflow-detail{min-width:0}.workflow-detail :deep(.el-descriptions__content){overflow-wrap:anywhere;white-space:pre-wrap}.stocktake-items{margin-top:20px}.stocktake-items h3{font-size:15px;margin:0 0 12px}.stocktake-items article{border:1px solid #dcdfe6;border-radius:8px;padding:14px;margin-bottom:12px;overflow-wrap:anywhere}.stocktake-items strong{display:block;font-size:14px}.sku-id{color:#606266;font-size:12px;margin:5px 0 12px}.stocktake-values{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.stocktake-values span{background:#f5f7fa;border-radius:6px;padding:8px;font-size:12px}.stocktake-values b{display:block;font-size:15px;margin-top:5px}@media(max-width:600px){.stocktake-values{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
