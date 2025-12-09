import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allow access from other devices on the same network
    port: 5174, // Custom port to avoid conflicts
    allowedHosts: [
      'app.getherd.ai',
      'localhost',
      '*.ngrok-free.app', // Allow access from ngrok
    ],
  },
   base: '/admin/',  // Set this to your subfolder name
  //  build: {
  //    minify: true,
  //    sourcemap: false,
  //    target: 'modules',
  //  },
});
