<template>
  <div class="hx-compliance">
    <header class="hx-header">
      <div>
        <div class="hx-eyebrow">禾序商贸 · DISTRIBUTION OPERATIONS</div>
        <h1>商户与协议</h1>
        <p>经销商收款资料、协议版本及用户授权记录</p>
      </div>
      <div class="hx-tools">
        <el-select v-model="shopId" :disabled="saving||uploading" aria-label="选择商城" style="width:220px" @change="load">
          <el-option v-for="shop in shops" :key="shop.id" :value="shop.id" :label="shop.name" />
        </el-select>
        <el-button :loading="loading" @click="refresh">刷新数据</el-button>
      </div>
    </header>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-result v-if="error" icon="warning" title="管理范围或业务数据读取失败" :sub-title="error"><template #extra><el-button @click="refresh">重试读取</el-button></template></el-result>
    <section v-else class="hx-section" v-loading="loading">
      <el-tabs v-model="tab" :before-leave="() => !saving&&!uploading" @tab-change="load">
        <el-tab-pane label="商户开通" name="merchant" />
        <el-tab-pane label="协议发布" name="policies" />
        <el-tab-pane label="授权审计" name="consents" />
      </el-tabs>

      <template v-if="tab === 'merchant'">
        <el-alert v-if="merchant.paymentMode === 'DIRECT'" title="直营或公司批发商城使用公司直连商户。渠道凭据由服务端配置，经销商独立进件流程不适用。" type="info" :closable="false" show-icon class="hx-alert" />
        <el-alert v-if="merchant.paymentMode === 'PARTNER' && merchant.canManage === false" title="当前账号仅可查看商户状态，提交资料和补录渠道编号需由商城负责人或平台管理员操作。" type="info" :closable="false" show-icon class="hx-alert" />
        <el-alert
          v-if="merchant.paymentMode === 'PARTNER' && !merchant.paymentReady"
          title="当前商城尚未具备真实收款条件。资料提交和内部核验不能代替微信支付渠道审核；请核对商户授权、证书和服务端渠道配置。"
          type="warning" :closable="false" show-icon class="hx-alert"
        />
        <div v-if="merchant.paymentMode === 'PARTNER'" class="hx-status-grid">
          <article v-for="stage in stages" :key="stage.key">
            <span>{{ stage.label }}</span>
            <el-tag :type="statusType(merchant[stage.status])">{{ statusLabel(merchant[stage.status]) }}</el-tag>
            <small>{{ merchant[stage.reference] || '暂无渠道/申请编号' }}</small>
          </article>
        </div>
        <el-descriptions :column="2" border class="hx-details">
          <el-descriptions-item label="收款主体">{{ merchant.subjectName || '待提交' }}</el-descriptions-item>
          <el-descriptions-item :label="merchant.paymentMode === 'PARTNER' ? '子商户号' : '收款商户号'">{{ merchant.merchantNo || '待授权' }}</el-descriptions-item>
          <el-descriptions-item label="收款模式">{{ merchant.paymentMode === 'PARTNER' ? '服务商子商户' : merchant.paymentMode === 'DIRECT' ? '直连商户' : '待确认' }}</el-descriptions-item>
          <el-descriptions-item label="小程序 AppID">{{ merchant.appId || '待授权' }}</el-descriptions-item>
          <el-descriptions-item label="证书序列号">{{ merchant.certificateSerial || '待提交' }}</el-descriptions-item>
          <el-descriptions-item label="证书到期">{{ merchant.expiresAt || '待提交' }}</el-descriptions-item>
          <el-descriptions-item label="实际签约费率">{{ merchant.contractedFeeBps == null ? '待渠道确认' : `${(merchant.contractedFeeBps / 100).toFixed(2)}%` }}</el-descriptions-item>
          <el-descriptions-item label="结算周期">{{ merchant.settlementDays == null ? '待渠道确认' : `T+${merchant.settlementDays} 天` }}</el-descriptions-item>
          <el-descriptions-item label="异常说明" :span="2">{{ merchant.abnormalReason || '无' }}</el-descriptions-item>
          <el-descriptions-item v-if="merchant.rejectionReason" label="驳回原因" :span="2">{{ merchant.rejectionReason }}</el-descriptions-item>
          <el-descriptions-item label="收款准备状态" :span="2">
            <el-tag :type="merchant.paymentReady ? 'success' : 'warning'">{{ merchant.paymentReady ? '已具备收款条件' : '未就绪' }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <AttachmentGallery :ids="merchant.attachmentIds"/>
        <div v-if="merchant.paymentMode === 'PARTNER' && merchant.canManage" class="hx-actions">
          <el-button type="primary" @click="openMerchant('application')">提交进件资料</el-button>
          <el-button @click="openMerchant('authorization')">登记 AppID 授权</el-button>
          <el-button @click="openMerchant('certificate')">登记证书元数据</el-button>
        </div>
        <el-table v-if="merchant.paymentMode === 'PARTNER'" :data="stages" border empty-text="暂无审核阶段">
          <el-table-column prop="label" label="阶段" min-width="150" />
          <el-table-column label="状态" min-width="130">
            <template #default="{ row }"><el-tag :type="statusType(merchant[row.status])">{{ statusLabel(merchant[row.status]) }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" min-width="180">
            <template #default="{ row }">
              <el-button v-if="merchant.canManage && merchant[row.status] === 'PENDING' && !merchant[row.reference]" link type="primary" :disabled="saving" @click="addReference(row)">补渠道编号</el-button>
              <el-button v-if="merchant.canVerify && merchant[row.status] === 'PENDING'" link type="primary" :disabled="saving || !merchant[row.reference]" @click="verify(row.key, true)">核验通过</el-button>
              <el-button v-if="merchant.canVerify && merchant[row.status] === 'PENDING'" link type="danger" :disabled="saving" @click="verify(row.key, false)">驳回补充</el-button>
              <span v-else>—</span>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <template v-else-if="tab === 'policies'">
        <div class="hx-toolbar">
          <p>发布新版本后，用户端展示正式内容并按版本记录授权。正文须使用客户确认稿。</p>
          <el-button v-if="merchant.canVerify" type="primary" @click="openPolicy">发布新版本</el-button>
        </div>
        <el-table :data="policies" border stripe empty-text="尚未发布协议，请先录入客户确认的正文">
          <el-table-column prop="type" label="类型" min-width="160"><template #default="{ row }">{{ policyTypes[row.type] || row.type }}</template></el-table-column>
          <el-table-column prop="version" label="版本" min-width="120" />
          <el-table-column prop="title" label="标题" min-width="220" show-overflow-tooltip />
          <el-table-column prop="status" label="状态" min-width="120"><template #default="{ row }">{{ statusLabel(row.status) }}</template></el-table-column>
          <el-table-column prop="publishedAt" label="发布时间" min-width="180" />
          <el-table-column label="操作" width="90"><template #default="{ row }"><el-button link type="primary" @click="selectedPolicy = row; policyDetail = true">查看</el-button></template></el-table-column>
        </el-table>
      </template>

      <template v-else>
        <el-alert title="授权记录按用户、协议类型与版本留痕。协议更新后，旧版本记录仍可审计。" type="info" :closable="false" class="hx-alert" />
        <el-table :data="consents" border stripe empty-text="当前商城暂无授权记录">
          <el-table-column prop="memberId" label="会员编号" min-width="130" />
          <el-table-column prop="type" label="协议类型" min-width="170"><template #default="{ row }">{{ policyTypes[row.type] || row.type }}</template></el-table-column>
          <el-table-column prop="version" label="授权版本" min-width="130" />
          <el-table-column prop="consentedAt" label="授权时间" min-width="190" />
          <el-table-column prop="source" label="授权来源" min-width="130" />
        </el-table>
      </template>
    </section>

    <el-dialog v-model="merchantDialog" :show-close="!saving&&!uploading" :close-on-press-escape="!saving&&!uploading" :title="merchantTitles[merchantMode]" width="min(620px, 95vw)" :close-on-click-modal="false">
      <el-form label-position="top" :disabled="saving||uploading" @submit.prevent="saveMerchant">
        <template v-if="merchantMode === 'application'">
          <el-form-item label="商户主体类型" required><el-select v-model="merchantForm.subjectType" style="width:100%"><el-option label="企业" value="ENTERPRISE" /><el-option label="个体工商户" value="INDIVIDUAL" /></el-select></el-form-item>
          <el-form-item label="商户主体名称" required><el-input v-model.trim="merchantForm.subjectName" maxlength="160" /></el-form-item>
          <el-form-item label="法定代表人" required><el-input v-model.trim="merchantForm.legalRepresentative" maxlength="80" /></el-form-item>
          <el-form-item label="统一社会信用代码（18 位大写字母或数字）" required><el-input v-model.trim="merchantForm.licenseNo" maxlength="18" /></el-form-item>
          <el-form-item label="联系人手机号" required><el-input v-model.trim="merchantForm.contactPhone" maxlength="11" /></el-form-item>
          <el-form-item label="结算银行（渠道回执为准）"><el-input v-model.trim="merchantForm.settlementBank" maxlength="120" /></el-form-item>
          <el-form-item label="微信商户结算账户引用（有渠道回执时填写）"><el-input v-model.trim="merchantForm.settlementAccountRef" maxlength="128" /></el-form-item>
          <el-form-item label="渠道进件申请编号（取得渠道回执后填写）"><el-input v-model.trim="merchantForm.applicationRef" maxlength="100" /></el-form-item>
          <el-form-item label="主体证明图片（至少 1 张，最多 12 张）" required>
            <el-upload accept="image/png,image/jpeg" :http-request="uploadMerchantAttachment" :disabled="uploading" :show-file-list="false">
              <el-button :loading="uploading">上传图片</el-button>
            </el-upload>
          </el-form-item>
          <AttachmentGallery :ids="merchantForm.attachmentIds"/>
          <div class="hx-attachments"><el-tag v-for="id in merchantForm.attachmentIds" :key="id" closable @close="merchantForm.attachmentIds = merchantForm.attachmentIds.filter(x => x !== id)">{{ id }}</el-tag></div>
          <el-alert title="未取得渠道进件申请编号时可先保存资料；平台核验须在渠道回执编号补齐后进行。" type="info" :closable="false" />
        </template>
        <template v-else-if="merchantMode === 'authorization'">
          <el-form-item label="小程序 AppID" required><el-input v-model.trim="merchantForm.appId" maxlength="64" /></el-form-item>
          <el-form-item :label="merchant.paymentMode === 'PARTNER' ? '子商户号' : '收款商户号'" required><el-input v-model.trim="merchantForm.merchantNo" maxlength="64" /></el-form-item>
          <el-form-item label="渠道授权编号（取得渠道回执后填写）"><el-input v-model.trim="merchantForm.authorizationRef" maxlength="100" /></el-form-item>
        </template>
        <template v-else>
          <el-form-item label="证书序列号" required><el-input v-model.trim="merchantForm.serialNo" maxlength="100" /></el-form-item>
          <el-form-item label="证书到期日期" required><el-date-picker v-model="merchantForm.expiresAt" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
          <el-form-item label="证书登记编号（取得渠道回执后填写）"><el-input v-model.trim="merchantForm.certificateRef" maxlength="100" /></el-form-item>
          <el-form-item label="实际签约费率（基点，渠道凭证为准）" required><el-input-number v-model="merchantForm.contractedFeeBps" :min="0" :max="10000" :precision="0" style="width:100%" /></el-form-item>
          <el-form-item label="结算周期（T+天数，渠道凭证为准）" required><el-input-number v-model="merchantForm.settlementDays" :min="0" :max="365" :precision="0" style="width:100%" /></el-form-item>
          <el-alert title="0.2% 仅是需求目标测算，实际费率与结算周期以渠道签约结果为准。渠道登记编号须在平台核验前补齐；私钥与证书文件须在服务端安全配置。" type="info" :closable="false" />
        </template>
      </el-form>
      <template #footer><el-button :disabled="saving||uploading" @click="merchantDialog = false">取消</el-button><el-button type="primary" :loading="saving" :disabled="uploading" @click="saveMerchant">提交审核</el-button></template>
    </el-dialog>

    <el-dialog v-model="policyDialog" :show-close="!saving" :close-on-press-escape="!saving" title="发布协议版本" width="min(720px, 95vw)" :close-on-click-modal="false">
      <el-form label-position="top" :disabled="saving" @submit.prevent="savePolicy">
        <el-form-item label="协议类型" required><el-select v-model="policyForm.type" style="width:100%"><el-option v-for="(label, type) in policyTypes" :key="type" :value="type" :label="label" /></el-select></el-form-item>
        <el-form-item label="版本号" required><el-input v-model.trim="policyForm.version" placeholder="例如 2026-09-25" maxlength="40" /></el-form-item>
        <el-form-item label="显示标题" required><el-input v-model.trim="policyForm.title" maxlength="100" /></el-form-item>
        <el-form-item label="客户确认的正式正文" required><el-input v-model="policyForm.content" type="textarea" :rows="13" maxlength="50000" show-word-limit /></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="saving" @click="policyDialog = false">取消</el-button><el-button type="primary" :loading="saving" @click="savePolicy">确认发布</el-button></template>
    </el-dialog>

    <el-drawer v-model="policyDetail" :title="selectedPolicy.title || '协议正文'" size="min(760px, 95vw)">
      <p class="hx-policy-meta">{{ policyTypes[selectedPolicy.type] || selectedPolicy.type }} · {{ selectedPolicy.version }} · {{ selectedPolicy.publishedAt }}</p>
      <div class="hx-policy-body">{{ selectedPolicy.content }}</div>
    </el-drawer>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listShops, uploadFinance } from '@/api/hexu'
