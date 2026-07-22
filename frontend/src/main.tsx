/**
 * Frontend entry point (pilot).
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { AuthProvider } from './context/AuthContext.js';
import { PreferencesProvider } from './context/PreferencesContext.js';
import { PinLockProvider } from './context/PinLockContext.js';
import { PinLockGate } from './components/security/PinLockGate.js';
import { getContainer } from './local/container.js';
import './index.css';

// Kick off on-device DB bootstrap (open -> migrate -> seed) immediately, so it
// runs during the splash screen instead of blocking the first page's data load.
void getContainer();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <PinLockProvider>
        <PinLockGate>
          <AuthProvider>
            <PreferencesProvider>
              <App />
            </PreferencesProvider>
          </AuthProvider>
        </PinLockGate>
      </PinLockProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
