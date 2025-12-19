import http from 'node:http';
import os from 'node:os';
import { URL } from 'node:url';

export type RemoteCommand = 'go' | 'stopAll' | 'stopCue' | 'pauseToggle' | 'selectUp' | 'selectDown';

function getLikelyLanAddresses(): string[] {
  const nets = os.networkInterfaces();
  const out: string[] = [];

  for (const name of Object.keys(nets)) {
    const addrs = nets[name] ?? [];
    for (const addr of addrs) {
      if (!addr || addr.family !== 'IPv4') continue;
      if (addr.internal) continue;
      out.push(addr.address);
    }
  }

  return out;
}

function send(res: http.ServerResponse, status: number, body: string, contentType = 'text/plain; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function serveHomePage(port: number) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Go Button Remote</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 520px; }
  button { font-size: 22px; padding: 18px 14px; cursor: pointer; }
  .go { grid-column: 1 / -1; font-size: 28px; padding: 22px 16px; }
  .hint { opacity: 0.7; margin-top: 12px; max-width: 520px; }
</style>
</head>
<body>
<h2>Go Button Remote</h2>
<div class="grid">
  <button class="go" onclick="cmd('go')">GO</button>
  <button onclick="cmd('stopCue')">Stop Cue</button>
  <button onclick="cmd('stopAll')">Stop All</button>
  <button onclick="cmd('pauseToggle')">Pause / Resume</button>
  <button onclick="cmd('selectUp')">Cue ▲</button>
  <button onclick="cmd('selectDown')">Cue ▼</button>
</div>
<div class="hint">
  Remote is served from the Windows box. If commands do nothing, make sure the app is open on the Show Run screen.
</div>
<script>
async function cmd(name) {
  try {
    await fetch('/api/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd: name }) });
  } catch (e) {
    console.error(e);
  }
}
</script>
</body>
</html>`;

  return html;
}

export function startRemoteServer(opts: {
  port?: number;
  onCommand: (cmd: RemoteCommand) => void;
}) {
  const port = opts.port ?? 17832;

  const server = http.createServer((req, res) => {
    const method = (req.method ?? 'GET').toUpperCase();
    const u = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (method === 'GET' && u.pathname === '/') {
      return send(res, 200, serveHomePage(port), 'text/html; charset=utf-8');
    }

    if (u.pathname === '/api/cmd' && method === 'POST') {
      let raw = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        raw += chunk;
        if (raw.length > 10_000) req.destroy();
      });
      req.on('end', () => {
        try {
          const parsed = raw ? (JSON.parse(raw) as { cmd?: string }) : {};
          const cmd = String(parsed.cmd ?? '');
          if (
            cmd === 'go' ||
            cmd === 'stopAll' ||
            cmd === 'stopCue' ||
            cmd === 'pauseToggle' ||
            cmd === 'selectUp' ||
            cmd === 'selectDown'
          ) {
            opts.onCommand(cmd);
            return send(res, 204, '');
          }
          return send(res, 400, 'Unknown command');
        } catch {
          return send(res, 400, 'Invalid JSON');
        }
      });
      return;
    }

    return send(res, 404, 'Not found');
  });

  server.listen(port, '0.0.0.0');

  const addrs = getLikelyLanAddresses();
  if (addrs.length > 0) {
    console.log('[remote] Remote control page:');
    for (const ip of addrs) console.log(`  http://${ip}:${port}/`);
  } else {
    console.log(`[remote] Remote control page: http://<this-pc-ip>:${port}/`);
  }

  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
