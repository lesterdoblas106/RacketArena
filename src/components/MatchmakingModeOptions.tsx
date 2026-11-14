import { useId } from 'react'
import type { MatchmakingMode } from '../types/app'

const modes = [
  {
    value: 'smart-queue',
    label: 'Smart Queue',
    description: 'Builds balanced matches using skill, games played, and waiting time.',
  },
  {
    value: 'win-lose-stack',
    label: 'Win/Lose Stack',
    description: 'Rotates players through Winners and Losers queues based on match results.',
  },
] as const

type Props = {
  value: MatchmakingMode
  onChange: (mode: MatchmakingMode) => void
  disabled?: boolean
}

export function MatchmakingModeOptions({ value, onChange, disabled }: Props) {
  const groupId = useId()

  return (
    <fieldset className="matchmaking-mode-options" disabled={disabled}>
      <legend>Matchmaking Mode</legend>
      {modes.map((mode) => {
        const optionId = `${groupId}-${mode.value}`
        return (
          <label key={mode.value} className="matchmaking-mode-option">
            <input
              type="radio"
              name={groupId}
              value={mode.value}
              checked={value === mode.value}
              onChange={() => onChange(mode.value)}
              aria-labelledby={`${optionId}-label`}
              aria-describedby={`${optionId}-description`}
            />
            <span>
              <strong id={`${optionId}-label`}>{mode.label}</strong>
              <small id={`${optionId}-description`}>{mode.description}</small>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
