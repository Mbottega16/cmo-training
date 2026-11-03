import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/teko/600.css';
import '@fontsource/teko/700.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './style.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

/**
 * Clickjacking guard. Static hosts like GitHub Pages can't send the header that forbids framing, so if another
 * site loads the app inside a frame, show only a link that opens it in its own tab.
 */
function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // a cross-site parent blocks the check, which itself means we are framed
  }
}

if (isFramed()) {
  root.render(
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-6 text-sm text-slate-300">
      <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="underline text-brand-orange">
        Open CMO Training in its own tab
      </a>
    </div>
  );
} else {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Ask the browser not to clear saved work when space runs low. Safari still clears data of sites not added to the
  // home screen after about 7 days without a visit; the app shows iPhone users how to install it.
  void navigator.storage?.persist?.().catch(() => undefined);

  // Offline support for the installed app. Only in the built site: in development it would cache stale code.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    });
  }
}
