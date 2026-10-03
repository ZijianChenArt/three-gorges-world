import { defineConfig } from 'vite';
export default defineConfig({base: './',build:{target:['chrome111','safari16.4','ios16.4','firefox114'],license:{fileName:'THIRD_PARTY_LICENSES.txt'},chunkSizeWarningLimit:800}});
