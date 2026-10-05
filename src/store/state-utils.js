export function readLayoutSetting(storage = () => localStorage) {
  try {
    const value = JSON.parse(storage().getItem('layout-setting'))
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}
