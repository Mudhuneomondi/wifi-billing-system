const supabase = require('../config/supabase');
const mikrotik = require('./mikrotikService');


// =========================================
// MAIN EXPIRY ENGINE
// =========================================
const runExpiryEngine = async () => {

    try {

        const now = new Date();

        // 1. Get expired users
        const { data: expiredUsers, error } = await supabase
            .from('users')
            .select('*')
            .lt('expiry_time', now.toISOString())
            .eq('status', 'ACTIVE');

        if (error) {
            console.error('Expiry fetch error:', error);
            return;
        }

        if (!expiredUsers || expiredUsers.length === 0) {
            console.log('No expired users found');
            return;
        }

        // 2. Process each expired user
        for (const user of expiredUsers) {

            console.log(`Expiring user: ${user.username}`);

            // Update DB status
            await supabase
                .from('users')
                .update({ status: 'EXPIRED' })
                .eq('id', user.id);

            // Disable on MikroTik
            await mikrotik.disableUser(user.username);

            // Force disconnect
            await mikrotik.disconnectHotspotUser(user.username);
        }

    } catch (err) {
        console.error('ISP Engine Error:', err.message);
    }
};

module.exports = {
    runExpiryEngine
};