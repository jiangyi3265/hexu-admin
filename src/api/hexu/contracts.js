export const adminPaths = Object.freeze({
  merchant: '/merchant',
  merchantSubmit: '/merchant/submit',
  merchantAuthorize: '/merchant/authorize',
  merchantCertificate: '/merchant/certificate',
  merchantReference: '/merchant/reference',
  merchantVerify: '/merchant/verify',
  policies: '/policies',
  policyPublish: '/policies/publish',
  policyConsents: '/policies/consents',
  pickOrders: '/fulfillment/pick',
  trackingConfiguration: '/tracking/configuration',
  aftersaleLinks: '/aftersale-links',
  aftersaleCandidates: '/aftersale-links/candidates'
})

export const pickOrderPath = (orderId, action) =>
  `${adminPaths.pickOrders}/${encodeURIComponent(orderId)}/${action}`

export const trackingPath = orderId => `/orders/${encodeURIComponent(orderId)}/tracking`

export const memberProfilePath = memberId => `/members/${encodeURIComponent(memberId)}/profile`
