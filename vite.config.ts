import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

interface VectorEngineImageHandlerModule {
  handleImageRequest: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => Promise<void>;
}

function vectorEngineImageApi(): Plugin {
  return {
    name: 'vectorengine-image-api',
    configureServer(server) {
      server.middlewares.use('/api/images/generate', async (request, response) => {
        const handlerUrl = new URL('./server/vectorEngineImageHandler.mjs', import.meta.url);
        handlerUrl.searchParams.set('dev', String(Date.now()));
        const { handleImageRequest } = (await import(handlerUrl.href)) as VectorEngineImageHandlerModule;
        await handleImageRequest(request, response);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), vectorEngineImageApi()],
  server: {
    port: 5188,
    strictPort: true,
  },
  test: {
    exclude: ['node_modules/**', 'dist/**', '.worktrees/**'],
  },
});
