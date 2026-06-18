const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');


// ================================
// CAPTIVE LOGIN CHECK
// ================================
const captiveLogin = async (req, res) => {

    try {

        const { username, password } = req.body;

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

        // 2. Check password (plain compare for portal simplicity)
        if (user.password !== password && user.password.length > 20) {
            // fallback if hashed (not ideal for captive but OK for phase)
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        // 3. Check expiry
        if (new Date(user.expiry_time) < new Date()) {
            return res.status(403).json({
                message: 'Package expired'
            });
        }

        // 4. Create token for router
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username
            },
            'SECRET_KEY',
            { expiresIn: '1d' }
        );

        // 5. Create session
        await supabase
            .from('sessions')
            .insert([
                {
                    user_id: user.id,
                    expiry_time: user.expiry_time,
                    status: 'ACTIVE'
                }
            ]);

        res.json({
            message: 'Access granted',
            token
        });

    } catch (err) {

        res.status(500).json({
            message: 'Server error',
            error: err.message
        });

    }
};

module.exports = {
    captiveLogin
};