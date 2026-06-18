const cron = require('node-cron');
const supabase = require('../config/supabase');

const startExpiryJob = () => {

    // runs every minute
    cron.schedule('* * * * *', async () => {

        console.log('Running expiry check...');

        const now = new Date().toISOString();

        // find active users whose expiry_time has passed
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('status', 'ACTIVE')
            .lt('expiry_time', now);

        if (error) {
            console.log('Expiry check error:', error);
            return;
        }

        if (!users || users.length === 0) {
            console.log('No users to expire');
            return;
        }

        // update each user to EXPIRED
        for (const user of users) {

            await supabase
                .from('users')
                .update({ status: 'EXPIRED' })
                .eq('id', user.id);
        }

        console.log(`Expired ${users.length} user(s)`);

    });
};

module.exports = startExpiryJob;