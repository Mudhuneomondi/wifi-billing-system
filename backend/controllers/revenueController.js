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

        if (error) {
            return res.status(500).json(error);
        }

        const totalRevenue = data.reduce(
            (sum, payment) => sum + Number(payment.amount),
            0
        );

        res.json({
            totalRevenue
        });

    } catch (err) {

        res.status(500).json({
            message: 'Server error',
            error: err.message
        });

    }
};


// ==========================
// REVENUE BY PACKAGE
// ==========================
const getRevenueByPackage = async (req, res) => {

    try {

        const { data, error } = await supabase
            .from('payments')
            .select(`
                amount,
                package_id,
                packages (
                    package_name
                )
            `)
            .eq('status', 'PAID');

        if (error) {
            return res.status(500).json(error);
        }

        const revenueMap = {};

        data.forEach(payment => {

            const packageName =
                payment.packages?.package_name || 'Unknown';

            if (!revenueMap[packageName]) {
                revenueMap[packageName] = 0;
            }

            revenueMap[packageName] += Number(payment.amount);

        });

        res.json(revenueMap);

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
    getRevenueByPackage
};