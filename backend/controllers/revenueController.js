const supabase = require('../config/supabase');


// ==========================
// TOTAL REVENUE
// ==========================
const getTotalRevenue = async (req, res) => {
    try {

        const { data, error } = await supabase
            .from('payments')
            .select('amount')
            .eq('status', 'PAID');

        if (error) return res.status(500).json(error);

        const totalRevenue = data.reduce(
            (sum, p) => sum + Number(p.amount),
            0
        );

        res.json({ totalRevenue });

    } catch (err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};


// ==========================
// TODAY REVENUE
// ==========================
const getTodayRevenue = async (req, res) => {
    try {

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
            .from('payments')
            .select('amount, created_at')
            .eq('status', 'PAID');

        if (error) return res.status(500).json(error);

        const total = data
            .filter(p => new Date(p.created_at) >= today)
            .reduce((sum, p) => sum + Number(p.amount), 0);

        res.json({ todayRevenue: total });

    } catch (err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};


// ==========================
// MONTHLY REVENUE
// ==========================
const getMonthlyRevenue = async (req, res) => {
    try {

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const { data, error } = await supabase
            .from('payments')
            .select('amount, created_at')
            .eq('status', 'PAID');

        if (error) return res.status(500).json(error);

        const total = data
            .filter(p => new Date(p.created_at) >= monthStart)
            .reduce((sum, p) => sum + Number(p.amount), 0);

        res.json({ monthlyRevenue: total });

    } catch (err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};


// ==========================
// TOP PACKAGES
// ==========================
const getTopPackages = async (req, res) => {
    try {

        const { data, error } = await supabase
            .from('payments')
            .select(`
                amount,
                packages (
                    package_name
                )
            `)
            .eq('status', 'PAID');

        if (error) return res.status(500).json(error);

        const map = {};

        data.forEach(p => {
            const name = p.packages?.package_name || 'Unknown';
            map[name] = (map[name] || 0) + Number(p.amount);
        });

        const sorted = Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .map(([package_name, revenue]) => ({
                package_name,
                revenue
            }));

        res.json(sorted);

    } catch (err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};


// ==========================
// EXPORTS
// ==========================
module.exports = {
    getTotalRevenue,
    getTodayRevenue,
    getMonthlyRevenue,
    getTopPackages
};