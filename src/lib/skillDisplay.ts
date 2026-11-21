import { skillOrder, type Member, type Session, type Skill } from '../types/app'
import { getEloRating } from './eloRatings'

// Shared existing Smart Queue palette and CSS classes.
const skillStyles: Record<Skill, { className: string; color: string }> = {
  Newbie: { className: 'skill-newbie', color: '#d1d5db' },
  Beginner: { className: 'skill-beginner', color: '#fde047' },
  'Low Intermediate': { className: 'skill-low-intermediate', color: '#22c55e' },
  Intermediate: { className: 'skill-intermediate', color: '#3b82f6' },
  'High Intermediate': { className: 'skill-high-intermediate', color: '#8b5cf6' },
  Advanced: { className: 'skill-advanced', color: '#ef4444' },
  Elite: { className: 'skill-elite', color: '#111827' },
}

export const skillBorderClass = (skill: Skill) => skillStyles[skill].className
export const skillColor = (skill: Skill) => skillStyles[skill].color

// Integer levels are lower bounds: 4 <= rating < 5 is Intermediate.
// Clamp only the palette index, never the actual rating used by matchmaking.
export const getRatingCategory = (rating: number): Skill =>
  skillOrder[Math.max(0, Math.min(skillOrder.length - 1, Math.floor(rating) - 1))]

export const getSessionSkill = (session: Session, member: Member): Skill =>
  session.matchmakingMode === 'elo-smart-queue'
    ? getRatingCategory(getEloRating(session, member.id))
    : member.skill

export const getSessionSkillLabel = (session: Session, member: Member) =>
  session.matchmakingMode === 'elo-smart-queue'
    ? `Elo ${getEloRating(session, member.id).toFixed(1)} · ${getSessionSkill(session, member)}`
    : member.skill
