import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { AuthProvider } from './sdk/auth/AuthProvider.jsx';
import { supabaseEnabled } from './sdk/auth/supabaseClient.js';

// Auth is pluggable. With Supabase keys present, Supabase owns sessions and
// renders our own unbranded sign-in UI; without them the original Google +
// HttpOnly-cookie flow runs unchanged. Both expose the same AuthContext shape,
// so nothing downstream knows which one is live — and removing the keys reverts
// to working Google sign-in rather than a broken site.

const mode = supabaseEnabled() ? 'supabase' : 'legacy';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Outermost crash net: a render failure anywhere below shows a styled
        recovery screen instead of a blank page. */}
    <ErrorBoundary>
      <AuthProvider mode={mode}>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Installability and offline shell only. Production-only on purpose: a worker
// registered from `vite dev` would serve stale bundles across code changes,
// which is exactly the class of caching bug the site Worker was written to
// avoid.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is an enhancement. A failed registration must never
      // surface as an error in the game library.
    });
  });
}
