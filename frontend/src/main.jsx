import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';
import { LanguageProvider } from './context/LanguageContext';
import { TableSessionProvider } from './context/TableSessionContext';
import { AppErrorBoundary } from './components/AppErrorBoundary';

function handleChunkLoadFailure() {
  try {
    if (sessionStorage.getItem('crevo-chunk-reload-attempted') === '1') return;
    sessionStorage.setItem('crevo-chunk-reload-attempted', '1');
    window.location.reload();
  } catch {
    window.location.reload();
  }
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault?.();
  handleChunkLoadFailure();
});

window.addEventListener('error', (event) => {
  const message = String(event?.message ?? event?.error?.message ?? '');
  if (message.includes('Failed to fetch dynamically imported module') || message.includes('Importing a module script failed')) {
    handleChunkLoadFailure();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const message = String(event?.reason?.message ?? event?.reason ?? '');
  if (message.includes('Failed to fetch dynamically imported module') || message.includes('Importing a module script failed')) {
    handleChunkLoadFailure();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister().catch(() => {}));
    }).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AppErrorBoundary>
          <TableSessionProvider>
            <App />
          </TableSessionProvider>
        </AppErrorBoundary>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
