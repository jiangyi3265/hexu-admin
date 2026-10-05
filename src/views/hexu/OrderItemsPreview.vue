<template>
  <section v-if="Array.isArray(items) && items.length" class="order-items-preview">
    <h3>商品明细</h3>
    <div v-for="(line, index) in items" :key="line.id || index" class="order-line">
      <ProductImagePreview v-if="line.asset" :asset="line.asset" />
      <span v-else class="image-missing">商品图片未记录</span>
      <div class="line-copy">
        <strong>{{ line.name || line.sku_id || '商品' }}</strong>
        <span>{{ line.spec || '规格未记录' }} · 数量 ×{{ line.qty }}</span>
        <span>单价 {{ price(line.unit_price) }} · 实付 {{ price(line.paid) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import ProductImagePreview from './ProductImagePreview.vue'

defineProps({ items: { type: Array, default: () => [] } })

const price = value => value == null || !Number.isFinite(Number(value))
  ? '—'
  : `¥${(Number(value) / 100).toFixed(2)}`
</script>

<style scoped>
.order-items-preview { margin: 18px 0; }
.order-items-preview h3 { margin: 0 0 12px; font-size: 15px; }
.order-line { display: flex; gap: 16px; padding: 12px 0; border-top: 1px solid #ebeef0; }
.order-line :deep(.product-image-preview) { margin: 0; flex: none; }
.order-line :deep(.product-image-preview img), .image-missing { width: 96px; height: 96px; }
.image-missing { display: grid; place-items: center; flex: none; border-radius: 8px; background: #f4f6f2; color: #909399; font-size: 12px; }
.line-copy { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding-top: 4px; color: #606266; font-size: 13px; }
.line-copy strong { color: #303133; font-size: 14px; }
</style>
