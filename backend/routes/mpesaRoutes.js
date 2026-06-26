const supabase = require('../config/supabase');
const { stkPush } = require('../services/mpesaService');


function generatePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


// ============================================================
// POST /api/mpesa/stk
// Body: { user_id, package_id, phone }
// Called by your frontend / captive portal to start a payment.
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

        // Fire the STK push
        const result = await stkPush({
            phone,
            amount: pkg.price,
            accountRef: user.username,
            description: pkg.package_name,
        });

        // ResponseCode "0" means Daraja accepted the request
        if (result.ResponseCode !== '0') {
            return res.status(502).json({ message: 'STK push not accepted', detail: result });
        }

        // Record a PENDING payment keyed by CheckoutRequestID so the callback can find it
        await supabase.from('payments').insert([{
            user_id,
            package_id,
            amount: pkg.price,
            payment_method: 'MPESA',
            status: 'PENDING',
            checkout_request_id: result.CheckoutRequestID,
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

        // Match the pending payment we stored at initiation
        const { data: payment } = await supabase
            .from('payments')
            .select('*')
            .eq('checkout_request_id', checkoutId)
            .maybeSingle();

        if (!payment) {
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'No matching payment' });
        }

        // Non-zero = cancelled / failed / timed out
        if (resultCode !== 0) {
            await supabase.from('payments')
                .update({ status: 'FAILED' })
                .eq('id', payment.id);
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }

        // Success — pull the receipt number from the metadata
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
            const base = new Date(user.expiry_time) > new Date()
                ? new Date(user.expiry_time)
                : new Date();
            const newExpiry = new Date(base);
            newExpiry.setHours(newExpiry.getHours() + pkg.duration_hours);

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
        // Still return 200 so Safaricom doesn't hammer retries
        return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
};


module.exports = { initiateStk, mpesaCallback };