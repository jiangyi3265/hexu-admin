<template>
  <div class="agent-directory">
    <el-alert title="怎么看代理关系" type="info" :closable="false" class="agent-directory-guide">
      <template #default>左侧点代理姓名查看明细，点 ▸ 展开他的直接下级；右侧依次显示上级、直接下级名单和经营区域。“全部下级”包含更深层级的代理。</template>
    </el-alert>
    <div class="agent-directory-tools">
      <el-input v-model="query" clearable placeholder="代理姓名或编号" style="max-width:240px" @keyup.enter="loadList"/>
      <el-select v-model="region" clearable filterable placeholder="按经营区域筛选" style="width:260px" @change="loadList">
        <el-option v-for="item in regionGroups" :key="item.region" :label="`${item.region}（${item.agentCount}）`" :value="item.region"/>
      </el-select>
      <el-button @click="loadList">查询</el-button>
      <el-button @click="query='';region='';loadList()">按关系查看</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    <div class="agent-directory-grid">
      <section class="agent-directory-list" v-loading="loading">
        <h3>{{query||region?'筛选结果':'代理上下级关系'}}</h3>
        <template v-if="query||region">
          <div v-for="item in rows" :key="item.id" class="agent-search-row">
            <el-button link type="primary" @click="select(item.id)">{{item.name}} · {{rankName(item.rank_no)}} · #{{item.id}}</el-button>
            <small>{{item.regions?.join('、')||'区域未配置'}} · 直属 {{item.childCount}}</small>
          </div>
        </template>
        <AgentTreeBranch v-else v-for="item in rows" :key="`${treeKey}:${item.id}`" :node="item" :shop-id="shopId" @select="select"/>
        <el-empty v-if="!loading&&!rows.length" description="暂无符合条件的代理" :image-size="72"/>
        <el-button v-if="cursor" link :loading="loading" @click="loadMore">加载更多</el-button>
      </section>
      <section class="agent-directory-detail" v-loading="detailLoading">
        <template v-if="selected">
          <h3>{{selected.name}} 的上下级明细</h3>
          <div class="agent-ancestors">
            <span v-if="selected.ancestors[0]?.parent_id" class="agent-external-parent">{{externalParentLabel(selected)}} ›</span>
            <el-button v-for="(item,index) in selected.ancestors" :key="item.id" link type="primary" @click="select(item.id)">{{index?'› ':''}}{{item.name}}</el-button>
          </div>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="代理编号">{{selected.id}}</el-descriptions-item>
            <el-descriptions-item label="代理姓名">{{selected.name}}</el-descriptions-item>
            <el-descriptions-item label="职级">{{rankName(selected.rank_no)}}</el-descriptions-item>
            <el-descriptions-item label="直接上级">{{parentLabel(selected)}}</el-descriptions-item>
            <el-descriptions-item label="直接下级（紧接下一层）">{{selected.childCount}} 人</el-descriptions-item>
            <el-descriptions-item label="全部下级（含更深层）">{{selected.descendantCount}} 人</el-descriptions-item>
            <el-descriptions-item label="直属客户">{{selected.customerCount}} 人</el-descriptions-item>
            <el-descriptions-item label="经营区域">{{selected.regions?.join('、')||'未配置（由商城拥有者设置）'}}</el-descriptions-item>
            <el-descriptions-item label="状态">{{selected.status}}</el-descriptions-item>
          </el-descriptions>
          <h3 class="agent-children-title">直接下级明细</h3>
          <el-alert v-if="childError" :title="childError" type="error" :closable="false"/>
          <AgentTreeBranch v-for="item in selectedChildren" :key="item.id" :node="item" :shop-id="shopId" @select="select"/>
          <span v-if="childLoading&&!selectedChildren.length">读取下级中…</span>
          <span v-else-if="!childLoading&&!selectedChildren.length" class="agent-region-note">暂无直接下级代理</span>
          <el-button v-if="childCursor" link :loading="childLoading" @click="loadSelectedChildren(selected.id)">加载更多下级</el-button>
          <el-button v-if="canEdit" type="primary" plain class="agent-region-edit" @click="openEditor">设置经营区域</el-button>
          <p class="agent-region-note">经营区域用于展示和筛选，不调整代理上下级、客户归属或收益。</p>
        </template>
        <el-empty v-else description="点击代理查看明细" :image-size="72"/>
      </section>
    </div>
    <el-dialog v-model="editing" title="设置代理经营区域" width="min(560px,95vw)" append-to-body>
      <el-form label-position="top" @submit.prevent="saveRegions">
        <el-form-item label="经营区域（最多10个）">
          <el-select v-model="draftRegions" multiple filterable remote :remote-method="findRegions" :loading="optionsLoading" placeholder="输入至少两个字搜索省、市、区县" style="width:100%">
            <el-option v-for="area in options" :key="area" :label="area" :value="area"/>
          </el-select>
        </el-form-item>
        <el-form-item label="调整原因"><el-input v-model="reason" type="textarea" :maxlength="200" show-word-limit/></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="saving" @click="editing=false">取消</el-button><el-button type="primary" :loading="saving" @click="saveRegions">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import {ref,onMounted} from 'vue'
import {ElMessage} from 'element-plus'
import {agentTreeChildren,agentTreeSearch,agentTreeDetail,agentTreeRegions,agentRegionOptions,saveAgentRegions} from '@/api/hexu'
import AgentTreeBranch from './AgentTreeBranch.vue'

