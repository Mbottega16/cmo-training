import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Content-Security-Policy for the built site. Static hosts such as GitHub Pages can't send
// headers, so it goes in a meta tag. Dev mode skips it because Vite's hot reload needs inline scripts.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'cmo-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    }
  };
}

export default defineConfig({
  // Relative paths so the built site works from any folder, including a GitHub Pages project URL.
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  server: {
    // Local only, on an explicit address so a busy port is noticed and the next free one is used
    // (other projects on this Mac also use 5173). `npm run dev:phone` opens it to the Wi-Fi network.
    host: '127.0.0.1',
    port: 5173
  }
});
