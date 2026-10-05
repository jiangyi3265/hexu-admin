import request from '@/utils/request'
import { memberProfilePath } from './contracts'
import { getToken } from '@/utils/auth'
import { createRetryablePost,createSessionRetryKeys } from './idempotency'
const base='/hexu/admin'
export const idempotentPost=createRetryablePost(request,getToken,()=>crypto.randomUUID(),createSessionRetryKeys())
export const listShops=()=>request({url:base+'/shops'})
export const query=(path,shopId)=>request({url:base+'/'+path,params:{shopId}})
export const detail=id=>request({url:base+'/orders/'+encodeURIComponent(id)})
export const memberProfile=(memberId,shopId)=>request({url:base+memberProfilePath(memberId),params:{shopId}})
export const command=(operation,data,key)=>idempotentPost(base+'/commands/'+operation,data,key)
export const bankPayoutResult=(data,key)=>command('bank-payout-result',data,key)
export const agencyCommand=(path,data,key)=>idempotentPost(base+'/agency/'+path,data,key)
export const attachment=id=>request({url:'/hexu/app/attachments/'+encodeURIComponent(id),responseType:'blob'})
export const orderCover=(orderId,lineId)=>request({url:'/hexu/app/attachments/order-cover/'+encodeURIComponent(orderId)+'/'+encodeURIComponent(lineId),responseType:'blob'})

export const channelRetry=id=>request({url:base+'/channel/retry/'+encodeURIComponent(id),method:'post'})
export const channelRefund=id=>request({url:base+'/channel/refund/'+encodeURIComponent(id),method:'post'})
export const channelPayout=id=>request({url:base+'/channel/payout/'+encodeURIComponent(id),method:'post'})

export const startBackup=()=>idempotentPost(base+'/backups',{})

export const uploadFinance=(file,shopId,purpose='FINANCE')=>{const data=new FormData();data.append('file',file);data.append('shopId',shopId);data.append('purpose',purpose);return request({url:'/hexu/app/attachments',method:'post',data,headers:{'Content-Type':undefined,repeatSubmit:false}})}

export const reportJobs=shopId=>request({url:base+'/reports',params:{shopId}})
export const reportResult=(id,params)=>request({url:base+'/reports/'+encodeURIComponent(id),params})
export const reportInventory=(id,page)=>request({url:base+'/reports/'+encodeURIComponent(id)+'/inventory',params:{page,size:100}})
export const reportExport=(id,dimension)=>request({url:base+'/reports/'+encodeURIComponent(id)+'/export',params:{dimension},responseType:'blob',timeout:120000})

export const staffLookup=(shopId,login)=>request({url:base+'/operations/staff-lookup',params:{shopId,login}})
export const auditDetail=(shopId,id)=>request({url:base+'/operations/audit/'+id,params:{shopId}})
