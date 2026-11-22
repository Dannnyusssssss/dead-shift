import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Content Security Policy of the published build. The game makes no network requests and loads
 * nothing from other origins, so everything is denied except its own script, stylesheet and icon.
 * Inline `<style>` blocks of index.html are allowed by their SHA-256 hash, never by
 * 'unsafe-inline'. Only added to the build: the dev server needs a WebSocket and inline styles
 * for hot reload. `frame-ancestors` cannot be set from a meta tag (it needs a response header).
 */
const CSP_DIRECTIVES = [
  "default-src 'none'",
  "script-src 'self'",
  "img-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
];

async function sha256Base64(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

function contentSecurityPolicy(): Plugin {
  return {
    name: 'dead-shift-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        const inline = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '');
        const hashes = await Promise.all(
          inline.map(async (s) => `'sha256-${await sha256Base64(s)}'`),
        );
        const policy = [...CSP_DIRECTIVES, `style-src 'self' ${hashes.join(' ')}`].join('; ');
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [contentSecurityPolicy()],
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
