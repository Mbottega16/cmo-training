/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set at build time (GitHub repository variables) to switch from the demo to the real backend. Both are public by design. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
