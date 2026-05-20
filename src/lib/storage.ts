import type { Member, Session } from '../types/app'

const STORAGE_KEY = 'racket-arena-state-v1'

export type PersistedState = {
  members: Member[]
  sessions: Session[]
  activeSessionId: string | null
}

export const loadState = (): PersistedState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    if (!parsed.members || !parsed.sessions) return null
    return {
      members: parsed.members,
      sessions: parsed.sessions,
      activeSessionId: parsed.activeSessionId ?? null,
    }
  } catch {
    return null
  }
}

export const saveState = (state: PersistedState): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
