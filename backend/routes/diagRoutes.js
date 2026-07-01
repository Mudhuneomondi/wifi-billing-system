// TEMPORARY DIAGNOSTIC ROUTE -- delete after use.
// Purpose: Render's free tier has no fixed outbound IP and no Shell access,
// so we can't just "look up" what IP it uses. This route makes Render itself
// ask a public IP-echo service what address it's currently seen as, so that
// IP can be added to Webshare's IP Authorization whitelist.
//
// GET /api/diag/myip

const express = require('express');
const router = express.Router();
const https = require('https');

router.get('/myip', (req, res) => {
    https.get('https://api.ipify.org?format=json', (ipRes) => {
        let body = '';
        ipRes.on('data', (chunk) => { body += chunk; });
        ipRes.on('end', () => {
            res.json({ renderOutboundIp: body });
        });
    }).on('error', (err) => {
        res.status(500).json({ error: err.message });
    });
});

module.exports = router;