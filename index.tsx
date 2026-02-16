import React from 'react';
import { createRoot } from 'react-dom/client';

// Polyfill process.env for browser environments to prevent crashes
// when services try to access API keys immediately on import
if (typeof (window as any).process === 'undefined') {
  (window as any).process = { env: {} };
}

import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);