export function createLatestContextGate(context) {
  let version = 0, disposed = false
  return {
    begin() {
      const request = ++version, captured = context()
      return () => { if (disposed || request !== version) return false; const now = context(); return captured.length === now.length && captured.every((value, i) => Object.is(value, now[i])) }
    },
    invalidate() { version++ },
    dispose() { disposed = true; version++ }
  }
}

export const workspaceExportSnapshot = ({ shopId, resource, title, filter, columns, rows }) =>
  ({ shopId, resource, title, filter, columns: columns.map(column => [...column]), rows: JSON.parse(JSON.stringify(rows)) })

// The backup API exists only when the backend runs with the hexu-dev profile.
export const backupEnabled = import.meta.env?.VITE_HEXU_BACKUPS_ENABLED === 'true'

export const workspaceTabs = (module, tabs = [], backupEnabled = false) =>
  module === 'audit' && !backupEnabled
    ? tabs.filter(([, path]) => path !== 'backups')
    : tabs
