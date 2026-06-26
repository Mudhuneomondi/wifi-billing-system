const supabase = require('../config/supabase');


// ============================================================
// ROUTER SYNC ENDPOINT (Option C - polling)
// The RB941 fetches this every ~60s and imports it as a script.
// We return PLAIN-TEXT RouterOS commands so the low-RAM router
// does zero JSON parsing.
//
//   - Active (not expired) users  -> add if missing, else enable
//   - Expired users               -> disconnect + remove from router
//
// Secured by a shared secret (ROUTER_SYNC_KEY) passed as ?key=...
// or the X-Sync-Key header. Serve this over HTTPS in production.
// ============================================================
const syncRouter = async (req, res) => {

    // --- Shared-secret auth ---
    const key = req.query.key || req.headers['x-sync-key'];
    if (!key || key !== process.env.ROUTER_SYNC_KEY) {
        return res.status(401).type('text/plain').send('# unauthorized');
    }

    try {

        // Users who SHOULD have access
        const { data: activeUsers, error: aErr } = await supabase
            .from('users')
            .select('username, hotspot_pin, expiry_time')
            .eq('status', 'ACTIVE');

        // Users who should be removed from the router
        const { data: expiredUsers, error: eErr } = await supabase
            .from('users')
            .select('username')
            .eq('status', 'EXPIRED');

        if (aErr || eErr) {
            return res.status(500).type('text/plain').send('# db error');
        }

        const now = new Date();
        let script = '# auto-generated hotspot sync\n';

        // --- Active users: add-if-missing, else ensure enabled ---
        (activeUsers || []).forEach((u) => {
            if (!u.username || !u.hotspot_pin) return;
            if (new Date(u.expiry_time) <= now) return; // double-check not expired

            const name = String(u.username).replace(/"/g, '');
            const pin = String(u.hotspot_pin).replace(/"/g, '');

            script +=
                `:if ([:len [/ip hotspot user find name="${name}"]]=0) do={` +
                `/ip hotspot user add name="${name}" password="${pin}" profile="default"` +
                `} else={/ip hotspot user enable [find name="${name}"]}\n`;
        });

        // --- Expired users: disconnect any live session, then remove ---
        (expiredUsers || []).forEach((u) => {
            if (!u.username) return;
            const name = String(u.username).replace(/"/g, '');

            script +=
                `/ip hotspot active remove [find user="${name}"]\n` +
                `/ip hotspot user remove [find name="${name}"]\n`;
        });

        res.type('text/plain').send(script);

    } catch (err) {
        res.status(500).type('text/plain').send('# server error');
    }
};


module.exports = { syncRouter };