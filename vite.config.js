import { defineConfig } from 'vite';

// base './' so dist/ works as a static folder from any path (GitHub Release zip).
// three.js alone is ~600 kB minified, so raise the chunk warning limit.
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1000 } });
