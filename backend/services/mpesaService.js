const axios = require('axios');

// Sandbox for testing, production once Safaricom approves your live app.
const BASE = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

// ---- Token cache (Daraja tokens last ~1 hour; don't fetch one per request) ----
let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiry) return cachedToken;

    // TEMP DEBUG: confirm the consumer key/secret are even present before
    // we build the auth header (a missing env var silently becomes the
    // string "undefined" otherwise, which is a classic source of a 400
    // with no helpful body).
    console.log('getToken - MPESA_CONSUMER_KEY present:', !!process.env.MPESA_CONSUMER_KEY);
    console.log('getToken - MPESA_CONSUMER_SECRET present:', !!process.env.MPESA_CONSUMER_SECRET);
    console.log('getToken - MPESA_CONSUMER_KEY length:', (process.env.MPESA_CONSUMER_KEY || '').length);
    console.log('getToken - BASE url:', BASE);

    const auth = Buffer
        .from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`)
        .toString('base64');

    try {
        const { data } = await axios.get(
            `${BASE}/oauth/v1/generate?grant_type=client_credentials`,
            { headers: { Authorization: `Basic ${auth}` } }
        );

        cachedToken = data.access_token;
        // refresh 60s before the stated expiry
        tokenExpiry = now + ((Number(data.expires_in) || 3600) - 60) * 1000;
        return cachedToken;
    } catch (err) {
        console.error('getToken axios error - status:', err.response?.status);
        console.error('getToken axios error - data:', JSON.stringify(err.response?.data));
        console.error('getToken axios error - headers:', JSON.stringify(err.response?.headers));
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

    // TEMP DEBUG: log the exact payload being sent (no secrets beyond what
    // Daraja itself requires) so a 400 can be diagnosed from the Render logs.
    console.log('stkPush payload:', JSON.stringify({ ...payload, Password: '(hidden)' }));

    try {
        const { data } = await axios.post(
            `${BASE}/mpesa/stkpush/v1/processrequest`,
            payload,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return data;
    } catch (err) {
        console.error('stkPush axios error - status:', err.response?.status);
        console.error('stkPush axios error - data:', JSON.stringify(err.response?.data));
        throw err;
    }
}

module.exports = { getToken, stkPush, formatPhone };