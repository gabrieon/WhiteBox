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
