require('dotenv').config();
const { RouterOSAPI } = require('node-routeros');

const conn = new RouterOSAPI({
  host: process.env.MIKROTIK_HOST,
  user: process.env.MIKROTIK_USER,
  password: process.env.MIKROTIK_PASSWORD,
  port: Number(process.env.MIKROTIK_PORT) || 8728,
  timeout: 10,
});

(async () => {
  try {
    await conn.connect();
    console.log('✅ Connected to MikroTik');

    await conn.write('/ip/hotspot/user/add', [
      '=name=testuser', '=password=test123', '=profile=default',
    ]);
    console.log('✅ Created hotspot user testuser / test123');

    const users = await conn.write('/ip/hotspot/user/print');
    console.log('Users on router:', users.map(u => u.name));
    conn.close();
  } catch (e) {
    console.error('❌ Error:', e.message || e);
  }
})();