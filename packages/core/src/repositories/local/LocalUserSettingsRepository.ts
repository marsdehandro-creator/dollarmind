/**
 * On-device (LocalDbDriver-backed) UserSettingsRepository. Same SQL/shape as
 * SqliteUserSettingsRepository.
 */
import type { LocalDbDriver } from '../../db/LocalDbDriver.js';
import type { UserSettings } from '../../models/index.js';
import type { UserSettingsRepository } from '../UserSettingsRepository.js';
import { rowToUserSettings, type Row } from '../rowMappers.js';

export class LocalUserSettingsRepository implements UserSettingsRepository {
  constructor(private readonly db: LocalDbDriver) {}

  async findByUser(userId: string): Promise<UserSettings | null> {
    const rows = await this.db.query<Row>('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
    return rows[0] ? rowToUserSettings(rows[0]) : null;
  }

  async save(s: UserSettings): Promise<UserSettings> {
    await this.db.run(
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
      [s.userId, s.tenantId, s.displayName, s.theme, s.currency, s.chartType, s.defaultMonth, s.layout, s.createdAt, s.updatedAt],
    );
    return s;
  }
}
