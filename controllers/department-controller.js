// departmentController.js

const Department = require('../models/Department');

// Create a new department
exports.createDepartment = async (req, res) => {
    try {
        const { department } = req.body;
        const newDepartment = new Department({ Department: department });
        await newDepartment.save();
        res.status(201).json(newDepartment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all departments
exports.getDepartments = async (req, res) => {
    try {
        const departments = await Department.find();
        const departmentsArray = departments.map(department => department.Department);
        res.status(200).json(departmentsArray);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a department by ID
exports.getDepartmentById = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id);
        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }
        res.status(200).json(department);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update a department by ID
exports.updateDepartment = async (req, res) => {
    try {
        const { Department } = req.body;
        const updatedDepartment = await Department.findByIdAndUpdate(
            req.params.id,
            { Department },
            { new: true }
        );
        if (!updatedDepartment) {
            return res.status(404).json({ message: 'Department not found' });
        }
        res.status(200).json(updatedDepartment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete a department by ID
exports.deleteDepartment = async (req, res) => {
    try {
        const deletedDepartment = await Department.findByIdAndDelete(req.params.id);
        if (!deletedDepartment) {
            return res.status(404).json({ message: 'Department not found' });
        }
        res.status(200).json({ message: 'Department deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
// Controller function to delete a department by name
exports.deleteDepartmentByName = async (req, res) => {
    try {
        const { deptName } = req.params; // Extract the name from the request parameters

        if (!deptName) {
            return res.status(400).json({ message: 'Department name is required' });
        }

        // Find and delete the department by name
        const deletedDepartment = await Department.findOneAndDelete({ Department: deptName });

        if (!deletedDepartment) {
            return res.status(404).json({ message: 'Department not found' });
        }

        // Success response
        res.status(200).json({
            message: 'Department deleted successfully',
            department: deletedDepartment,
        });
    } catch (error) {
        console.error('Error deleting department:', error);
        res.status(500).json({ message: 'An error occurred while deleting the department' });
    }
};
