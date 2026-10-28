import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      // Preserve the existing AI Studio HMR setting.
      hmr: process.env.DISABLE_HMR !== 'true',

      // Do not let conversation-data file changes trigger
      // development-preview updates.
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              ignored: ['**/data/users/**'],
            },
    },
  };
});