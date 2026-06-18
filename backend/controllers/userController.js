const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


// ================================
// REGISTER USER
// ================================
const createUser = async (req, res) => {

    const { username, password, package_id } = req.body;

    try {

        // Check duplicate user
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .maybeSingle();

        if (existingUser) {
            return res.status(409).json({
                message: 'Username already exists'
            });
        }

        // Get package
        const { data: packageData, error: packageError } = await supabase
            .from('packages')
            .select('*')
            .eq('id', package_id)
            .maybeSingle();

        if (packageError || !packageData) {
            return res.status(404).json({
                message: 'Package not found'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Calculate expiry
        const expiryTime = new Date();
        expiryTime.setHours(expiryTime.getHours() + packageData.duration_hours);

        // Insert user
        const { data, error } = await supabase
            .from('users')
            .insert([{
                username,
                password: hashedPassword,
                package_id,
                expiry_time: expiryTime,
                status: 'ACTIVE'
            }])
            .select()
            .single();

        if (error) {
            return res.status(500).json(error);
        }

        res.status(201).json(data);

    } catch (err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};


// ================================
// LOGIN USER
// ================================
const loginUser = async (req, res) => {

    const { username, password } = req.body;

    try {

        const { data: user, error } = await supabase
            .from('users')
            .select(`
                *,
                packages (
                    package_name,
                    duration_hours,
                    price
                )
            `)
            .eq('username', username)
            .maybeSingle();

        if (error || !user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({
                message: 'Invalid password'
            });
        }

        // Check expiry
        if (new Date(user.expiry_time) < new Date()) {

            await supabase
                .from('users')
                .update({ status: 'EXPIRED' })
                .eq('id', user.id);

            return res.status(403).json({
                message: 'Package expired'
            });
        }

        // Create token
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                status: user.status
            },
            'SECRET_KEY',
            { expiresIn: '1d' }
        );

        // Create session record
        await supabase
            .from('sessions')
            .insert([{
                user_id: user.id,
                expiry_time: user.expiry_time,
                status: 'ACTIVE'
            }]);

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                package: user.packages,
                expiry_time: user.expiry_time
            }
        });

    } catch (err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};


// ================================
// GET ALL USERS
// ================================
const getUsers = async (req, res) => {

    const { data, error } = await supabase
        .from('users')
        .select(`
            *,
            packages (
                package_name,
                duration_hours,
                price
            )
        `);

    if (error) {
        return res.status(500).json(error);
    }

    res.json(data);
};


// ================================
// GET USER BY ID
// ================================
const getUserById = async (req, res) => {

    const { id } = req.params;

    const { data, error } = await supabase
        .from('users')
        .select(`
            *,
            packages (
                package_name,
                duration_hours,
                price
            )
        `)
        .eq('id', id)
        .maybeSingle();

    if (error) {
        return res.status(500).json(error);
    }

    if (!data) {
        return res.status(404).json({
            message: 'User not found'
        });
    }

    res.json(data);
};


// ================================
// DELETE USER
// ================================
const deleteUser = async (req, res) => {

    const { id } = req.params;

    const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)
        .select()
        .maybeSingle();

    if (error) {
        return res.status(500).json(error);
    }

    res.json({
        message: 'User deleted',
        data
    });
};


// ================================
// RENEW PACKAGE
// ================================
const renewPackage = async (req, res) => {

    try {

        const { id } = req.params;
        const { package_id, payment_method } = req.body;

        // Get package
        const { data: pkg } = await supabase
            .from('packages')
            .select('*')
            .eq('id', package_id)
            .maybeSingle();

        if (!pkg) {
            return res.status(404).json({
                message: 'Package not found'
            });
        }

        // Get user
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        // Smart expiry logic
        const baseTime =
            new Date(user.expiry_time) > new Date()
                ? new Date(user.expiry_time)
                : new Date();

        const newExpiry = new Date(baseTime);
        newExpiry.setHours(newExpiry.getHours() + pkg.duration_hours);

        // Update user
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({
                package_id,
                expiry_time: newExpiry,
                status: 'ACTIVE'
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return res.status(500).json(updateError);
        }

        // Record payment
        await supabase
            .from('payments')
            .insert([{
                user_id: id,
                package_id,
                amount: pkg.price,
                payment_method,
                status: 'PAID'
            }]);

        res.json({
            message: 'Package renewed successfully',
            new_expiry_time: newExpiry,
            user: updatedUser
        });

    } catch (err) {
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};


// ================================
// EXPORTS
// ================================
module.exports = {
    createUser,
    loginUser,
    getUsers,
    getUserById,
    deleteUser,
    renewPackage
};