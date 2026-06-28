const supabase = require('../config/supabase');
const { stkPush } = require('../services/mpesaService');


// 6-digit numeric PIN -- the WiFi login credential (paired with the username).
function generatePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Voucher-style username for walk-up buyers, e.g. "WIFI4827".
// Collision odds are negligible for this volume; createPhonePurchase
// re-rolls once if it ever does collide (see below).
function generateVoucherCode() {
    return 'WIFI' + Math.floor(1000 + Math.random() * 9000).toString();
}

// Normalizes a Kenyan number to the 2547XXXXXXXX format Daraja expects.
// Accepts 07..., +254..., 254... and returns null if it still doesn't fit.
function normalizePhone(raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 10) digits = '254' + digits.slice(1);
    if (digits.startsWith('254') && digits.length === 12) return digits;
    return null;
}


// ============================================================
// POST /api/mpesa/stk
// Body: { user_id, package_id, phone }
// EXISTING FLOW -- for an account that already exists (e.g. created via
// the admin panel). Renews/extends that specific user_id.
// ============================================================
const initiateStk = async (req, res) => {
    try {
        const { user_id, package_id, phone } = req.body;

        if (!user_id || !package_id || !phone) {
            return res.status(400).json({
                message: 'user_id, package_id and phone are required'
            });
        }

        const { data: pkg } = await supabase
            .from('packages').select('*').eq('id', package_id).maybeSingle();
        if (!pkg) return res.status(404).json({ message: 'Package not found' });

        const { data: user } = await supabase
            .from('users').select('id, username').eq('id', user_id).maybeSingle();
        if (!user) return res.status(404).json({ message: 'User not found' });

        const result = await stkPush({
            phone,
            amount: pkg.price,
            accountRef: user.username,
            description: pkg.package_name,
        });

        if (result.ResponseCode !== '0') {
            return res.status(502).json({ message: 'STK push not accepted', detail: result });
        }

        await supabase.from('payments').insert([{
            user_id,
            package_id,
            amount: pkg.price,
            payment_method: 'MPESA',
            status: 'PENDING',
            checkout_request_id: result.CheckoutRequestID,
            phone,
        }]);

        res.json({
            message: 'STK push sent. Ask the customer to enter their M-Pesa PIN.',
            checkout_request_id: result.CheckoutRequestID,
            customer_message: result.CustomerMessage,
        });

    } catch (err) {
        console.error('initiateStk error:', err.response?.data || err.message);
        res.status(500).json({
            message: 'Server error',
            error: err.response?.data || err.message
        });
    }
};


