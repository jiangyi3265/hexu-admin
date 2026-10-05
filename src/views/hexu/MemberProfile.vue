<template>
  <section class="member-profile" v-loading="loading">
    <h3>会员资料</h3>
    <el-alert v-if="error" :title="error" type="warning" :closable="false" show-icon />
    <template v-else-if="data">
      <el-avatar :size="72" :src="avatar" class="member-avatar">{{ (data.member?.name || '会员').slice(0, 1) }}</el-avatar>
      <el-descriptions :column="1" border>
        <el-descriptions-item v-for="row in rows" :key="row.label" :label="row.label">{{ row.value }}</el-descriptions-item>
      </el-descriptions>
    </template>
  </section>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { memberProfile } from '@/api/hexu'
import { profileAvatarUrl, profileRows } from './workspace-model'

const props = defineProps({ memberId: { type: [Number, String], required: true }, shopId: { type: Number, required: true } })
const data = ref(null), error = ref(''), loading = ref(false)
let requestId = 0
const avatar = computed(() => profileAvatarUrl(data.value?.profile?.avatarId, import.meta.env.VITE_APP_BASE_API))
const rows = computed(() => profileRows(data.value))
watch(() => [props.memberId, props.shopId], async ([memberId, shopId]) => {
  const current = ++requestId
  data.value = null
  error.value = ''
  loading.value = true
  try {
    const response = await memberProfile(memberId, shopId)
    if (current === requestId) data.value = response.data
  } catch (e) {
    if (current === requestId) error.value = e.message || '会员资料读取失败'
  } finally {
    if (current === requestId) loading.value = false
  }
}, { immediate: true })
onUnmounted(() => { requestId++ })
</script>

<style scoped>
.member-profile{margin-bottom:24px;min-height:90px}.member-profile h3{font-size:15px;color:#203e2c;margin-top:0}.member-avatar{margin-bottom:16px;background:#eaf1e8;color:#315b43}.member-profile :deep(.el-descriptions__content){white-space:pre-wrap;overflow-wrap:anywhere}
</style>
