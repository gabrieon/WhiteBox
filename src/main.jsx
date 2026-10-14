import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { AuthProvider } from './sdk/auth/AuthProvider.jsx';
import { clerkEnabled } from './sdk/auth/clerkToken.js';

// Auth is pluggable. With a Clerk publishable key present the whole app runs
// inside ClerkProvider and Clerk owns sessions; without it the original Google
// + cookie flow runs unchanged. Both expose the same AuthContext shape, so
// nothing downstream knows which one is live — and removing the key reverts to
// working Google sign-in rather than a broken site.

const publishableKey = import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY || '';
const useClerk = clerkEnabled();

function tree(mode) {
  return (
    <AuthProvider mode={mode}>
      <App />
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Outermost crash net: a render failure anywhere below shows a styled
        recovery screen instead of a blank page. */}
    <ErrorBoundary>
      {useClerk ? (
        <ClerkProvider publishableKey={publishableKey}>{tree('clerk')}</ClerkProvider>
      ) : (
        tree('legacy')
      )}
    </ErrorBoundary>
  </StrictMode>,
);