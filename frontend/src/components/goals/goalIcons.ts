/**
 * DollarMind goal icon set (mapped to goal types).
 */
import type { GoalType } from '../../services/goalService.js';

export const GOAL_ICONS: Record<GoalType, string> = {
  house: '🏠',
  car: '🚗',
  vacation: '✈️',
  emergency: '🛟',
  custom: '🎯',
};

export const STANDING_LABEL: Record<string, string> = {
  achieved: 'Achieved',
  ahead: 'Ahead of schedule',
  on_track: 'On track',
  behind: 'Behind',
  no_deadline: 'No deadline',
};

export const STANDING_COLOR: Record<string, string> = {
  achieved: 'var(--success)',
  ahead: 'var(--success)',
  on_track: 'var(--blue)',
  behind: 'var(--gold)',
  no_deadline: 'var(--fg-muted)',
};
