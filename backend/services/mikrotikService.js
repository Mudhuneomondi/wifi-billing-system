const client = require('../config/mikrotik');


// ======================================================
// CREATE HOTSPOT USER (PROVISIONING)
// ======================================================
const addHotspotUser = async (username, password, profile = 'basic') => {

    const conn = await client.connect();

    try {
        await conn.write('/ip/hotspot/user/add', [
            `=name=${username}`,
            `=password=${password}`,
            `=profile=${profile}`,
            '=disabled=no'
        ]);

        return true;

    } finally {
        conn.close();
    }
};


// ======================================================
// ENABLE USER
// ======================================================
const enableUser = async (username) => {

    const conn = await client.connect();

    try {
        const users = await conn.write('/ip/hotspot/user/print', [
            `?name=${username}`
        ]);

        if (users.length > 0) {
            await conn.write('/ip/hotspot/user/set', [
                `=.id=${users[0]['.id']}`,
                '=disabled=no'
            ]);
        }

        return true;

    } finally {
        conn.close();
    }
};


// ======================================================
// DISABLE USER
// ======================================================
const disableUser = async (username) => {

    const conn = await client.connect();

    try {
        const users = await conn.write('/ip/hotspot/user/print', [
            `?name=${username}`
        ]);

        if (users.length > 0) {
            await conn.write('/ip/hotspot/user/set', [
                `=.id=${users[0]['.id']}`,
                '=disabled=yes'
            ]);
        }

        return true;

    } finally {
        conn.close();
    }
};


// ======================================================
// FORCE DISCONNECT ACTIVE SESSION
// ======================================================
const disconnectHotspotUser = async (username) => {

    const conn = await client.connect();

    try {
        const sessions = await conn.write('/ip/hotspot/active/print', [
            `?user=${username}`
        ]);

        if (sessions.length > 0) {
            await conn.write('/ip/hotspot/active/remove', [
                `=.id=${sessions[0]['.id']}`
            ]);
        }

        return true;

    } finally {
        conn.close();
    }
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