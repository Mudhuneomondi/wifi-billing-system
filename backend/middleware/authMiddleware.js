const jwt = require('jsonwebtoken');

// Verifies any valid token (customer or admin) and attaches the decoded
// payload to req.user. Uses the real JWT_SECRET -- the hardcoded
// "SECRET_KEY" string here previously meant this never matched tokens
// issued elsewhere in the app (captiveController, adminAuthController),
// so every request through this middleware was silently failing with 403.
const verifyToken = (req, res, next) => {

    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ message: "No token provided" });
    }

    // format: "Bearer TOKEN"
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Invalid token format" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded; // attach decoded payload to request

        next();

    } catch (error) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};

// Stricter check for admin-only routes: token must be valid AND carry
// role: 'admin' (set at login time in adminAuthController). A regular
// customer's token will verify fine under verifyToken but gets rejected
// here, since customers have no role claim at all.
const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, (err) => {
        if (err) return; // verifyToken already sent a response
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        next();
    });
};

module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.verifyAdmin = verifyAdmin;