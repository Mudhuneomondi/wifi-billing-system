const supabase = require('../config/supabase');


// ======================================================
// ADMIN DASHBOARD STATS
// ======================================================
const getStats = async (req, res) => {

    try {

        // --------------------------------------
        // TOTAL USERS
        // --------------------------------------
        const { count: totalUsers, error: totalError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        if (totalError) throw totalError;


        // --------------------------------------
        // ACTIVE USERS
        // --------------------------------------
        const { count: activeUsers, error: activeError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'ACTIVE');

        if (activeError) throw activeError;


        // --------------------------------------
        // EXPIRED USERS
        // --------------------------------------
        const { count: expiredUsers, error: expiredError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'EXPIRED');

        if (expiredError) throw expiredError;


        // --------------------------------------
        // ACTIVE SESSIONS
        // --------------------------------------
        const { count: activeSessions, error: sessionError } = await supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'ACTIVE');

        if (sessionError) throw sessionError;


        // --------------------------------------
        // TOTAL REVENUE (NEW KPI)
        // --------------------------------------
        const { data: payments, error: paymentError } = await supabase
            .from('payments')
            .select('amount');

        if (paymentError) throw paymentError;

        const totalRevenue = (payments || []).reduce(
            (sum, p) => sum + Number(p.amount || 0),
            0
        );


        // --------------------------------------
        // RESPONSE
        // --------------------------------------
        res.json({
            totalUsers,
            activeUsers,
            expiredUsers,
            activeSessions,
            totalRevenue
        });

    } catch (err) {

        res.status(500).json({
            message: 'Server Error',
            error: err.message
        });
    }
};

module.exports = {
    getStats
};