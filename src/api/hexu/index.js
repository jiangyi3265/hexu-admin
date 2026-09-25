import request from '@/utils/request'
const base='/hexu/admin'
export const listShops=()=>request({url:base+'/shops'})
export const query=(path,shopId)=>request({url:base+'/'+path,params:{shopId}})
export const detail=id=>request({url:base+'/orders/'+encodeURIComponent(id)})
export const command=(operation,data,key=crypto.randomUUID())=>request({url:base+'/commands/'+operation,method:'post',data,headers:{'Idempotency-Key':key,repeatSubmit:false}})
export const agencyCommand=(path,data,key=crypto.randomUUID())=>request({url:base+'/agency/'+path,method:'post',data,headers:{'Idempotency-Key':key,repeatSubmit:false}})
export const attachment=id=>request({url:'/hexu/app/attachments/'+encodeURIComponent(id),responseType:'blob'})

export const channelRetry=id=>request({url:base+'/channel/retry/'+encodeURIComponent(id),method:'post'})

export const startBackup=()=>request({url:base+'/backups',method:'post',data:{},headers:{'Idempotency-Key':crypto.randomUUID(),repeatSubmit:false}})

export const uploadFinance=(file,shopId,purpose='FINANCE')=>{const data=new FormData();data.append('file',file);data.append('shopId',shopId);data.append('purpose',purpose);return request({url:'/hexu/app/attachments',method:'post',data,headers:{'Content-Type':undefined,repeatSubmit:false}})}

export const reportJobs=shopId=>request({url:base+'/reports',params:{shopId}})
export const reportResult=(id,params)=>request({url:base+'/reports/'+encodeURIComponent(id),params})
export const reportInventory=(id,page)=>request({url:base+'/reports/'+encodeURIComponent(id)+'/inventory',params:{page,size:100}})
export const reportExport=(id,dimension)=>request({url:base+'/reports/'+encodeURIComponent(id)+'/export',params:{dimension},responseType:'blob',timeout:120000})

export const staffLookup=(shopId,login)=>request({url:base+'/operations/staff-lookup',params:{shopId,login}})
export const auditDetail=(shopId,id)=>request({url:base+'/operations/audit/'+id,params:{shopId}})
