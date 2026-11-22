import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// base は相対パスにしているので、GitHub Pages のリポジトリ名が何であっても動きます。
export default defineConfig({
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: '単語カード',
        short_name: '単語カード',
        description: '自分専用の単語カード（Google Drive 同期）',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f5f1',
        theme_color: '#1f3a5f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        // Google の API や認証画面はキャッシュしない
        navigateFallbackDenylist: [/^\/oauth/],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
