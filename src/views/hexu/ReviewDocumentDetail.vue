<template>
  <div class="review-detail">
    <el-descriptions :column="1" :label-width="120" border>
      <el-descriptions-item label="评价编号">{{ record.id }}</el-descriptions-item>
      <el-descriptions-item label="所属商城">{{ record.shop_id }}</el-descriptions-item>
      <el-descriptions-item label="评价会员">{{ record.member_id }}</el-descriptions-item>
      <el-descriptions-item label="评价类型">{{ appended ? '追评' : '首评' }}</el-descriptions-item>
      <el-descriptions-item label="审核状态">{{ labels[record.status] || record.status }}</el-descriptions-item>
      <el-descriptions-item label="原订单">{{ body.orderId || '—' }}</el-descriptions-item>
      <el-descriptions-item label="商品">
        {{ productName || '商品名称未记录' }}<small v-if="body.skuId">（{{ body.skuId }}）</small>
      </el-descriptions-item>
      <el-descriptions-item v-if="appended" label="关联首评">{{ body.parentId || '—' }}</el-descriptions-item>
      <el-descriptions-item v-else label="星级">{{ '★'.repeat(stars) }}{{ '☆'.repeat(5 - stars) }}（{{ stars }} 星）</el-descriptions-item>
      <el-descriptions-item v-if="!appended" label="匿名评价">{{ body.anonymous ? '是' : '否' }}</el-descriptions-item>
      <el-descriptions-item label="评价正文"><div class="review-content">{{ body.content || '—' }}</div></el-descriptions-item>
      <el-descriptions-item label="审核人">{{ record.reviewer || '—' }}</el-descriptions-item>
      <el-descriptions-item label="审核意见"><div class="review-content">{{ record.review_note || '—' }}</div></el-descriptions-item>
      <el-descriptions-item label="提交时间">{{ detailFieldValue('created_at', record.created_at) }}</el-descriptions-item>
      <el-descriptions-item label="更新时间">{{ detailFieldValue('updated_at', record.updated_at) }}</el-descriptions-item>
    </el-descriptions>
    <section v-if="uploads.length" class="review-images">
      <h3>评价图片（{{ uploads.length }}）</h3>
      <div class="review-image-grid">
        <button v-for="(id, index) in uploads" :key="id" type="button" @click="preview(id)">
          <img v-if="imageUrls[id]" :src="imageUrls[id]" :alt="`评价图片 ${index + 1}`" />
          <span v-else>{{ imageErrors[id] ? '图片加载失败，点击重试' : '图片加载中' }}</span>
        </button>
      </div>
    </section>
    <el-dialog v-model="imageDialog" title="评价图片" width="min(850px,95vw)" append-to-body>
      <img v-if="previewUrl" class="review-preview" :src="previewUrl" alt="评价图片预览" />
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { attachment, detail } from '@/api/hexu'
import { labels } from './modules'
import { detailFieldValue } from './workspace-model'
import { reviewDisplay } from './review-detail-model'

const props = defineProps({ record: { type: Object, required: true } })
const display = computed(() => reviewDisplay(props.record))
const body = computed(() => display.value.body)
const appended = computed(() => display.value.appended)
const stars = computed(() => display.value.stars)
const uploads = computed(() => display.value.uploads)
const productName = ref(''), imageUrls = ref({}), imageErrors = ref({}), imageDialog = ref(false), previewUrl = ref('')
let version = 0
const pendingImages = new Map()

function clearImages() {
  for (const url of Object.values(imageUrls.value)) URL.revokeObjectURL(url)
  imageUrls.value = {}
  imageErrors.value = {}
  imageDialog.value = false
  previewUrl.value = ''
}

async function loadImage(id, current = version) {
  if (imageUrls.value[id]) return
  const key = `${current}:${id}`
  if (pendingImages.has(key)) return pendingImages.get(key)
  const request = (async () => {
    try {
      const blob = await attachment(id)
      if (current !== version) return
      if (!blob.type.startsWith('image/')) throw new Error('附件不是图片')
      imageUrls.value = { ...imageUrls.value, [id]: URL.createObjectURL(blob) }
    } catch (error) {
      if (current === version) imageErrors.value = { ...imageErrors.value, [id]: true }
    }
  })()
  pendingImages.set(key, request)
  try { await request } finally { pendingImages.delete(key) }
}

async function preview(id) {
  if (!imageUrls.value[id]) {
    await loadImage(id)
    if (!imageUrls.value[id]) return ElMessage.error('评价图片读取失败')
  }
  previewUrl.value = imageUrls.value[id]
  imageDialog.value = true
}

watch(() => props.record, async () => {
  const current = ++version
  clearImages()
  productName.value = ''
  const orderId = body.value.orderId, skuId = body.value.skuId
  if (orderId && skuId) {
    try {
      const response = await detail(orderId)
      if (current === version) productName.value = response.data?.items?.find(item => (item.sku_id || item.id) === skuId)?.name || ''
    } catch { /* 历史订单不可读时仍展示原 SKU 编号。 */ }
  }
  if (current === version) await Promise.all(uploads.value.map(id => loadImage(id, current)))
}, { immediate: true })

onUnmounted(() => { version++; clearImages() })
</script>

<style scoped>
.review-detail{min-width:0}.review-detail :deep(.el-descriptions__content){overflow-wrap:anywhere}.review-content{white-space:pre-wrap;overflow-wrap:anywhere}.review-images{margin-top:20px}.review-images h3{font-size:14px;margin:0 0 12px}.review-image-grid{display:flex;flex-wrap:wrap;gap:10px}.review-image-grid button{width:104px;height:104px;padding:0;border:1px solid #dcdfe6;border-radius:8px;background:#f5f7fa;cursor:pointer;overflow:hidden}.review-image-grid img{width:100%;height:100%;object-fit:cover}.review-image-grid span{display:block;padding:8px;font-size:12px;color:#606266}.review-preview{max-width:100%;max-height:75vh;display:block;margin:auto}
</style>
