import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { AuthProvider } from './sdk/auth/AuthProvider.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Outermost crash net: a render failure anywhere below shows a styled
        recovery screen instead of a blank page. */}
    <ErrorBoundary>
      {/* Shared session: games and sync read it, nothing fetches twice. */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);