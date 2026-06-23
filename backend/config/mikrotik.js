// backend/config/mikrotik.js
const { RouterOSAPI } = require('node-routeros');
require('dotenv').config();

const client = new RouterOSAPI({
  host: process.env.MIKROTIK_HOST,
  user: process.env.MIKROTIK_USER,
  password: process.env.MIKROTIK_PASSWORD,
  port: Number(process.env.MIKROTIK_PORT) || 8728,
  timeout: 10,
});

async function getClient() {
  if (!client.connected) {
    await client.connect();
  }
  return client;
}

module.exports = { client, getClient };