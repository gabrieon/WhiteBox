import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './sdk/auth/AuthProvider.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* AuthProvider wraps the app so the header, games and library all read
        one shared session instead of each fetching it. */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);