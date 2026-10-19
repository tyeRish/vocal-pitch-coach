import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run phone` serves over HTTPS on your local network so a phone can use the mic.
// GitHub Pages serves the app from /<repo-name>/, so production builds use that base path.
export default defineConfig(({ mode, command }) => ({
  base: command === 'build' ? '/vocal-pitch-coach/' : '/',
  plugins: [
    ...(mode === 'phone' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'Vocal Pitch Coach',
        short_name: 'Vocal Coach',
        description: 'Pitch, range, fry, grit and scream training — with a hands-free Drive Mode.',
        theme_color: '#0d0b14',
        background_color: '#0d0b14',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
