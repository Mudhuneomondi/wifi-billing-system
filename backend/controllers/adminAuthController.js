const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ============================================================
// POST /api/admin/login
// Body: { username, password }
// Separate from customer auth on purpose -- admins are a different
// identity model, not a flag on the customer `users` table. Issues a
// JWT with role: 'admin', which verifyAdmin checks for on every
// protected admin route.
// ============================================================
const adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const { data: admin, error } = await supabase
            .from('admins')
            .select('*')
            .eq('username', username)
            .maybeSingle();

        if (error) return res.status(500).json({ message: 'Server error', error: error.message });
        if (!admin) return res.status(401).json({ message: 'Invalid credentials' });

        const passwordMatches = await bcrypt.compare(password, admin.password);
        if (!passwordMatches) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            message: 'Logged in',
            token,
            username: admin.username
        });

    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ============================================================
// POST /api/admin/create  (run once manually to bootstrap your first
// admin account -- see note in the setup instructions. Not exposed to
// the public dashboard UI.)
// ============================================================
const createAdmin = async (req, res) => {
    try {
        const { username, password, setup_key } = req.body;

        // A simple shared secret so this endpoint can't be used by a
        // stranger to mint themselves an admin account. Set ADMIN_SETUP_KEY
        // in Render's env vars to any random string, share it with no one,
        // and you can delete/disable this route entirely after first use.
        if (!process.env.ADMIN_SETUP_KEY || setup_key !== process.env.ADMIN_SETUP_KEY) {
            return res.status(403).json({ message: 'Invalid setup key' });
        }
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        const hashed = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('admins')
            .insert([{ username, password: hashed }])
            .select('id, username')
            .single();

        if (error) return res.status(500).json({ message: 'Server error', error: error.message });

        res.status(201).json({ message: 'Admin created', admin: data });

    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

module.exports = { adminLogin, createAdmin };