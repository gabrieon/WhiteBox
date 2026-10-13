import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './sdk/auth/AuthProvider.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Shared session: games and sync read it, nothing fetches twice. */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
