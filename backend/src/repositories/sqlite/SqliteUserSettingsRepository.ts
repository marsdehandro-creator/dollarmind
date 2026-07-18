/**
 * SQLite-backed UserSettingsRepository.
 */
import type { Db } from '../../db/connection.js';
import type { UserSettings } from '../../models/index.js';
import type { UserSettingsRepository } from '../UserSettingsRepository.js';
import { rowToUserSettings, type Row } from './rowMappers.js';

export class SqliteUserSettingsRepository implements UserSettingsRepository {
  constructor(private readonly db: Db) {}

  async findByUser(userId: string): Promise<UserSettings | null> {
    const row = this.db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId) as Row | undefined;
    return row ? rowToUserSettings(row) : null;
  }

  async save(s: UserSettings): Promise<UserSettings> {
    this.db
      .prepare(
        `INSERT INTO user_settings (user_id, tenant_id, display_name, theme, currency, chart_type, default_month, layout, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           display_name = excluded.display_name,
           theme = excluded.theme,
           currency = excluded.currency,
           chart_type = excluded.chart_type,
           default_month = excluded.default_month,
           layout = excluded.layout,
           updated_at = excluded.updated_at`,
      )
      .run(
        s.userId,
        s.tenantId,
        s.displayName,
        s.theme,
        s.currency,
        s.chartType,
        s.defaultMonth,
        s.layout,
        s.createdAt,
        s.updatedAt,
      );
    return s;
  }
}