// ============================================================
// POST /api/mpesa/purchase
// Body: { phone, package_id }
// NEW FLOW -- for a walk-up customer who has no account yet (the captive
// portal's "Buy a bundle" tab uses this one, not /stk).
//
// The phone number is ONLY a payment + lookup reference -- it is never
// stored on the user record. Identity for WiFi login is a generated
// voucher code (works on any device: phone, laptop, TV).
//
// - New phone        -> creates a new voucher-code account.
// - Phone with an     -> reuses that same account; paying again renews/
//   existing account     extends it (handled in mpesaCallback).
// ============================================================
const createPhonePurchase = async (req, res) => {
    try {
        const { package_id } = req.body;
        const phone = normalizePhone(req.body.phone);

        if (!phone) {
            return res.status(400).json({ message: 'Enter phone as 07XXXXXXXX or 2547XXXXXXXX' });
        }
        if (!package_id) {
            return res.status(400).json({ message: 'package_id is required' });
        }

        const { data: pkg } = await supabase
            .from('packages').select('*').eq('id', package_id).maybeSingle();
        if (!pkg) return res.status(404).json({ message: 'Package not found' });

        // Has this phone paid before? Reuse that account (renew, don't duplicate).
        const { data: existingPayment } = await supabase
            .from('payments')
            .select('user_id')
            .eq('phone', phone)
            .not('user_id', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        let userId = existingPayment?.user_id || null;

        if (!userId) {
            // First time this phone has bought anything -- create a fresh
            // voucher account. Account password is a random placeholder;
            // WiFi login authenticates against hotspot_pin, not this.
            let code = generateVoucherCode();
            const { data: clash } = await supabase
                .from('users').select('id').eq('username', code).maybeSingle();
            if (clash) code = generateVoucherCode() + Math.floor(Math.random() * 9);

            const placeholderPassword = await require('bcrypt').hash(code + Date.now(), 10);

            const { data: newUser, error: createErr } = await supabase
                .from('users')
                .insert([{
                    username: code,
                    password: placeholderPassword,
                    status: 'PENDING_PAYMENT',
                }])
                .select()
                .single();

            if (createErr) {
                return res.status(500).json({ message: 'Could not create account', error: createErr });
            }
            userId = newUser.id;
        }

        const result = await stkPush({
            phone,
            amount: pkg.price,
            accountRef: phone,
            description: pkg.package_name,
        });

        if (result.ResponseCode !== '0') {
            return res.status(502).json({ message: 'STK push not accepted', detail: result });
        }

        await supabase.from('payments').insert([{
            user_id: userId,
            package_id,
            amount: pkg.price,
            payment_method: 'MPESA',
            status: 'PENDING',
            checkout_request_id: result.CheckoutRequestID,
            phone,
        }]);

        res.json({
            message: 'STK push sent. Ask the customer to enter their M-Pesa PIN.',
            checkout_request_id: result.CheckoutRequestID,
            customer_message: result.CustomerMessage,
        });

    } catch (err) {
        // TEMP DEBUG: log everything axios gives us so we can see Daraja's
        // real rejection reason instead of just "status code 400".
        console.error('createPhonePurchase error - status:', err.response?.status);
        console.error('createPhonePurchase error - data:', JSON.stringify(err.response?.data));
        console.error('createPhonePurchase error - message:', err.message);
        res.status(500).json({
            message: 'Server error',
            error: err.response?.data || err.message
        });
    }
};


// ============================================================
// GET /api/mpesa/status/:checkout_request_id
// The portal polls this every ~3s after Pay is tapped. Once PAID, returns
// the voucher code/PIN so the page can reveal it without any SMS.
// ============================================================
const getPaymentStatus = async (req, res) => {
    try {
        const { checkout_request_id } = req.params;

        const { data: payment } = await supabase
            .from('payments')
            .select('*')
            .eq('checkout_request_id', checkout_request_id)
            .maybeSingle();

        if (!payment) {
            return res.status(404).json({ status: 'NOT_FOUND' });
        }

        if (payment.status !== 'PAID') {
            // status is PENDING or FAILED -- nothing more to reveal yet
            return res.json({ status: payment.status });
        }

        const { data: user } = await supabase
            .from('users').select('username, hotspot_pin, expiry_time')
            .eq('id', payment.user_id).maybeSingle();

        res.json({
            status: 'PAID',
            username: user?.username,
            hotspot_pin: user?.hotspot_pin,
            expiry_time: user?.expiry_time,
        });

    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};


// ============================================================
// GET /api/mpesa/lookup/:phone
// "Forgot your code?" -- finds the most recent account this phone paid
// for and returns its voucher code, IF that account is still ACTIVE
// (not expired). No SMS needed for this recovery path.
// ============================================================
const lookupByPhone = async (req, res) => {
    try {
        const phone = normalizePhone(req.params.phone);
        if (!phone) {
            return res.status(400).json({ message: 'Enter phone as 07XXXXXXXX or 2547XXXXXXXX' });
        }

        const { data: payment } = await supabase
            .from('payments')
            .select('user_id')
            .eq('phone', phone)
            .eq('status', 'PAID')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!payment) {
            return res.status(404).json({ message: 'No paid bundle found for that number' });
        }

        const { data: user } = await supabase
            .from('users').select('username, hotspot_pin, expiry_time, status')
            .eq('id', payment.user_id).maybeSingle();

        if (!user || user.status !== 'ACTIVE' || new Date(user.expiry_time) < new Date()) {
            return res.status(404).json({ message: 'No active bundle for that number right now' });
        }

        res.json({
            username: user.username,
            hotspot_pin: user.hotspot_pin,
            expiry_time: user.expiry_time,
        });

    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};


// ============================================================
// POST /api/mpesa/callback
// Safaricom calls this after the customer responds to the prompt.
// MUST return HTTP 200 (even on internal error) or Daraja keeps retrying.
// ============================================================
const mpesaCallback = async (req, res) => {
    try {
        const cb = req.body?.Body?.stkCallback;
        if (!cb) {
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Ignored' });
        }

        const checkoutId = cb.CheckoutRequestID;
        const resultCode = cb.ResultCode;

        const { data: payment } = await supabase
            .from('payments')
            .select('*')
            .eq('checkout_request_id', checkoutId)
            .maybeSingle();

        if (!payment) {
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'No matching payment' });
        }

        if (resultCode !== 0) {
            await supabase.from('payments')
                .update({ status: 'FAILED' })
                .eq('id', payment.id);
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }

        let receipt = null;
        const items = cb.CallbackMetadata?.Item || [];
        items.forEach((it) => {
            if (it.Name === 'MpesaReceiptNumber') receipt = it.Value;
        });

        await supabase.from('payments')
            .update({ status: 'PAID', mpesa_receipt: receipt })
            .eq('id', payment.id);

        // Activate / renew the user. The polling router then provisions WiFi access
        // (status ACTIVE + hotspot_pin) on its next 60s cycle.
        const { data: pkg } = await supabase
            .from('packages').select('*').eq('id', payment.package_id).maybeSingle();
        const { data: user } = await supabase
            .from('users').select('*').eq('id', payment.user_id).maybeSingle();

        if (pkg && user) {
            const base = (user.status === 'ACTIVE' && new Date(user.expiry_time) > new Date())
                ? new Date(user.expiry_time)
                : new Date();
            const newExpiry = new Date(base.getTime() + pkg.duration_minutes * 60 * 1000);

            await supabase.from('users').update({
                package_id: payment.package_id,
                hotspot_pin: user.hotspot_pin || generatePin(),
                expiry_time: newExpiry,
                status: 'ACTIVE',
            }).eq('id', user.id);
        }

        return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

    } catch (err) {
        console.error('mpesaCallback error:', err.message);
        return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
};


module.exports = {
    initiateStk,
    createPhonePurchase,
    getPaymentStatus,
    lookupByPhone,
    mpesaCallback
};