import AttachmentGallery from '../AttachmentGallery.vue'
import { imageUploadError } from '../workspace-model'
import {
  authorizeMerchant, listPolicies, listPolicyConsents, merchantStatus,
  publishPolicy, saveMerchantCertificate, saveMerchantReference, submitMerchant, verifyMerchantStage
} from '@/api/hexu/compliance'
import { applicationError, authorizationError, certificateError, merchantPayload } from './model'

const shops = ref([])
const shopId = ref(null)
const tab = ref('merchant')
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const error = ref('')
const merchant = ref({})
const policies = ref([])
const consents = ref([])
const merchantDialog = ref(false)
const merchantMode = ref('application')
const merchantForm = ref({})
const policyDialog = ref(false)
const policyDetail = ref(false)
const selectedPolicy = ref({})
const policyForm = ref({})
let loadRequest = 0, lastShop, lastTab

const policyTypes = {
  USER_AGREEMENT: '用户协议',
  PRIVACY_POLICY: '隐私政策',
  THIRD_PARTY_SHARING: '第三方共享清单',
  AGENT_AGREEMENT: '代理合作协议'
}
const stages = [
  { key: 'APPLICATION', label: '商户进件', status: 'applicationStatus', reference: 'applicationRef' },
  { key: 'AUTHORIZATION', label: 'AppID 授权', status: 'authorizationStatus', reference: 'authorizationRef' },
  { key: 'CERTIFICATE', label: '证书登记', status: 'certificateStatus', reference: 'certificateRef' },
  { key: 'TRANSFER', label: '商家转账授权', status: 'transferAuthStatus', reference: 'transferAuthRef' }
]
const merchantTitles = { application: '提交经销商进件资料', authorization: '登记小程序支付授权', certificate: '登记支付证书元数据' }
const statusLabel = status => ({ NOT_SUBMITTED: '未提交', PENDING: '待核验', VERIFIED: '已核验', REJECTED: '已驳回', PUBLISHED: '现行版本', SUPERSEDED: '历史版本' }[status] || status || '未提交')
const statusType = status => ({ VERIFIED: 'success', PENDING: 'warning', REJECTED: 'danger', NOT_SUBMITTED: 'info' }[status] || 'info')

