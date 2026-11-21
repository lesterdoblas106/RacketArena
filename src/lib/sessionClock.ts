import type { Session } from '../types/app'

export const defaultSimulationSpeed = 30
export const isValidSimulationSpeed = (speed: number) => Number.isFinite(speed) && speed > 0

export const getSimulationSpeed = (session: Session) =>
  isValidSimulationSpeed(session.simulation?.speed ?? NaN)
    ? session.simulation!.speed
    : defaultSimulationSpeed

export const isSimulationLocked = (session: Session) =>
  session.startedAt != null || session.endedAt != null || session.simulation?.realAnchor != null

/** Input is always real time; output is session time. Never pass virtual time in. */
export function getSessionNow(session: Session, realNow = Date.now()): number {
  if (session.endedAt != null) return session.endedAt
  if (session.matchmakingMode !== 'testing-ground' || session.startedAt == null) return realNow
  const realAnchor = session.simulation?.realAnchor ?? session.startedAt
  const virtualAnchor = session.simulation?.virtualAnchor ?? session.startedAt
  return virtualAnchor + Math.max(0, realNow - realAnchor) * getSimulationSpeed(session)
}

export function configureSimulationSpeed(session: Session, speed: number): Session {
  if (session.matchmakingMode !== 'testing-ground' || isSimulationLocked(session)
      || !isValidSimulationSpeed(speed)) return session
  return { ...session, simulation: { speed } }
}

export function startSimulationClock(session: Session, realNow: number): Session['simulation'] {
  if (session.matchmakingMode !== 'testing-ground') return session.simulation
  return { speed: getSimulationSpeed(session), realAnchor: realNow, virtualAnchor: realNow }
}
