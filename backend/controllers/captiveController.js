const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');

// ================================
// CAPTIVE LOGIN CHECK
//
// The customer authenticates with: username + hotspot PIN (the voucher),
// because that is exactly the pair the router stores (the sync endpoint
// adds each hotspot user as name=<username> password=<hotspot_pin>).
//
// NOTE on the real end-to-end flow: on the MikroTik itself, the ROUTER
// authenticates the user against its own hotspot user database (which the
// /api/router/sync endpoint keeps populated). This backend endpoint mirrors
// that check so a branded portal can validate before handing the browser
// off to the router's login form.
// ================================
const captiveLogin = async (req, res) => {

    try {

        // The portal posts { username, pin }. We also accept `password` as an
        // alias so an older portal page keeps working.
        const { username } = req.body;
        const pin = req.body.pin || req.body.password;

        if (!username || !pin) {
            return res.status(400).json({
                message: 'Username and PIN are required'
            });
        }

        // 1. Get user
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .maybeSingle();

        if (error || !user) {
            return res.status(404).json({
                message: 'Invalid credentials'
            });
        }

        // 2. Check the PIN against the stored hotspot_pin
        if (!user.hotspot_pin || String(user.hotspot_pin) !== String(pin)) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        // 3. Check status + expiry
        if (user.status === 'EXPIRED' || new Date(user.expiry_time) < new Date()) {
            return res.status(403).json({
                message: 'Package expired'
            });
        }

        // 4. Issue a short-lived token (same secret as the rest of the app)
        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET || 'SECRET_KEY',
            { expiresIn: '1d' }
        );

        // 5. Record an active session
        await supabase
            .from('sessions')
            .insert([{
                user_id: user.id,
                expiry_time: user.expiry_time,
                status: 'ACTIVE'
            }]);

        res.json({
            message: 'Access granted',
            token,
            expiry_time: user.expiry_time
        });

    } catch (err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

module.exports = { captiveLogin };