async function load() {
  if (shopId.value == null) return
  const requestId = ++loadRequest
  const selectedShop = shopId.value
  const selectedTab = tab.value
  if (selectedShop !== lastShop || selectedTab !== lastTab) { merchantDialog.value = false; policyDialog.value = false; policyDetail.value = false }
  lastShop = selectedShop
  lastTab = selectedTab
  loading.value = true
  error.value = ''
  merchant.value = {}
  policies.value = []
  consents.value = []
  try {
    if (selectedTab === 'merchant') {
      const response = await merchantStatus(selectedShop)
      if (requestId === loadRequest) merchant.value = response.data || {}
    } else if (selectedTab === 'policies') {
      const [merchantResponse, policyResponse] = await Promise.all([merchantStatus(selectedShop), listPolicies(selectedShop)])
      if (requestId === loadRequest) {
        merchant.value = merchantResponse.data || {}
        policies.value = policyResponse.data || []
      }
    }
    else {
      const response = await listPolicyConsents(selectedShop)
      if (requestId === loadRequest) consents.value = response.data || []
    }
  } catch (e) {
    if (requestId === loadRequest) {
      error.value = e.message || '数据读取失败'
      merchantDialog.value = false; policyDialog.value = false; policyDetail.value = false
    }
  } finally {
    if (requestId === loadRequest) loading.value = false
  }
}

