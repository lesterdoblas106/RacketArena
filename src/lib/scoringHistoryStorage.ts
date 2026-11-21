import { scoringHistoryLimit, type ScoringSnapshot } from './smartQueueInspector'

let database: Promise<IDBDatabase> | undefined

function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('racket-arena-scoring', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('sessions')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return database
}

export async function loadScoringHistory(sessionId: string): Promise<ScoringSnapshot[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction('sessions').objectStore('sessions').get(sessionId)
    request.onsuccess = () => resolve(request.result ?? [])
    request.onerror = () => reject(request.error)
  })
}

export async function saveScoringHistory(sessionId: string, snapshots: ScoringSnapshot[]) {
  const db = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('sessions', 'readwrite')
    const store = transaction.objectStore('sessions')
    const request = store.get(sessionId)
    request.onsuccess = () => {
      const merged = new Map<string, ScoringSnapshot>()
      for (const snapshot of [...(request.result ?? []), ...snapshots]) merged.set(snapshot.id, snapshot)
      store.put([...merged.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, scoringHistoryLimit), sessionId)
    }
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
  })
}
