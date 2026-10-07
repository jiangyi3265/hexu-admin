<template>
  <div class="agent-branch">
    <div class="agent-branch-row">
      <el-button v-if="node.childCount" link :aria-label="expanded?'收起下级':'展开下级'" @click="toggle">{{expanded?'▾':'▸'}}</el-button>
      <span v-else class="agent-branch-spacer"/>
      <el-button link type="primary" @click="$emit('select',node.id)">{{node.name}} · {{rankName(node.rank_no)}} · #{{node.id}}</el-button>
      <el-tag v-if="node.status!=='ACTIVE'" type="info" size="small">{{node.status}}</el-tag>
      <span class="agent-branch-meta">直属 {{node.childCount}} · 客户 {{node.customerCount}} · {{node.regions?.join('、')||'区域未配置'}}</span>
    </div>
    <div v-if="expanded" class="agent-branch-children">
      <el-alert v-if="error" :title="error" type="error" :closable="false"/>
      <AgentTreeBranch v-for="child in children" :key="child.id" :node="child" :shop-id="shopId" @select="$emit('select',$event)"/>
      <el-button v-if="cursor" link :loading="loading" @click="loadMore">加载更多下级</el-button>
      <span v-if="loading&&!children.length">读取下级中…</span>
    </div>
  </div>
</template>

<script setup>
import {ref} from 'vue'
import {agentTreeChildren} from '@/api/hexu'

defineOptions({name:'AgentTreeBranch'})
const props=defineProps({node:{type:Object,required:true},shopId:{type:Number,required:true}})
defineEmits(['select'])
const rankName=rank=>({1:'云代理',2:'分货中心',3:'总代理'})[rank]||'未知职级'
const expanded=ref(false),children=ref([]),cursor=ref(0),loading=ref(false),error=ref(''),loaded=ref(false)

async function loadMore(){
  if(loading.value)return
  loading.value=true;error.value=''
  try{
    const page=(await agentTreeChildren(props.shopId,props.node.id,cursor.value)).data
    children.value.push(...page.items)
    cursor.value=page.nextCursor||0
    loaded.value=true
  }catch(e){error.value=e.message||'读取下级失败'}
  finally{loading.value=false}
}
function toggle(){expanded.value=!expanded.value;if(expanded.value&&!loaded.value)loadMore()}
</script>

<style scoped>
.agent-branch{min-width:0}
.agent-branch-row{display:flex;align-items:center;gap:8px;min-height:38px;flex-wrap:wrap}
.agent-branch-row .el-button{margin:0}
.agent-branch-spacer{width:32px}
.agent-branch-meta{color:#7b837b;font-size:12px}
.agent-branch-children{margin-left:17px;padding-left:15px;border-left:1px solid #dce6dc}
</style>
