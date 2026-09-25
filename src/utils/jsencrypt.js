import JSEncrypt from 'jsencrypt'

// Keys must be supplied by the caller; no shared private key is shipped.
export function encrypt(text, publicKey) {
  if (!publicKey) throw new Error('A public key is required')
  const cipher = new JSEncrypt()
  cipher.setPublicKey(publicKey)
  return cipher.encrypt(text)
}

export function decrypt(text, privateKey) {
  if (!privateKey) throw new Error('A private key is required')
  const cipher = new JSEncrypt()
  cipher.setPrivateKey(privateKey)
  return cipher.decrypt(text)
}
