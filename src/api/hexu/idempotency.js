const ordered = value => Array.isArray(value) ? value.map(ordered)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value

const sha256 = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('')

// Storage contains only an opaque hash -> random key, never an identity or request body.
export function createSessionRetryKeys(storage = () => sessionStorage, digest = sha256) {
  return {
    async load(actor, fingerprint) {
      try {
        const name = 'hexu-command-retry:' + await digest(JSON.stringify([actor, fingerprint]))
        const key = storage().getItem(name)
        return { name, key: typeof key === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(key) ? key : null }
      } catch { return { name: null, key: null } }
    },
    save(name, key) { if (name) try { storage().setItem(name, key) } catch {} },
    remove(name, key) { if (name) try { if (storage().getItem(name) === key) storage().removeItem(name) } catch {} }
  }
}

// Keep the intent key when the result is uncertain; a confirmed success starts a new intent.
export function createRetryablePost(request, identity = () => '', newKey = () => crypto.randomUUID(), retainedKeys) {
  const intents = new Map()
  let currentIdentity
  return function post(url, data, explicitKey) {
    const actor = identity()
    if (actor !== currentIdentity) { intents.clear(); currentIdentity = actor }
    const json = JSON.stringify(data), body = json === undefined ? undefined : JSON.parse(json)
    const config = key => ({ url, method: 'post', data: body, headers: { 'Idempotency-Key': key, repeatSubmit: false } })
    if (explicitKey !== undefined) return request(config(explicitKey))
    const fingerprint = JSON.stringify([url, ordered(body)])
    let intent = intents.get(fingerprint)
    if (!intent) { intent = { key: null, retainedName: null, pending: null }; intents.set(fingerprint, intent) }
    if (intent.pending) return intent.pending
    intent.pending = Promise.resolve().then(async () => {
      if (!intent.key) {
        const retained = retainedKeys ? await retainedKeys.load(actor, fingerprint) : null
        intent.retainedName = retained?.name
        intent.key = retained?.key || newKey()
      }
      if (identity() !== actor) {
        if (intents.get(fingerprint) === intent) intents.delete(fingerprint)
        // Nothing new was sent. Do not remove a restored key whose old result is unknown.
        throw new Error('登录账号已变化，请在当前账号重新确认操作')
      }
      retainedKeys?.save(intent.retainedName, intent.key)
      return request(config(intent.key))
    }).then(result => {
      if (intents.get(fingerprint) === intent) intents.delete(fingerprint)
      retainedKeys?.remove(intent.retainedName, intent.key)
      intent.pending = null
      return result
    }, error => { intent.pending = null; throw error })
    return intent.pending
  }
}
