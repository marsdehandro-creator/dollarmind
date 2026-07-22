/**
 * Settings page: app lock, backup/restore, and preferences. V1 has no
 * accounts, so there's no profile or password section here (see
 * AuthContext.tsx) — and no Sessions page either (that was a server-session
 * concept that doesn't apply offline).
 */
import { PreferencesPanel } from '../../components/settings/PreferencesPanel.js';
import { PinLockSettings } from '../../components/settings/PinLockSettings.js';
import { DataExportImport } from '../../components/settings/DataExportImport.js';

export function SettingsPage() {
  return (
    <section>
      <h1>Settings</h1>
      <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <PinLockSettings />
          <DataExportImport />
        </div>
        <PreferencesPanel />
      </div>
    </section>
  );
}
