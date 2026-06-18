const { RouterOSClient } = require('node-routeros');

const client = new RouterOSClient({
    host: process.env.MIKROTIK_HOST,
    user: process.env.MIKROTIK_USER,
    password: process.env.MIKROTIK_PASSWORD,
    port: 8728
});

module.exports = client;