const props=defineProps({shopId:{type:Number,required:true},initialAgentId:{type:Number,default:0},canEdit:{type:Boolean,default:false}})
const query=ref(''),region=ref(''),regionGroups=ref([]),rows=ref([]),cursor=ref(0),treeKey=ref(0)
const loading=ref(false),detailLoading=ref(false),error=ref(''),selected=ref(null)
const selectedChildren=ref([]),childCursor=ref(0),childLoading=ref(false),childError=ref('')
const editing=ref(false),draftRegions=ref([]),reason=ref(''),options=ref([]),optionsLoading=ref(false),saving=ref(false)
let listRequest=0,detailRequest=0,optionRequest=0
const rankName=rank=>({1:'云代理',2:'分货中心',3:'总代理'})[rank]||'未知职级'
const externalParentLabel=node=>node.externalParent
  ?`${node.externalParent.name} · #${node.externalParent.id}（跨商城）`
  :`代理 #${node.ancestors[0].parent_id}（当前商城外）`
const parentLabel=node=>node.ancestors.at(-2)?.name||(node.parent_id?externalParentLabel(node):'本商城根代理')

async function loadMore(){
  if(loading.value)return
  const requestId=++listRequest,search=query.value.trim(),area=region.value,after=cursor.value
  loading.value=true;error.value=''
  try{
    const response=search||area
      ?await agentTreeSearch(props.shopId,search,area,after)
      :await agentTreeChildren(props.shopId,0,after)
    if(requestId!==listRequest)return
    rows.value.push(...response.data.items)
    cursor.value=response.data.nextCursor||0
    if(!selected.value&&!props.initialAgentId&&after===0&&rows.value.length)select(rows.value[0].id)
  }catch(e){if(requestId===listRequest)error.value=e.message||'读取代理关系失败'}
  finally{if(requestId===listRequest)loading.value=false}
}
function loadList(){listRequest++;rows.value=[];cursor.value=0;loading.value=false;treeKey.value++;loadMore()}
async function loadRegions(){
  try{regionGroups.value=(await agentTreeRegions(props.shopId)).data||[]}
  catch(e){error.value=e.message||'读取经营区域失败'}
}
async function select(id){
  const requestId=++detailRequest
  selected.value=null;selectedChildren.value=[];childCursor.value=0
  detailLoading.value=true
  try{
    const response=await agentTreeDetail(props.shopId,id)
    if(requestId!==detailRequest)return
    selected.value=response.data
    selectedChildren.value=[];childCursor.value=0;childError.value='';childLoading.value=false
    loadSelectedChildren(id,requestId)
  }
  catch(e){if(requestId===detailRequest)ElMessage.error(e.message||'读取代理明细失败')}
  finally{if(requestId===detailRequest)detailLoading.value=false}
}
async function loadSelectedChildren(id,requestId=detailRequest){
  if(childLoading.value)return
  childLoading.value=true;childError.value=''
  try{
    const response=await agentTreeChildren(props.shopId,id,childCursor.value)
    if(requestId!==detailRequest)return
    selectedChildren.value.push(...response.data.items)
    childCursor.value=response.data.nextCursor||0
  }catch(e){if(requestId===detailRequest)childError.value=e.message||'读取下级失败'}
  finally{if(requestId===detailRequest)childLoading.value=false}
}
function openEditor(){
  draftRegions.value=[...(selected.value.regions||[])]
  options.value=[...draftRegions.value]
  reason.value=''
  editing.value=true
}
async function findRegions(value){
  if(String(value||'').trim().length<2)return
  const requestId=++optionRequest
  optionsLoading.value=true
  try{
    const response=await agentRegionOptions(props.shopId,value)
    if(requestId===optionRequest)options.value=[...new Set([...draftRegions.value,...response.data])]
  }catch(e){if(requestId===optionRequest)ElMessage.error(e.message||'地区查询失败')}
  finally{if(requestId===optionRequest)optionsLoading.value=false}
}
async function saveRegions(){
  if(saving.value||!selected.value)return
  if(draftRegions.value.length>10||reason.value.trim().length<2){ElMessage.warning('最多设置10个区域，并填写至少2字的调整原因');return}
  saving.value=true
  try{
    await saveAgentRegions(props.shopId,selected.value.id,draftRegions.value,reason.value.trim())
    editing.value=false
    ElMessage.success('经营区域已保存')
    await Promise.all([loadRegions(),select(selected.value.id)])
    loadList()
  }catch(e){ElMessage.error(e.message||'保存经营区域失败')}
  finally{saving.value=false}
}
onMounted(()=>{loadList();loadRegions();if(props.initialAgentId)select(props.initialAgentId)})
</script>

<style scoped>
.agent-directory-tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.agent-directory-guide{margin-bottom:16px}
.agent-directory-grid{display:grid;grid-template-columns:minmax(330px,1fr) minmax(300px,420px);gap:18px}
.agent-directory-list,.agent-directory-detail{border:1px solid #e4e9e4;border-radius:8px;padding:16px;min-height:320px;max-height:65vh;overflow:auto}
.agent-directory h3{margin:0 0 12px;font-size:16px}
.agent-children-title{margin-top:18px!important}
.agent-search-row{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid #eef1ee;min-height:40px}
.agent-search-row small{color:#7b837b;text-align:right}
.agent-ancestors{display:flex;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.agent-external-parent{font-size:12px;color:#7b837b}
.agent-region-edit{margin-top:16px}
.agent-region-note{font-size:12px;color:#7b837b;line-height:1.6}
@media(max-width:760px){
  .agent-directory-grid{grid-template-columns:1fr}
  .agent-directory-list,.agent-directory-detail{max-height:none}
}
</style>
