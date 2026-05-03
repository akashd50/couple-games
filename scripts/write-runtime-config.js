// Generates public/runtime-config.js from environment variables at build time.
// Render injects SOCKET_URL via render.yaml; locally the committed file is used.

const fs = require('fs');
const path = require('path');

const raw = (process.env.SOCKET_URL || '').trim();
const url = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;

const target = path.join(__dirname, '..', 'public', 'runtime-config.js');
const body = `window.__SOCKET_URL__ = ${JSON.stringify(url)};\n`;

fs.writeFileSync(target, body);
console.log(`[write-runtime-config] wrote ${target} (SOCKET_URL=${url || '<empty>'})`);
