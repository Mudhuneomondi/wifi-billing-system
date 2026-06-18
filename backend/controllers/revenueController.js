const express = require('express');
require('dotenv').config();

// Routes
const packageRoutes = require('./routes/packageRoutes');
const userRoutes = require('./routes/userRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// Services
const { expireSessions } = require('./services/sessionService');

const app = express();

app.use(express.json());


// ==========================
// HOME ROUTE
// ==========================
app.get('/', (req, res) => {
    res.send('WiFi Billing System API Running');
});


// ==========================
// API ROUTES
// ==========================
app.use('/api/packages', packageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);


// ==========================
// SESSION EXPIRY ENGINE
// ==========================
setInterval(() => {
    expireSessions();
}, 60000); // every 60 seconds


// ==========================
// START SERVER
// ==========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Session expiry engine running...');
});