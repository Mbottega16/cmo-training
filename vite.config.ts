import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const page = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Content-Security-Policy for the built site. Static hosts (GitHub Pages) can't send headers, so it goes in a meta tag.
// Dev mode skips it because Vite's hot reload needs inline scripts. The backend's address is allowed only when set.
function csp(supabaseUrl: string | undefined): string {
  const backend = supabaseUrl ? ` ${new URL(supabaseUrl).origin} wss://${new URL(supabaseUrl).host}` : '';
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    `connect-src 'self'${backend}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join('; ');
}

function contentSecurityPolicy(policy: string): Plugin {
  return {
    name: 'cmo-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
    }
  };
}

/** Tells the service worker every built file (so any page opens offline after one visit) and versions its cache. */
function precacheList(): Plugin {
  let files: string[] = [];
  return {
    name: 'cmo-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      files = Object.keys(bundle).filter(f => /\.(js|css)$/.test(f) || (/\.woff2$/.test(f) && /latin/.test(f))).sort();
    },
    writeBundle(options) {
      const sw = join(options.dir ?? 'dist', 'sw.js');
      const hash = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 10);
      const src = readFileSync(sw, 'utf8')
        .replace("const CACHE = 'cmo-training-dev';", `const CACHE = 'cmo-training-${hash}';`)
        .replace('const BUILD_ASSETS = [];', `const BUILD_ASSETS = ${JSON.stringify(files.map(f => `./${f}`))};`);
      if (!src.includes(hash)) throw new Error('sw.js placeholders not found');
      writeFileSync(sw, src);
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // Relative paths so the built site works from any folder, including a GitHub Pages project URL.
    base: './',
    plugins: [react(), contentSecurityPolicy(csp(env.VITE_SUPABASE_URL)), precacheList()],
    build: {
      // Never inline fonts or media as data: URLs: the CSP only allows files from this site.
      assetsInlineLimit: 0,
      // Four pages: the front door, the coach's page, the athlete's page and the owner's dev page.
      rollupOptions: {
        input: { main: page('./index.html'), coach: page('./coach/index.html'), athlete: page('./athlete/index.html'), dev: page('./dev/index.html') }
      }
    },
    server: {
      // Local only, on an explicit address so a busy port is noticed and the next free one is used.
      host: '127.0.0.1',
      port: 5173
    }
  };
});
