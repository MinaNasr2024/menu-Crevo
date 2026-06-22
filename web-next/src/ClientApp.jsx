'use client';

import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';

export default function ClientApp() {
  const [mounted, setMounted] = useState(false);
  const [App, setApp] = useState(null);
  const [LanguageProvider, setLanguageProvider] = useState(null);
  const [TableSessionProvider, setTableSessionProvider] = useState(null);

  useEffect(() => {
    setMounted(true);

    let active = true;
    Promise.all([
      import('../site/App'),
      import('../site/context/LanguageContext'),
      import('../site/context/TableSessionContext')
    ]).then(([appModule, languageModule, tableSessionModule]) => {
      if (!active) return;
      setApp(() => appModule.App);
      setLanguageProvider(() => languageModule.LanguageProvider);
      setTableSessionProvider(() => tableSessionModule.TableSessionProvider);
    }).catch(() => {});

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => registration.unregister().catch(() => {}));
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, []);

  if (!mounted || !App || !LanguageProvider || !TableSessionProvider) {
    return null;
  }

  return (
    <BrowserRouter>
      <LanguageProvider>
        <TableSessionProvider>
          <App />
        </TableSessionProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
