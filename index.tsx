import React from 'react';
import { createRoot } from 'react-dom/client';

// Polyfill process.env for browser environments
// This must execute before any other imports that might access process.env
if (typeof (window as any).process === 'undefined') {
  (window as any).process = { env: {} };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);

// Dynamically import App to ensure polyfills run first
import('./App')
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch((err) => {
    console.error("Failed to load application:", err);
    rootElement.innerHTML = `<div style="padding: 2rem; color: #ef4444; font-family: system-ui;">
      <h1>Something went wrong</h1>
      <p>The application failed to load. Please try refreshing the page.</p>
      <pre style="background: #f1f5f9; padding: 1rem; overflow: auto; border-radius: 0.5rem;">${err.message}</pre>
    </div>`;
  });