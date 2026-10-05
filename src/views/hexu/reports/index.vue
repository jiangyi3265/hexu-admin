<template>
<main class="report-workspace">
<header><div><small>HEXU · BUSINESS INTELLIGENCE</small><h1>经营分析报表</h1><p>订单历史关系 · 数据快照 · 全量导出</p></div><el-select v-model="shopId" :disabled="creating||exporting" @change="changeShop" aria-label="报表商城"><el-option v-if="platform" :value="0" label="全平台"/><el-option v-for="s in shops" :key="s.id" :value="s.id" :label="s.name"/></el-select></header>
<el-alert v-if="error" :title="error" type="error" :closable="false" show-icon/>
<section><el-form label-position="top" class="filters"><el-form-item label="统计时间（北京时间）"><el-date-picker v-model="range" type="daterange" value-format="YYYY-MM-DD" start-placeholder="起始日期" end-placeholder="结束日期" :disabled-date="future"/></el-form-item><el-form-item label="县域"><el-input v-model="filters.county" placeholder="全部县域" clearable/></el-form-item><el-form-item label="商品编号"><el-input v-model="filters.skuId" placeholder="全部商品" clearable/></el-form-item><el-form-item label="订单中的代理职级"><el-select v-model="filters.rank"><el-option v-for="(x,i) in ['全部职级','云代理','分货中心','总代理']" :key="i" :label="x" :value="i"/></el-select></el-form-item><el-form-item label="代理编号"><el-input-number v-model="filters.agentId" :min="0" :precision="0"/></el-form-item><el-form-item label="客户编号"><el-input-number v-model="filters.customerId" :min="0" :precision="0"/></el-form-item></el-form><div class="actions"><el-checkbox v-model="filters.includeTeam">代理筛选包含历史下级团队</el-checkbox><span>编号为 0 表示全部</span><el-button type="primary" :loading="creating" :disabled="shopId==null" @click="generate">生成报表</el-button></div></section>
<section v-if="jobs.length"><div class="heading"><h2>报表任务</h2><el-button text @click="loadJobs">刷新任务</el-button></div><el-select :model-value="job?.id" @change="selectJob" aria-label="历史报表任务" class="job-picker"><el-option v-for="j in jobs" :key="j.id" :value="j.id" :label="j.filters.from+' 至 '+j.filters.to+' · '+status(j.status)+' · '+j.id"/></el-select><template v-if="job"><p class="caption">{{job.filters?.from}} 至 {{job.filters?.to}} · 快照时间 {{dateTime(job.snapshot_at)||'等待生成'}} · {{job.processed_rows}} / {{job.total_rows}} 条订单明细</p><el-progress :percentage="Number(job.progress||0)" :status="job.status==='FAILED'?'exception':job.status==='COMPLETED'?'success':undefined"/><el-alert v-if="job.status==='FAILED'" :title="job.error_message||'任务失败，请重新生成'" type="error" :closable="false"/></template></section>
<template v-if="job?.status==='COMPLETED'">
<div class="metrics"><article v-for="m in metrics" :key="m[0]"><span>{{m[0]}}</span><strong>{{m[1]}}</strong><small>{{m[2]}}</small></article></div>
<section><div class="heading"><h2>净销售额趋势</h2><span>{{job.trendGrain==='MONTH'?'按月':'按日'}} · 元</span></div><div v-if="job.trend?.length" class="trend"><svg viewBox="0 0 1000 180" preserveAspectRatio="none" role="img" aria-label="净销售额趋势"><line x1="0" y1="160" x2="1000" y2="160" stroke="#dce7de"/><polyline :points="trendPoints" fill="none" stroke="#155641" stroke-width="3" vector-effect="non-scaling-stroke"/><circle v-for="(r,i) in job.trend" :key="r.day" :cx="trendX(i)" :cy="trendY(r)" r="3.5" fill="#155641"><title>{{r.day}}：{{money(r.net_sales)}} 元</title></circle></svg><div class="trend-labels"><span>{{job.trend[0]?.day}}</span><span>{{job.trend.at(-1)?.day}}</span></div></div><el-empty v-else description="所选条件下暂无有效订单"/></section>
<section><div class="heading"><h2>经营明细</h2><div class="actions"><el-select v-model="dimension" @change="changeDimension" aria-label="统计维度"><el-option v-for="d in dimensions" :key="d[0]" :value="d[0]" :label="d[1]"/></el-select><el-button :loading="exporting" @click="download(dimension)">导出全部结果</el-button></div></div><el-alert title="价差毛利仅计算有历史职级成本的商品，不含运费、渠道手续费；未记录成本的销售额单独列示。数据取生成时快照，后续退款需重新生成。" type="info" :closable="false"/><el-table :data="job.rows" v-loading="loading" stripe><el-table-column v-for="c in idColumns" :key="c[0]" :prop="c[0]" :label="c[1]" :min-width="identityColumnWidth(c[0])" :show-overflow-tooltip="false" class-name="report-wrap"><template #default="s">{{reportDisplayCell(c[0],s.row[c[0]])}}</template></el-table-column><el-table-column prop="orders" label="有效订单" width="100"/><el-table-column prop="quantity" label="净销量" width="90"/><el-table-column v-for="c in moneyColumns" :key="c[0]" :label="c[1]" min-width="150" align="right"><template #default="s">{{money(s.row[c[0]])}}</template></el-table-column></el-table><el-pagination v-model:current-page="page" :page-size="100" :total="Number(job.totalGroups)" layout="total, prev, pager, next" @current-change="loadResult"/></section>
<section><div class="heading"><h2>库存与周转</h2><el-button :loading="exporting" @click="download('INVENTORY')">导出全部库存</el-button></div><p class="caption">{{job.inventoryScope}}。库存为生成时实存；日均库存按所选区间每日结存重建。</p><el-table :data="inventory" stripe><el-table-column prop="shop_id" label="商城编号" min-width="130"/><el-table-column prop="sku_name" label="商品" min-width="160"/><el-table-column v-for="c in stockColumns" :key="c[0]" :prop="c[0]" :label="c[1]" min-width="110"/><el-table-column label="参考周转天数" min-width="120"><template #default="s">{{reportDisplayCell('turnoverDays',s.row.turnoverDays)}}</template></el-table-column></el-table><el-pagination v-model:current-page="inventoryPage" :page-size="100" :total="Number(job.inventoryTotal)" layout="total, prev, pager, next" @current-change="loadInventory"/></section>
</template><el-empty v-else-if="!jobs.length" description="选择统计条件，生成第一份报表"/>
</main>
</template>
<script setup>
import {ref,computed,onMounted,onBeforeUnmount,onActivated,onDeactivated} from 'vue'
import {ElMessage} from 'element-plus'
import useUserStore from '@/store/modules/user'
import { reportFilterError, reportDisplayCell } from './model'
import {listShops,command,reportJobs,reportResult,reportInventory,reportExport} from '@/api/hexu'
const platform=computed(()=>useUserStore().roles.includes('admin')),shops=ref([]),shopId=ref(2),jobs=ref([]),job=ref(null),range=ref([]),filters=ref({county:'',skuId:'',rank:0,agentId:0,customerId:0,includeTeam:true}),dimension=ref('SHOP'),page=ref(1),inventoryPage=ref(1),inventory=ref([]),creating=ref(false),loading=ref(false),exporting=ref(false),error=ref('')
let timer,epoch=0,active=true,jobsRequest=0,resultRequest=0,inventoryRequest=0
const chinaDay=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d),today=chinaDay(new Date());range.value=[today.slice(0,8)+'01',today]
const future=d=>chinaDay(d)>today,money=n=>(Number(n||0)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}),status=s=>({QUEUED:'排队中',RUNNING:'生成中',COMPLETED:'已完成',FAILED:'失败'}[s]||s),dateTime=d=>d?new Date(d).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}):''
const dimensions=[['SHOP','按商城'],['COUNTY','按县域'],['SKU','按商品'],['RANK','按历史职级'],['AGENT','按历史代理'],['CUSTOMER','按客户'],['ORDER','按订单'],['DAY','按日'],['MONTH','按月']]
const idColumns=computed(()=>({SHOP:[['shop_name','商城'],['county','县域']],COUNTY:[['county','县域']],SKU:[['shop_name','商城'],['sku_id','商品编号'],['sku_name','商品']],RANK:[['rank_no','历史职级']],AGENT:[['shop_name','商城'],['agent_id','代理编号'],['agent_name','代理'],['rank_no','历史职级']],CUSTOMER:[['shop_name','商城'],['buyer_id','客户编号'],['buyer_name','客户']],ORDER:[['order_id','订单号'],['shop_name','商城'],['buyer_name','客户'],['order_status','快照状态']],DAY:[['day','日期']],MONTH:[['day','月份']]}[dimension.value]))
const identityColumnWidth=key=>({sku_id:180,order_id:200,sku_name:190,buyer_name:180,agent_name:180}[key]||140)
const moneyColumns=[['net_sales','净销售额 / 元'],['refunds','商品退款 / 元'],['distributionMargin','已知成本价差毛利 / 元'],['unknown_cost_sales','未记录成本销售额 / 元'],['earnings','冲正后净收益 / 元']],stockColumns=[['available','可售'],['locked','锁定'],['defective','不良品'],['in_transit','在途'],['quantity','筛选后净销量'],['average_stock','日均库存'],['stockStatus','库存状态']]
const metrics=computed(()=>{const s=job.value?.summary||{};return [['净销售额',money(s.net_sales),'商品实付扣除退款'],['有效订单',s.orders||0,'仍有有效实付的订单'],['客单价',money(s.orders?Math.round(s.net_sales/s.orders):0),'净销售额 ÷ 有效订单'],['客户复购率',((s.repeatBps||0)/100).toFixed(2)+'%','完成两笔及以上 / 完成购买客户'],['商品退款率',((s.gross_sales?s.refunds/s.gross_sales:0)*100).toFixed(2)+'%','商品退款金额 / 原商品实付']]})
const trendX=i=>job.value.trend.length===1?500:10+i*980/(job.value.trend.length-1),trendY=r=>160-Number(r.net_sales)*140/Math.max(1,...job.value.trend.map(r=>Number(r.net_sales))),trendPoints=computed(()=>job.value?.trend?.map((r,i)=>trendX(i)+','+trendY(r)).join(' ')||'')
function poll(){clearTimeout(timer);if(active&&['QUEUED','RUNNING'].includes(job.value?.status))timer=setTimeout(()=>loadResult(),2000)}
async function loadJobs(){
 const version=epoch,request=++jobsRequest,scope=shopId.value
 error.value=''
 try{
  if(scope==null)throw new Error('当前账号没有可管理的商城')
  const response=await reportJobs(scope)
  if(version!==epoch||request!==jobsRequest)return
  jobs.value=response.data||[]
  if(!job.value&&jobs.value[0])await selectJob(jobs.value[0].id)
 }catch(e){if(version===epoch&&request===jobsRequest){jobs.value=[];error.value=e.message||'报表任务读取失败'}}
}
async function loadResult(){
 if(!job.value)return
 clearTimeout(timer)
 const id=job.value.id,version=epoch,request=++resultRequest,dimensionAt=dimension.value,pageAt=page.value
 if(Array.isArray(job.value.rows))job.value={...job.value,rows:[]}
 loading.value=true;error.value='';let loaded=false
 try{
  const response=await reportResult(id,{dimension:dimensionAt,page:pageAt,size:100})
  if(version!==epoch||request!==resultRequest||id!==job.value?.id)return
  job.value=response.data;loaded=true
  const index=jobs.value.findIndex(j=>j.id===id);if(index>=0)jobs.value[index]=response.data
  if(job.value.status==='COMPLETED'&&inventoryPage.value===1)inventory.value=job.value.inventory||[]
 }catch(e){if(version===epoch&&request===resultRequest)error.value=e.message||'报表结果读取失败'}
 finally{if(version===epoch&&request===resultRequest){loading.value=false;if(loaded)poll()}}
}
async function loadInventory(){
 if(!job.value)return
 const id=job.value.id,version=epoch,request=++inventoryRequest,pageAt=inventoryPage.value
 inventory.value=[];error.value=''
 try{
  const response=await reportInventory(id,pageAt)
  if(version===epoch&&request===inventoryRequest&&id===job.value?.id)inventory.value=response.data||[]
 }catch(e){if(version===epoch&&request===inventoryRequest)error.value=e.message||'库存报表读取失败'}
}
async function selectJob(id){epoch++;clearTimeout(timer);page.value=1;inventoryPage.value=1;inventory.value=[];job.value=jobs.value.find(j=>j.id===id)||{id,filters:{}};await loadResult()}
async function changeShop(){epoch++;clearTimeout(timer);loading.value=false;jobs.value=[];job.value=null;inventory.value=[];await loadJobs()}
async function changeDimension(){epoch++;page.value=1;await loadResult()}
async function generate(){
 if(creating.value)return
 const validation=reportFilterError(range.value,filters.value,chinaDay(new Date()))
 if(validation)return ElMessage.warning(validation)
 const scope=shopId.value,version=epoch;creating.value=true;error.value=''
 try{
  const response=await command('report-create',{shopId:scope,from:range.value[0],to:range.value[1],...filters.value})
  if(version!==epoch||scope!==shopId.value)return
  jobs.value=[response.data,...jobs.value]
  await selectJob(response.data.id)
 }catch(e){if(scope===shopId.value)error.value=e.message||'报表生成失败'}
 finally{creating.value=false}
}
async function download(d){
 if(exporting.value||job.value?.status!=='COMPLETED')return
 const id=job.value.id,from=job.value.filters.from
 exporting.value=true
 try{
  const blob=await reportExport(id,d)
  if(blob.type.includes('json'))throw new Error(JSON.parse(await blob.text()).msg||'导出失败')
  const url=URL.createObjectURL(blob),a=document.createElement('a')
  a.href=url;a.download='禾序经营报表-'+d+'-'+from+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  ElMessage.success('已导出该快照的全部结果')
 }catch(e){ElMessage.error(e.message||'导出失败')}finally{exporting.value=false}
}
onMounted(async()=>{
 try{
  shops.value=(await listShops()).data||[]
   if(!shops.value.some(s=>s.id===shopId.value))shopId.value=shops.value[0]?.id??(platform.value?0:null)
  await loadJobs()
 }catch(e){error.value=e.message||'报表管理范围读取失败'}
})
onActivated(()=>{active=true;poll()});onDeactivated(()=>{active=false;clearTimeout(timer)});onBeforeUnmount(()=>{active=false;epoch++;jobsRequest++;resultRequest++;inventoryRequest++;clearTimeout(timer)})
</script>
<style scoped>
.report-workspace{padding:28px;background:#f4f6f2;min-height:calc(100vh - 90px);color:#203e2c;--el-color-primary:#155641;--el-color-primary-light-9:#eff5ef;--el-border-radius-base:7px}header,.heading,.actions{display:flex;align-items:center;justify-content:space-between;gap:16px}header{margin-bottom:28px}header small{font-size:10px;letter-spacing:2px;color:#869581}.report-workspace :deep(.report-wrap .cell){white-space:normal;overflow-wrap:anywhere;word-break:break-all;line-height:1.45}h1{font-size:26px;font-weight:600;margin:10px 0}h2{font-size:17px;font-weight:600;margin:0}p,span{font-size:13px}header p,.caption,.actions span,.heading>span{color:#7b897d;line-height:1.7}.report-workspace section{background:#fdfefd;border:1px solid #e3e9df;border-radius:12px;padding:22px;margin-bottom:20px}.filters{display:grid;grid-template-columns:2fr 1fr 1fr;gap:0 18px}.filters .el-date-editor,.filters .el-input-number{width:100%}.actions{justify-content:flex-end;flex-wrap:wrap}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-bottom:20px}.metrics article{background:#fdfefd;border:1px solid #e3e9df;border-radius:12px;padding:22px}.metrics article:first-child{background:#155641;color:#eef4ed}.metrics strong{display:block;margin:18px 0 12px;font-size:26px;font-weight:600;font-variant-numeric:tabular-nums}.metrics small{font-size:11px;opacity:.65}.heading{margin-bottom:20px}.el-select{width:220px}.job-picker{width:100%}.el-alert{margin:16px 0}.el-table{margin:16px 0;font-size:12px}.el-pagination{justify-content:flex-end;margin-top:20px}.trend svg{width:100%;height:180px}.trend-labels{display:flex;justify-content:space-between;color:#7b897d;font-size:12px}.report-workspace :deep(.el-table th){background:#f0f4ed;color:#68805c;font-weight:500}@media(max-width:1100px){.metrics{grid-template-columns:repeat(3,1fr)}.filters{grid-template-columns:1fr 1fr}}@media(max-width:650px){.report-workspace{padding:16px}.metrics{grid-template-columns:1fr 1fr}.filters{grid-template-columns:1fr}header,.heading{align-items:flex-start;flex-direction:column}}
</style>
