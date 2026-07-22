/**
 * UserSettingsRepository port.
 */
import type { UserSettings } from '../models/index.js';

export interface UserSettingsRepository {
  findByUser(userId: string): Promise<UserSettings | null>;
  /** Insert or update the settings row for a user. */
  save(settings: UserSettings): Promise<UserSettings>;
}
