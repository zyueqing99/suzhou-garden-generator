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
        const { handleImageRequest } = (await import('./server/vectorEngineImageHandler.mjs')) as VectorEngineImageHandlerModule;
        await handleImageRequest(request, response);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), vectorEngineImageApi()],
});
