import request from '@/utils/request'
import { adminPaths, pickOrderPath, trackingPath } from './contracts'
import { idempotentPost as retryablePost } from '@/api/hexu'

const base = '/hexu/admin'
const idempotentPost = (url, data) => retryablePost(base + url, data)

export const merchantStatus = shopId => request({ url: base + adminPaths.merchant, params: { shopId } })
export const submitMerchant = data => idempotentPost(adminPaths.merchantSubmit, data)
export const authorizeMerchant = data => idempotentPost(adminPaths.merchantAuthorize, data)
export const saveMerchantCertificate = data => idempotentPost(adminPaths.merchantCertificate, data)
export const saveMerchantReference = data => idempotentPost(adminPaths.merchantReference, data)
export const verifyMerchantStage = data => idempotentPost(adminPaths.merchantVerify, data)

export const listPolicies = shopId => request({ url: base + adminPaths.policies, params: { shopId } })
export const publishPolicy = data => idempotentPost(adminPaths.policyPublish, data)
export const listPolicyConsents = shopId => request({ url: base + adminPaths.policyConsents, params: { shopId } })

export const listPickOrders = shopId => request({ url: base + adminPaths.pickOrders, params: { shopId } })
export const orderTracking = orderId => request({ url: base + trackingPath(orderId) })
export const trackingConfiguration = shopId => request({ url: base + adminPaths.trackingConfiguration, params: { shopId } })
export const pickPrintData = orderId => request({ url: base + pickOrderPath(orderId, 'print') })
export const startPick = orderId => idempotentPost(pickOrderPath(orderId, 'start'), {})
export const completePick = orderId => idempotentPost(pickOrderPath(orderId, 'complete'), {})

export const listAftersaleLinks = shopId => request({ url: base + adminPaths.aftersaleLinks, params: { shopId } })
export const listAftersaleCandidates = (shopId, customerRefundId) => request({ url: base + adminPaths.aftersaleCandidates, params: { shopId, customerRefundId } })
export const createAftersaleLink = data => idempotentPost(adminPaths.aftersaleLinks, data)
