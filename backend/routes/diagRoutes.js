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
const axios = require('axios');
const { axiosOpts } = require('../services/mpesaService');

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

// GET /api/diag/proxy-check
// Verifies the proxy is genuinely being used for outbound Daraja-style
// requests. Uses the EXACT same axiosOpts (httpsAgent, headers) that
// mpesaService.js uses for real Daraja calls -- so if this shows Render's
// raw IP instead of the residential proxy's IP, we know https-proxy-agent
// is silently bypassing the tunnel for the real requests too.
router.get('/proxy-check', async (req, res) => {
    try {
        const { data } = await axios.get('https://api.ipify.org?format=json', axiosOpts);
        res.json({
            seenAsIp: data,
            usingProxy: !!process.env.QUOTAGUARDSTATIC_URL,
        });
    } catch (err) {
        res.status(500).json({
            error: err.message,
            status: err.response?.status,
            data: err.response?.data,
        });
    }
});

module.exports = router;