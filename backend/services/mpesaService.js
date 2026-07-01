// mpesaService.js -- Daraja (M-Pesa) integration.
//
// Uses got-scraping instead of axios for the actual HTTP calls. Reason:
// Safaricom sandbox sits behind Imperva, which blocks requests from
// cloud/datacenter IPs at the network level (confirmed via extensive
// testing -- same empty-400 signature from Render AND a separate Oracle
// Cloud VM). Routing through a residential proxy fixed this for raw curl
// requests, but axios/Node's native TLS stack still got blocked even
// through the same working proxy -- most likely due to TLS ClientHello
// fingerprinting (JA3), which Imperva-class WAFs are known to use.
// got-scraping mimics a real browser's TLS fingerprint instead of
// Node's default OpenSSL one, which is the actual fix for that layer.

const crypto = require('crypto');

// got-scraping is ESM-only; this project is CommonJS, so we load it via
// a cached dynamic import rather than converting the whole app to ESM.
let gotScrapingPromise = null;
function loadGotScraping() {
    if (!gotScrapingPromise) {
        gotScrapingPromise = import('got-scraping').then((m) => m.gotScraping);
    }
    return gotScrapingPromise;
}

// Sandbox for testing, production once Safaricom approves your live app.
const BASE = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

// If QUOTAGUARDSTATIC_URL is set (Render env var), route Daraja calls
// through it -- currently a Webshare residential-proxy URL, in the same
// format http://user:pass@host:port. Left undefined for local dev.
const PROXY_URL = process.env.QUOTAGUARDSTATIC_URL || undefined;

// Small helper: makes a GET/POST via got-scraping and normalizes the
// result into either a parsed JSON body (success) or a thrown Error with
// .status and .data attached (failure) -- so calling code can handle
// errors the same way regardless of got-scraping's own throw behavior.
async function request({ method, url, headers, json }) {
    const gotScraping = await loadGotScraping();

    const res = await gotScraping({
        url,
        method,
        headers,
        json,
        proxyUrl: PROXY_URL,
        responseType: 'json',
        throwHttpErrors: false,
        timeout: { request: 20000 },
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
        const err = new Error(`Request failed with status code ${res.statusCode}`);
        err.status = res.statusCode;
        err.data = res.body;
        throw err;
    }

    return res.body;
}

// ---- Token cache (Daraja tokens last ~1 hour; don't fetch one per request) ----
let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiry) return cachedToken;

    const auth = Buffer
        .from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`)
        .toString('base64');

    try {
        const data = await request({
            method: 'GET',
            url: `${BASE}/oauth/v1/generate?grant_type=client_credentials`,
            headers: { Authorization: `Basic ${auth}` },
        });

        cachedToken = data.access_token;
        // refresh 60s before the stated expiry
        tokenExpiry = now + ((Number(data.expires_in) || 3600) - 60) * 1000;
        return cachedToken;
    } catch (err) {
        console.error('getToken error - status:', err.status);
        console.error('getToken error - data:', JSON.stringify(err.data));
        console.error('getToken error - message:', err.message);
        throw err;
    }
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
        const data = await request({
            method: 'POST',
            url: `${BASE}/mpesa/stkpush/v1/processrequest`,
            headers: { Authorization: `Bearer ${token}` },
            json: payload,
        });
        return data;
    } catch (err) {
        console.error('stkPush error - status:', err.status);
        console.error('stkPush error - data:', JSON.stringify(err.data));
        throw err;
    }
}

module.exports = { getToken, stkPush, formatPhone };