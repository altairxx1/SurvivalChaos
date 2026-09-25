// Electron shell: opens the game in a desktop window and serves the same build on the local network
// so other PCs can join with a browser (http://<this-pc>:4173). Dev mode loads the Vite dev server instead.
const { app, BrowserWindow, Menu, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.SC_PORT || 4173);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream' };

function serveLan() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.normalize(path.join(DIST, url === '/' ? 'index.html' : url));
    if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.on('error', e => console.warn('LAN server not started:', e.message));
  server.listen(PORT, '0.0.0.0', () => {
    const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${PORT}`);
    console.log(`Survival Chaos is served on your network at: ${ips.join(', ') || `http://localhost:${PORT}`}`);
  });
  return server;
}

function createWindow() {
  const win = new BrowserWindow({ width: 1600, height: 900, minWidth: 1024, minHeight: 640, backgroundColor: '#0b0a08', title: 'Survival Chaos', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (_e, input) => { if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen()); if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools(); });
  if (process.env.ELECTRON_DEV_URL) void win.loadURL(process.env.ELECTRON_DEV_URL);
  else void win.loadFile(path.join(DIST, 'index.html'));
}

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.whenReady().then(() => { if (!process.env.ELECTRON_DEV_URL && process.env.SC_NO_LAN !== '1') serveLan(); createWindow(); });
app.on('window-all-closed', () => app.quit());
