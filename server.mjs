import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GET as page } from './app/route.ts';
import { GET, POST } from './app/api/[...path]/route.ts';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const origin = new URL(process.env.APECO_ORIGIN || `http://localhost:${port}`).origin;
const maxBody = 10 * 1024 * 1024 + 100000;

createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, origin);
    if (url.origin !== origin) return outgoing.writeHead(400).end();
    const headers = new Headers(incoming.headers);
    headers.set('apeco-client-address', incoming.socket.remoteAddress || 'unknown');
    let response;
    if (incoming.method === 'GET' && url.pathname === '/') {
      response = await page();
    } else if (url.pathname.startsWith('/api/') && incoming.method === 'GET') {
      response = await GET(new Request(url, { headers }));
    } else if (url.pathname.startsWith('/api/') && incoming.method === 'POST') {
      if (headers.get('origin') !== origin) return outgoing.writeHead(403).end();
      const limit = url.pathname === '/api/attachments/upload' ? maxBody : 500000;
      if (Number(headers.get('content-length')) > limit) return outgoing.writeHead(413).end();
      const chunks = [];
      let size = 0;
      for await (const chunk of incoming.iterator({ destroyOnReturn: false })) {
        size += chunk.length;
        if (size > limit) {
          outgoing.writeHead(413, { Connection: 'close' }).end();
          return;
        }
        chunks.push(chunk);
      }
      response = await POST(new Request(url, { method: 'POST', headers, body: Buffer.concat(chunks) }));
    } else {
      return outgoing.writeHead(404).end();
    }
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) await pipeline(Readable.fromWeb(response.body), outgoing);
    else outgoing.end();
  } catch {
    if (outgoing.headersSent) outgoing.destroy();
    else outgoing.writeHead(500).end();
  }
}).listen(port, host, () => console.log(`APECO ePTW listening at ${origin}`));
