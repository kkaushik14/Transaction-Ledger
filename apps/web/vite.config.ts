/** Configures React development and production bundling for the web workspace. */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()], server: { port: 5173, strictPort: true } });
