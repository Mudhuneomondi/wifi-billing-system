const supabase = require('../config/supabase');

const sessionCheck = async (req, res, next) => {
    try {

        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                message: 'Unauthorized'
            });
        }

        // Get latest active session
        const { data: session, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'ACTIVE')
            .order('login_time', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            return res.status(500).json(error);
        }

        if (!session) {
            return res.status(403).json({
                message: 'No active session'
            });
        }

        const now = new Date();

        // Session expired
        if (new Date(session.expiry_time) < now) {

            await supabase
                .from('sessions')
                .update({
                    status: 'EXPIRED'
                })
                .eq('id', session.id);

            return res.status(403).json({
                message: 'Session expired'
            });
        }

        // Make session available to controllers
        req.session = session;

        next();

    } catch (err) {

        return res.status(500).json({
            message: 'Session check failed',
            error: err.message
        });

    }
};

module.exports = sessionCheck;