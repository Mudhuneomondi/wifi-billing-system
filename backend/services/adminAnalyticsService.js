const supabase = require('../config/supabase');


// =====================================
// ACTIVE USERS COUNT
// =====================================
const getActiveUsersCount = async () => {

    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('status', 'ACTIVE');

    if (error) throw error;

    return data.length;
};


// =====================================
// ACTIVE SESSIONS COUNT
// =====================================
const getActiveSessionsCount = async () => {

    const { data, error } = await supabase
        .from('sessions')
        .select('id')
        .eq('status', 'ACTIVE');

    if (error) throw error;

    return data.length;
};


// =====================================
// TOTAL REVENUE
// =====================================
const getTotalRevenue = async () => {

    const { data, error } = await supabase
        .from('payments')
        .select('amount');

    if (error) throw error;

    const total = data.reduce((sum, p) => sum + Number(p.amount), 0);

    return total;
};


// =====================================
// MOST USED PACKAGES
// =====================================
const getPackageStats = async () => {

    const { data, error } = await supabase
        .from('users')
        .select(`
            package_id,
            packages (package_name)
        `);

    if (error) throw error;

    const stats = {};

    data.forEach(u => {
        const name = u.packages?.package_name || 'Unknown';
        stats[name] = (stats[name] || 0) + 1;
    });

    return stats;
};


// =====================================
// EXPIRED USERS COUNT
// =====================================
const getExpiredUsersCount = async () => {

    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('status', 'EXPIRED');

    if (error) throw error;

    return data.length;
};


// =====================================
// EXPORTS
// =====================================
module.exports = {
    getActiveUsersCount,
    getActiveSessionsCount,
    getTotalRevenue,
    getPackageStats,
    getExpiredUsersCount
};