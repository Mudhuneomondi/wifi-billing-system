const client = require('../config/mikrotik');


// ======================================================
// CREATE HOTSPOT USER
// ======================================================
const addHotspotUser = async (username, password, profile = 'basic') => {
    await client.write('/ip/hotspot/user/add', [
        `=name=${username}`,
        `=password=${password}`,
        `=profile=${profile}`,
        '=disabled=no'
    ]);

    return true;
};


// ======================================================
// ENABLE USER
// ======================================================
const enableUser = async (username) => {
    const users = await client.write('/ip/hotspot/user/print', [
        `?name=${username}`
    ]);

    if (users.length > 0) {
        await client.write('/ip/hotspot/user/set', [
            `=.id=${users[0]['.id']}`,
            '=disabled=no'
        ]);
    }

    return true;
};


// ======================================================
// DISABLE USER
// ======================================================
const disableUser = async (username) => {
    const users = await client.write('/ip/hotspot/user/print', [
        `?name=${username}`
    ]);

    if (users.length > 0) {
        await client.write('/ip/hotspot/user/set', [
            `=.id=${users[0]['.id']}`,
            '=disabled=yes'
        ]);
    }

    return true;
};


// ======================================================
// DISCONNECT ACTIVE SESSION
// ======================================================
const disconnectHotspotUser = async (username) => {
    const sessions = await client.write('/ip/hotspot/active/print', [
        `?user=${username}`
    ]);

    if (sessions.length > 0) {
        await client.write('/ip/hotspot/active/remove', [
            `=.id=${sessions[0]['.id']}`
        ]);
    }

    return true;
};


// ======================================================
// EXPORTS
// ======================================================
module.exports = {
    addHotspotUser,
    enableUser,
    disableUser,
    disconnectHotspotUser
};