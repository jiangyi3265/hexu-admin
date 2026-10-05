export function reviewDisplay(record = {}) {
  const body = record.body && typeof record.body === 'object' && !Array.isArray(record.body) ? record.body : {}
  const rating = Number(body.rating)
  return {
    body,
    appended: record.kind === 'review_append',
    stars: Number.isFinite(rating) ? Math.max(0, Math.min(5, Math.trunc(rating))) : 0,
    uploads: [...new Set((Array.isArray(body.uploads) ? body.uploads : []).filter(Boolean))]
  }
}
