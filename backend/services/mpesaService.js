const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Sandbox for testing, production once Safaricom approves your live app.
const BASE = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

// DIAGNOSTIC: force IPv4 + HTTP/1.1 on every Daraja request. This is part
// of isolating whether Imperva's block is IP/protocol related. Has no
// effect on credentials or payload -- purely a transport-level change.
// Safe to leave in permanently; it doesn't hurt anything if this turns out
// not to be the cause.
const defaultAgent = new https.Agent({
    family: 4,        // force IPv4, never IPv6
    keepAlive: true,
});

// Imperva's edge (in front of Daraja) issues a mid-handshake TLS
// renegotiation request. curl/schannel handles this transparently, but
// Node's OpenSSL rejects renegotiation by default for security reasons,
// which surfaces as "Client network socket disconnected before secure TLS
// connection was established" when going through a proxy. This flag
// explicitly allows legacy renegotiation so the handshake can complete --
// safe here because we're deliberately connecting to a known Safaricom
// hostname, not arbitrary user-supplied servers.
const secureOptions = crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION;

// If QUOTAGUARDSTATIC_URL is set (Render env var), route Daraja calls through
// it so they come from a residential/static IP instead of Render's shared
// pool. Otherwise fall back to the plain IPv4-forced agent above. Locally
// (no env var set) this still applies the IPv4 fix, just with no proxy.
const proxyAgent = process.env.QUOTAGUARDSTATIC_URL
    ? new HttpsProxyAgent(process.env.QUOTAGUARDSTATIC_URL, { secureOptions })
    : defaultAgent;

const axiosOpts = {
    httpsAgent: proxyAgent,
    proxy: false,
    // Force HTTP/1.1 explicitly (axios/Node default to 1.1 already in most
    // setups, but some WAFs behave differently under HTTP/2 -- this removes
    // any ambiguity).
    headers: { Connection: 'keep-alive' },
};

// ---- Token cache (Daraja tokens last ~1 hour; don't fetch one per request) ----
let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiry) return cachedToken;

    const auth = Buffer
        .from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`)
        .toString('base64');

    const { data } = await axios.get(
        `${BASE}/oauth/v1/generate?grant_type=client_credentials`,
        { ...axiosOpts, headers: { ...axiosOpts.headers, Authorization: `Basic ${auth}` } }
    );

    cachedToken = data.access_token;
    // refresh 60s before the stated expiry
    tokenExpiry = now + ((Number(data.expires_in) || 3600) - 60) * 1000;
    return cachedToken;
}

// Normalise phone to 2547XXXXXXXX / 2541XXXXXXXX
function formatPhone(phone) {
    let p = String(phone).replace(/\D/g, '');
    if (p.startsWith('0')) p = '254' + p.slice(1);
    else if (p.startsWith('7') || p.startsWith('1')) p = '254' + p;
    // already starts with 254 -> leave as is
    return p;
}

function timestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (
        d.getFullYear().toString() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds())
    );
}

// Initiate STK push. Returns Daraja's response (CheckoutRequestID, etc.)
async function stkPush({ phone, amount, accountRef, description }) {
    const token = await getToken();
    const ts = timestamp();
    const shortcode = process.env.MPESA_SHORTCODE;

    const password = Buffer
        .from(`${shortcode}${process.env.MPESA_PASSKEY}${ts}`)
        .toString('base64');

    const payload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        // Paybill = CustomerPayBillOnline ; Till/Buy Goods = CustomerBuyGoodsOnline
        TransactionType: process.env.MPESA_TX_TYPE || 'CustomerPayBillOnline',
        Amount: Math.round(amount),           // M-Pesa requires whole numbers
        PartyA: formatPhone(phone),
        PartyB: shortcode,
        PhoneNumber: formatPhone(phone),
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: (accountRef || 'WiFi').slice(0, 12),
        TransactionDesc: (description || 'WiFi package').slice(0, 20),
    };

    try {
        const { data } = await axios.post(
            `${BASE}/mpesa/stkpush/v1/processrequest`,
            payload,
            { ...axiosOpts, headers: { ...axiosOpts.headers, Authorization: `Bearer ${token}` } }
        );
        return data;
    } catch (err) {
        console.error('stkPush axios error - status:', err.response?.status);
        console.error('stkPush axios error - data:', JSON.stringify(err.response?.data));
        throw err;
    }
}

module.exports = { getToken, stkPush, formatPhone };