function openMerchant(mode) {
  merchantMode.value = mode
  merchantForm.value = mode === 'application'
    ? { subjectType: merchant.value.subjectType || 'ENTERPRISE', subjectName: merchant.value.subjectName || '', legalRepresentative: '', licenseNo: '', contactPhone: '', settlementBank: merchant.value.settlementBank || '', settlementAccountRef: merchant.value.settlementAccountRef || '', applicationRef: merchant.value.applicationRef || '', attachmentIds: [...(merchant.value.attachmentIds || [])] }
    : mode === 'authorization'
      ? { appId: merchant.value.appId || '', merchantNo: merchant.value.merchantNo || '', authorizationRef: merchant.value.authorizationRef || '' }
      : { serialNo: merchant.value.certificateSerial || '', expiresAt: merchant.value.expiresAt || '', certificateRef: merchant.value.certificateRef || '', contractedFeeBps: merchant.value.contractedFeeBps ?? null, settlementDays: merchant.value.settlementDays ?? null }
  merchantDialog.value = true
}

async function uploadMerchantAttachment(options) {
  const validation = imageUploadError(options.file)
  if (validation || uploading.value) {
    const error = new Error(validation || '图片正在上传，请稍后再试')
    ElMessage.error(error.message)
    options.onError?.(error)
    return
  }
  if (merchantForm.value.attachmentIds.length >= 12) {
    ElMessage.warning('主体证明图片最多 12 张')
    options.onError(new Error('主体证明图片最多 12 张'))
    return
  }
  uploading.value = true
  try {
    const result = await uploadFinance(options.file, shopId.value, 'MERCHANT')
    merchantForm.value.attachmentIds.push(result.data.id)
    options.onSuccess(result.data)
  } catch (e) {
    options.onError(e)
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function saveMerchant() {
  if (saving.value || uploading.value) return
  const validationError = merchantMode.value === 'application' ? applicationError(merchantForm.value)
    : merchantMode.value === 'authorization' ? authorizationError(merchantForm.value)
      : certificateError(merchantForm.value)
  if (validationError) return ElMessage.warning(validationError)
  saving.value = true
  try {
    const data = merchantPayload(merchantMode.value, shopId.value, merchantForm.value)
    if (merchantMode.value === 'application') await submitMerchant(data)
    else if (merchantMode.value === 'authorization') await authorizeMerchant(data)
    else await saveMerchantCertificate(data)
    ElMessage.success('已提交，等待核验')
    merchantDialog.value = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '提交失败')
  } finally {
    saving.value = false
  }
}

async function verify(stage, approve) {
  if (saving.value) return
  let reason = ''
  try {
    if (approve) await ElMessageBox.confirm('确认此阶段资料已完成核验？', '商户资料核验', { type: 'warning' })
    else reason = (await ElMessageBox.prompt('填写驳回或补充原因', '商户资料核验', { inputValidator: value => !!value?.trim() || '请填写原因' })).value.trim()
  } catch { return }
  saving.value = true
  try {
    await verifyMerchantStage({ shopId: shopId.value, stage, approve, reason })
    ElMessage.success('审核结果已保存')
    await load()
  } catch (e) {
    ElMessage.error(e.message || '审核失败')
  } finally {
    saving.value = false
  }
}

async function addReference(stage) {
  if (saving.value) return
  let reference
  try {
    reference = (await ElMessageBox.prompt('填写微信支付渠道出具的编号；已录入的编号不可自行替换', `补录${stage.label}编号`, {
      inputPattern: /^[A-Za-z0-9_-]{4,100}$/,
      inputErrorMessage: '编号须为 4–100 位字母、数字、下划线或连字符'
    })).value.trim()
  } catch { return }
  saving.value = true
  try {
    await saveMerchantReference({ shopId: shopId.value, stage: stage.key, reference })
    ElMessage.success('渠道编号已补录')
    await load()
  } catch (e) {
    ElMessage.error(e.message || '补录失败')
  } finally {
    saving.value = false
  }
}

function openPolicy() {
  policyForm.value = { type: 'USER_AGREEMENT', version: '', title: '', content: '' }
  policyDialog.value = true
}

async function savePolicy() {
  if (saving.value) return
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(policyForm.value.version || '') || (policyForm.value.title?.trim().length || 0) < 2 || (policyForm.value.content?.trim().length || 0) < 20) {
    ElMessage.warning('请填写有效版本号、标题和至少 20 字的正式正文')
    return
  }
  saving.value = true
  try {
    await publishPolicy({ shopId: shopId.value, ...policyForm.value })
    ElMessage.success('协议版本已发布')
    policyDialog.value = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '发布失败')
  } finally {
    saving.value = false
  }
}

