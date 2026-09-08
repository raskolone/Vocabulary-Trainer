import { createApp } from '../server';

export const maxDuration = 60;

const app = createApp();

export default function handler(req: any, res: any) {
  try {
    if (req.url) {
      const match = req.url.match(/[?&]__url=([^&]+)/);
      if (match) {
        req.url = decodeURIComponent(match[1]);
      } else {
        const originalPath = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.headers['x-original-url'];
        if (originalPath && typeof originalPath === 'string' && originalPath.startsWith('/api')) {
          req.url = originalPath;
        }
      }
    }
    app(req, res);
  } catch (err: any) {
    console.error('[API Gateway Crash]:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'API Gateway Crash',
        message: err?.message || String(err),
        stack: err?.stack || ''
      });
    }
  }
}
