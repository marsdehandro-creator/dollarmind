/**
 * Settings page: profile, password, and preferences.
 */
import { ProfileForm } from '../../components/settings/ProfileForm.js';
import { PasswordForm } from '../../components/settings/PasswordForm.js';
import { PreferencesPanel } from '../../components/settings/PreferencesPanel.js';
import { PinLockSettings } from '../../components/settings/PinLockSettings.js';
import { DataExportImport } from '../../components/settings/DataExportImport.js';
import { usePreferences } from '../../context/PreferencesContext.js';

export function SettingsPage() {
  const { preferences, refresh } = usePreferences();

  return (
    <section>
      <h1>Settings</h1>
      <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <ProfileForm displayName={preferences?.displayName ?? null} onSaved={() => void refresh()} />
          <PasswordForm />
          <PinLockSettings />
          <DataExportImport />
        </div>
        <PreferencesPanel />
      </div>
    </section>
  );
}
