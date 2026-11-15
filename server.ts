import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createApp } from './server/app.ts';
import { initRealtime } from './server/realtime.ts';

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);
  const app = createApp();
  const httpServer = http.createServer(app);

  initRealtime(httpServer);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`TeamForge server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start TeamForge server:', err);
  process.exit(1);
});
