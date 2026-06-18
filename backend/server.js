const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Routes
const packageRoutes = require('./routes/packageRoutes');
const userRoutes = require('./routes/userRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const revenueRoutes = require('./routes/revenueRoutes');
const captiveRoutes = require('./routes/captiveRoutes');

// Services
const { expireSessions } = require('./services/sessionService');
const { runExpiryEngine } = require('./services/ispEngine');

const app = express();
const server = http.createServer(app);

// =====================================
// SOCKET.IO SETUP
// =====================================
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

app.use(express.json());


// =====================================
// HOME
// =====================================
app.get('/', (req, res) => {
    res.send('WiFi Billing System API Running');
});


// =====================================
// ROUTES
// =====================================
app.use('/api/packages', packageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/captive', captiveRoutes);


// =====================================
// REAL-TIME CONNECTIONS
// =====================================
io.on('connection', (socket) => {

    console.log('Admin connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Admin disconnected:', socket.id);
    });
});


// =====================================
// EMIT LIVE STATS FUNCTION
// =====================================
const emitStats = async () => {

    try {

        const supabase = require('./config/supabase');

        const { count: activeUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'ACTIVE');

        const { count: activeSessions } = await supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'ACTIVE');

        io.emit('liveStats', {
            activeUsers,
            activeSessions,
            timestamp: new Date()
        });

    } catch (err) {
        console.error('Live stats error:', err.message);
    }
};


// =====================================
// ENGINE LOOPS
// =====================================
setInterval(async () => {
    await expireSessions();
    await runExpiryEngine();
    await emitStats();
}, 5000); // every 5 seconds (REAL-TIME FEEL)


// =====================================
// START SERVER
// =====================================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Real-time ISP engine active...');
});