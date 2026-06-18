const supabase = require('../config/supabase');


// ==========================
// GET ALL PAYMENTS
// ==========================
const getPayments = async (req, res) => {

    try {

        const { data, error } = await supabase
            .from('payments')
            .select(`
                *,
                users (
                    username
                ),
                packages (
                    package_name
                )
            `)
            .order('created_at', {
                ascending: false
            });

        if (error) {
            return res.status(500).json(error);
        }

        res.json(data);

    } catch (err) {

        res.status(500).json({
            message: 'Server error',
            error: err.message
        });

    }

};

module.exports = {
    getPayments
};