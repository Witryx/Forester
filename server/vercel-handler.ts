import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';

// Carry the API path explicitly, independent of how Vercel rewrites req.url.
export function restoreApiUrl(value: string) {
  const url = new URL(value, 'http://localhost');
  const path = url.searchParams.get('__foresterPath');
  if (path === null) return value;
  url.pathname = `/api/${path}`;
  url.searchParams.delete('__foresterPath');
  if (!url.pathname.startsWith('/api/')) throw new Error('Invalid API path');
  return url.pathname + url.search;
}

export function createVercelHandler(loadApp: () => Promise<Express>) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      req.url = restoreApiUrl(req.url ?? '/api');
      const app = await loadApp();
      app(req, res);
    } catch {
      console.error('Forester API: inicializace databáze nebo prostředí selhala.');
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(
        JSON.stringify({ message: 'Služba není připravená. Zkontrolujte nastavení databáze.' }),
      );
    }
  };
}
