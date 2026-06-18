const jwt = require('jsonwebtoken');

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
        const decoded = jwt.verify(token, "SECRET_KEY");

        req.user = decoded; // attach user data to request

        next();

    } catch (error) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};

module.exports = verifyToken;