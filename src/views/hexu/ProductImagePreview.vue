<template>
  <div v-if="asset" class="product-image-preview">
    <img v-if="src && !failed" :src="src" alt="商品封面" @error="failed = true" />
    <span v-else>商品封面加载失败</span>
  </div>
</template>

<script setup>
import {onUnmounted, ref, watch} from 'vue'
import {attachment, orderCover} from '@/api/hexu'
import {productPreviewAsset} from './workspace-model'

const props = defineProps({asset: {type: String, default: ''}})
const src = ref('')
const failed = ref(false)
let blobUrl = ''
let requestId = 0

function clear() {
  if (blobUrl) URL.revokeObjectURL(blobUrl)
  blobUrl = ''
  src.value = ''
}

watch(() => props.asset, async value => {
  const current = ++requestId
  clear()
  failed.value = false
  if (!value) return
  const asset = productPreviewAsset(value)
  if (!asset) { failed.value = true; return }
  if (asset.type === 'ui') {
    src.value = `${import.meta.env.VITE_APP_BASE_API}/hexu/app/ui-assets/${encodeURIComponent(asset.id)}`
    return
  }
  try {
    const blob = asset.type === 'orderCover'
      ? await orderCover(asset.orderId, asset.lineId)
      : await attachment(asset.id)
    if (current !== requestId) return
    if (!(blob instanceof Blob) || !blob.type.startsWith('image/')) throw new Error('商品封面不是图片')
    blobUrl = URL.createObjectURL(blob)
    src.value = blobUrl
  } catch {
    if (current === requestId) failed.value = true
  }
}, {immediate: true})

onUnmounted(() => { requestId++; clear() })
</script>

<style scoped>
.product-image-preview { margin: 8px 0; color: #909399; font-size: 13px; }
.product-image-preview img { display: block; width: 128px; height: 128px; border-radius: 8px; object-fit: cover; }
</style>
