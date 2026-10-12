import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Pages are lazy-loaded (src/App.jsx). The largest remaining chunk is the
    // Firestore SDK itself (~520 kB minified, ~155 kB gzip), which every page
    // needs — so raise the warning threshold just above it.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Keep the always-needed Firebase core (app / auth / firestore) in its
          // own long-cached chunk. RTDB, Storage and Functions stay out of it —
          // they're only loaded by the pages that use them.
          groups: [
            {
              name: 'firebase',
              test: /node_modules[\\/](firebase[\\/](app|auth|firestore)|@firebase[\\/](app|auth|firestore|component|logger|util|webchannel-wrapper))[\\/]/,
            },
          ],
        },
      },
    },
  },
})