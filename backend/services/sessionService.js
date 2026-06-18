const supabase = require('../config/supabase');


// ===============================
// AUTO EXPIRE SESSIONS
// ===============================
const expireSessions = async () => {

    const now = new Date();

    console.log("Running session expiry check...");

    // 1. Find expired sessions
    const { data: sessions, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'ACTIVE');

    if (error) {
        console.log("Session fetch error:", error);
        return;
    }

    if (!sessions || sessions.length === 0) {
        console.log("No active sessions");
        return;
    }

    // 2. Loop and expire
    for (let session of sessions) {

        if (new Date(session.expiry_time) < now) {

            await supabase
                .from('sessions')
                .update({ status: 'EXPIRED' })
                .eq('id', session.id);

            console.log(`Session expired: ${session.id}`);
        }
    }
};

module.exports = {
    expireSessions
};