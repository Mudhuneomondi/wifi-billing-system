const supabase = require('../config/supabase');


// ==============================
// GET ACTIVE SESSIONS
// ==============================
const getActiveSessions = async (req, res) => {

    try {

        const { data, error } = await supabase
            .from('sessions')
            .select(`
                *,
                users (
                    username
                )
            `)
            .eq('status', 'ACTIVE');

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


// ==============================
// DISCONNECT SESSION
// ==============================
const disconnectSession = async (req, res) => {

    try {

        const { id } = req.params;

        const { data, error } = await supabase
            .from('sessions')
            .update({
                status: 'DISCONNECTED'
            })
            .eq('id', id)
            .select();

        if (error) {
            return res.status(500).json(error);
        }

        if (!data || data.length === 0) {
            return res.status(404).json({
                message: 'Session not found'
            });
        }

        res.json({
            message: 'Session disconnected successfully',
            session: data[0]
        });

    } catch (err) {

        res.status(500).json({
            message: 'Server error',
            error: err.message
        });

    }

};


module.exports = {
    getActiveSessions,
    disconnectSession
};