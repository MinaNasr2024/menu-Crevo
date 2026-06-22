import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';
import { LanguageProvider } from './context/LanguageContext';
import { TableSessionProvider } from './context/TableSessionContext';

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
        <TableSessionProvider>
          <App />
        </TableSessionProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