async function initialize() {
  try {
    const response = await listShops()
    // 管理范围缺失或格式异常时必须显示错误，不能渲染成“无协议”。
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
.hx-compliance{padding:28px;background:#f4f6f2;min-height:calc(100vh - 90px);--el-color-primary:#155641;--el-color-primary-light-3:#50816c;--el-color-primary-light-9:#eff5ef;--el-border-radius-base:7px}
.hx-header,.hx-toolbar{display:flex;align-items:center;justify-content:space-between;gap:20px}.hx-header{margin-bottom:28px}.hx-eyebrow{font-size:10px;letter-spacing:2px;color:#869581}.hx-header h1{font-size:26px;font-weight:600;color:#203e2c;margin:10px 0}.hx-header p,.hx-toolbar p{font-size:13px;color:#627262;margin:0}.hx-tools,.hx-actions,.hx-attachments{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.hx-section{background:#fdfefd;border:1px solid #e3e9df;border-radius:12px;padding:22px}.hx-alert,.hx-details,.hx-toolbar{margin-bottom:20px}.hx-status-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:20px}.hx-status-grid article{border:1px solid #e3e9df;border-radius:8px;padding:18px;display:flex;flex-direction:column;align-items:flex-start;gap:10px}.hx-status-grid span{font-size:14px;font-weight:600;color:#203e2c}.hx-status-grid small{color:#627262;overflow-wrap:anywhere}.hx-actions{margin:20px 0}.hx-attachments{margin:-8px 0 16px}.hx-policy-meta{font-size:13px;color:#627262}.hx-policy-body{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8;color:#26352b}.hx-compliance :deep(.el-table th){background:#f0f4ed;color:#68805c;font-weight:500}
@media(max-width:800px){.hx-header,.hx-toolbar{align-items:flex-start;flex-direction:column}.hx-status-grid{grid-template-columns:1fr}.hx-section{padding:14px}}
@media(max-width:600px){.hx-compliance{padding:16px}.hx-header h1{font-size:23px}}
</style>
