import { matchmakingModes } from '../lib/matchmakingModes'
import { useId } from 'react'
import type { MatchmakingMode } from '../types/app'

const modes = matchmakingModes

type Props = {
  value: MatchmakingMode
  onChange: (mode: MatchmakingMode) => void
  disabled?: boolean
}

export function MatchmakingModeOptions({ value, onChange, disabled }: Props) {
  const groupId = useId()
  const selectedMode = modes.find((mode) => mode.value === value)
  const descriptionId = `${groupId}-description`

  return (
    <fieldset className="matchmaking-mode-options" disabled={disabled} aria-describedby={descriptionId}>
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
            />
            <span id={`${optionId}-label`}>{mode.label}</span>
          </label>
        )
      })}
      <p id={descriptionId} className="matchmaking-mode-description" aria-live="polite">
        {selectedMode?.description}
      </p>
    </fieldset>
  )
}
