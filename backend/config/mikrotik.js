// backend/config/mikrotik.js
const { RouterOSAPI } = require('node-routeros');

const api = new RouterOSAPI({
  host: process.env.MIKROTIK_HOST,
  user: process.env.MIKROTIK_USER,
  password: process.env.MIKROTIK_PASSWORD,
  port: Number(process.env.MIKROTIK_PORT) || 8728,
  timeout: 10,
});

let connecting = null;
async function ensureConnected() {
  if (api.connected) return;
  if (!connecting) {
    connecting = api.connect()
      .then(() => { connecting = null; })
      .catch((err) => { connecting = null; throw err; });
  }
  return connecting;
}

// Same interface your service already uses (client.write), but auto-connects.
module.exports = {
  write: async (path, params = []) => {
    await ensureConnected();
    return api.write(path, params);
  },
  raw: api,
};