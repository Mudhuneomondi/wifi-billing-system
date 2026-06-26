const supabase = require('../config/supabase');


// GET all packages
const getPackages = async (req, res) => {
    const { data, error } = await supabase
        .from('packages')
        .select('*');

    if (error) return res.status(500).json(error);

    res.json(data);
};


// GET single package
const getPackageById = async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return res.status(500).json(error);

    res.json(data);
};


// CREATE package
const createPackage = async (req, res) => {
    const { package_name, duration_hours, duration_minutes, data_limit_mb, price } = req.body;

    // Derive minutes if only hours were supplied, so expiry math always has it.
    const minutes = duration_minutes != null
        ? duration_minutes
        : (duration_hours != null ? duration_hours * 60 : null);

    const { data, error } = await supabase
        .from('packages')
        .insert([
            { package_name, duration_hours, duration_minutes: minutes, data_limit_mb: data_limit_mb ?? null, price }
        ])
        .select();

    if (error) return res.status(500).json(error);

    res.status(201).json(data);
};


// UPDATE package
const updatePackage = async (req, res) => {
    const { id } = req.params;
    const { package_name, duration_hours, duration_minutes, data_limit_mb, price } = req.body;

    // Build updates dynamically so unspecified fields aren't wiped.
    const updates = {};
    if (package_name !== undefined) updates.package_name = package_name;
    if (price !== undefined) updates.price = price;
    if (duration_hours !== undefined) updates.duration_hours = duration_hours;
    if (data_limit_mb !== undefined) updates.data_limit_mb = data_limit_mb;
    if (duration_minutes !== undefined) {
        updates.duration_minutes = duration_minutes;
    } else if (duration_hours !== undefined) {
        updates.duration_minutes = duration_hours * 60;
    }

    const { data, error } = await supabase
        .from('packages')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) return res.status(500).json(error);

    res.json(data);
};


// DELETE package
const deletePackage = async (req, res) => {
    const { id } = req.params;

    const { data, error } = await supabase
        .from('packages')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json(error);

    res.json({ message: "Package deleted", data });
};


module.exports = {
    getPackages,
    getPackageById,
    createPackage,
    updatePackage,
    deletePackage
};