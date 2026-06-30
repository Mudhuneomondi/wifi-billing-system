// TEMPORARY DIAGNOSTIC ROUTE -- delete this file (and its require line in
// server.js) once the Imperva/IP investigation is finished.
//
// Purpose: Render's free tier has no Shell access, so we can't run curl
// directly inside the container. This route does the rawest possible
// version of the same OAuth request -- Node's built-in https module, no
// axios, no proxy agent, no extra headers -- so we can see exactly what
// Render's network produces, with zero code-layer interference.
//
// GET /api/diag/daraja  (no auth -- temporary, remove after use)

const express = require('express');
const router = express.Router();
const https = require('https');

router.get('/daraja', (req, res) => {
    const auth = Buffer
        .from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`)
        .toString('base64');

    const options = {
        hostname: 'sandbox.safaricom.co.ke',
        path: '/oauth/v1/generate?grant_type=client_credentials',
        method: 'GET',
        headers: {
            Authorization: `Basic ${auth}`,
        },
    };

    const req2 = https.request(options, (darajaRes) => {
        let body = '';
        darajaRes.on('data', (chunk) => { body += chunk; });
        darajaRes.on('end', () => {
            res.json({
                status: darajaRes.statusCode,
                headers: darajaRes.headers,
                body: body || '(empty body)',
            });
        });
    });

    req2.on('error', (err) => {
        res.status(500).json({ error: err.message });
    });

    req2.end();
});

module.exports = router;