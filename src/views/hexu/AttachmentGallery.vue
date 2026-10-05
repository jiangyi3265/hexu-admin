<template>
  <div v-if="ids?.length" class="attachment-gallery">
    <el-button v-for="(id, index) in ids" :key="id" :loading="loadingId === id" @click="preview(id)">查看图片 {{ index + 1 }}</el-button>
  </div>
  <el-dialog v-model="visible" title="业务资料图片" width="min(850px,95vw)" append-to-body @closed="clear">
    <img v-if="url" :src="url" alt="已上传的业务资料" />
  </el-dialog>
</template>

<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { attachment } from '@/api/hexu'

const props = defineProps({ ids: { type: Array, default: () => [] } })
const visible = ref(false), url = ref(''), loadingId = ref('')
let requestId = 0
function clear() { if (url.value) URL.revokeObjectURL(url.value); url.value = '' }
async function preview(id) {
  const current = ++requestId
  loadingId.value = id
  try {
    const blob = await attachment(id)
    if (current !== requestId) return
    if (!blob.type.startsWith('image/')) throw new Error('资料不是可预览的图片')
    clear()
    url.value = URL.createObjectURL(blob)
    visible.value = true
  } catch (e) {
    if (current === requestId) ElMessage.error(e.message || '图片读取失败')
  } finally { if (current === requestId) loadingId.value = '' }
}
onUnmounted(() => { requestId++; clear() })
watch(() => props.ids, () => { requestId++; loadingId.value = ''; visible.value = false; clear() }, { deep: true })
</script>

<style scoped>
.attachment-gallery{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.attachment-gallery .el-button{margin-left:0}img{max-width:100%;max-height:75vh;display:block;margin:auto}
</style>
