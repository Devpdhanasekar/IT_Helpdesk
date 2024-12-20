const Complaint = require("../models/Complaint");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { getMessaging } = require('firebase-admin/messaging')

// Function to add a complaint
const addComplaint = async (req, res) => {
    try {
        const {
            complaintFrom,
            natureOfComplaint,
            descriptionOfComplaint,
            dateAndTimeOfComplaint,
            location,
            token,
        } = req.body;

        if (token) {
            jwt.verify(token, "ITHelpdesk", async (err, decoded) => {
                if (err) {
                    return res.status(401).json({ message: false });
                } else {
                    try {
                        const user = await User.findById(decoded.id);
                        console.log(user);
                        if (!user) {
                            return res.status(404).json({ message: "User not found" });
                        }

                        // Find all "LAdmin" users with the same location
                        let assignedToUsers = await User.find({ role: "LocationAdmin", location: user.location }).select('_id');
                        const superAdmin = await User.findOne({ role: "SuperAdmin" });

                        // If no LAdmin in the location, default to SuperAdmin
                        const assignedTo = assignedToUsers.length > 0 ? assignedToUsers.map(admin => admin._id) : [superAdmin._id];

                        // Create the new complaint
                        const newComplaint = new Complaint({
                            complaintFrom: complaintFrom,
                            complaintBy: user._id,
                            natureOfComplaint,
                            descriptionOfComplaint,
                            dateAndTimeOfComplaint,
                            location: user.location,
                            assignedTo: assignedTo,
                            status: "pending",
                        });

                        await newComplaint.save();
                        user.complaints.push(newComplaint._id);
                        await user.save();
                        // Update each assigned admin's received tickets
                        await User.updateMany({ _id: { $in: assignedTo } }, { $push: { receivedTickets: newComplaint._id } });
                        // Send notifications to all LAdmin users in the same location and SuperAdmin
                        const allLAdmins = await User.find({ role: "LocationAdmin", location: user.location });
                        const adminsToNotify = superAdmin ? [superAdmin, ...allLAdmins] : allLAdmins;

                        const notificationMessage = `New complaint from ${complaintFrom} regarding ${natureOfComplaint}`;
                        adminsToNotify.forEach(admin => {
                            if (admin.fcmToken) {  // Check if admin has an fcmToken
                                sendNotification(admin, notificationMessage);
                            }
                        });

                        return res.status(200).json({ message: true, complaint: newComplaint });
                    } catch (error) {
                        console.error(error);
                        return res.status(500).json({ message: false });
                    }
                }
            });
        } else {
            return res.status(400).json({ message: "Token not provided" });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Error adding complaint", error });
    }
};


const getReceivedTickets = async (req, res) => {
    try {
        const { token } = req.body; // Token is expected in the request body

        if (!token) {
            return res.status(400).json({ message: "Token not provided" });
        }

        jwt.verify(token, "ITHelpdesk", async (err, decoded) => {
            if (err) {
                return res.status(401).json({ message: "Invalid or expired token" });
            }

            try {
                // Find the user based on the decoded token
                const user = await User.findById(decoded.id).populate({
                    path: 'receivedTickets',
                    populate: [
                        { path: 'complaintBy', select: 'userName mobileNumber' },
                        { path: 'assignedTo', select: 'userName' },
                    ],
                });

                if (!user) {
                    return res.status(404).json({ message: "User not found" });
                }

                // Format the received tickets for a clean response
                const formattedTickets = user.receivedTickets.map(ticket => ({
                    _id: ticket._id,
                    complaintFrom: ticket.complaintFrom,
                    complaintBy: ticket.complaintBy?.userName || "N/A",
                    mobileNumber: ticket.complaintBy?.mobileNumber || "N/A",
                    natureOfComplaint: ticket.natureOfComplaint,
                    descriptionOfComplaint: ticket.descriptionOfComplaint,
                    dateAndTimeOfComplaint: ticket.dateAndTimeOfComplaint,
                    location: ticket.location,
                    assignedTo: ticket.assignedTo?.map(user => user.userName).join(", ") || "Not assigned",
                    dateAndTimeOfResolution: ticket.dateAndTimeOfResolution,
                    status: ticket.status,
                    remarks: ticket.remarks,
                }));

                return res.status(200).json(formattedTickets); // Send the tickets to the client
            } catch (error) {
                console.error(error);
                return res.status(500).json({ message: "Error fetching received tickets", error });
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Error processing the request", error });
    }
};

const getComplaintsByUser = async (req, res) => {
    try {
        const { token } = req.body;  // Token is expected in the request body

        if (token) {
            jwt.verify(token, "ITHelpdesk", async (err, decoded) => {
                if (err) {
                    return res.status(401).json({ message: "Invalid or expired token" });
                } else {
                    try {
                        // Find the user from the decoded token
                        const user = await User.findById(decoded.id);
                        if (!user) {
                            return res.status(404).json({ message: "User not found" });
                        }

                        // Find complaints where the user is either the complainant or assigned to the complaint
                        const complaints = await Complaint.find({
                            $or: [
                                { complaintBy: user._id },        // Complaints made by the user
                            ]
                        })
                            .populate("complaintBy", "userName mobileNumber")
                            .populate("assignedTo", "userName");

                        // Map the complaints to return userName instead of ObjectIds
                        const formattedComplaints = complaints.map(complaint => ({
                            _id: complaint._id,
                            complaintFrom: complaint.complaintFrom,
                            complaintBy: complaint.complaintBy.userName, // Use userName instead of id
                            natureOfComplaint: complaint.natureOfComplaint,
                            descriptionOfComplaint: complaint.descriptionOfComplaint,
                            dateAndTimeOfComplaint: complaint.dateAndTimeOfComplaint,
                            location: complaint.location,
                            assignedTo: complaint.assignedTo && complaint.assignedTo.length > 0
                                ? complaint.assignedTo.map(user => user.userName).join(", ")  // Join multiple assigned users
                                : "Not assigned",  // Default if no assigned users
                            dateAndTimeOfResolution: complaint.dateAndTimeOfResolution,
                            status: complaint.status,
                            remarks: complaint.remarks,
                            mobileNumber: complaint.complaintBy.mobileNumber
                        }));

                        return res.status(200).json(formattedComplaints);  // Send the complaints to the client
                    } catch (error) {
                        console.error(error);
                        return res.status(500).json({ message: "Error fetching complaints", error });
                    }
                }
            });
        } else {
            return res.status(400).json({ message: "Token not provided" });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Error fetching complaints", error });
    }
};



module.exports = addComplaint;


// Function to edit a complaint
const editComplaint = async (req, res) => {
    try {
        const { complaintId } = req.params;
        const updateData = req.body;

        const updatedComplaint = await Complaint.findByIdAndUpdate(
            complaintId,
            updateData,
            { new: true }
        );

        if (!updatedComplaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }

        res.status(200).json(updatedComplaint);
    } catch (error) {
        res.status(500).json({ message: "Error editing complaint", error });
    }
};
const updateComplaintStatusAndRemarks = async (req, res) => {
    const { complaintId, newStatus, newRemarks } = req.body;

    if (!complaintId || !newStatus || !newRemarks) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        const updatedComplaint = await Complaint.findByIdAndUpdate(
            complaintId,
            {
                status: newStatus,
                remarks: newRemarks,
                dateAndTimeOfResolution: Date.now(), // Update the resolution time as well
            },
            { new: true } // This option returns the updated document
        );

        if (!updatedComplaint) {
            return res.status(404).json({ success: false, message: 'Complaint not found' });
        }

        return res.status(200).json({ success: true, message: 'Complaint updated successfully', updatedComplaint });
    } catch (error) {
        console.error('Error updating complaint:', error);
        return res.status(500).json({ success: false, message: 'Error updating complaint', error });
    }
};


// Function to delete a complaint
const deleteComplaint = async (req, res) => {
    try {
        const { complaintId } = req.params;

        const deletedComplaint = await Complaint.findByIdAndDelete(complaintId);

        if (!deletedComplaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }

        // Assuming assignedTo contains userId
        const user = await User.findById(deletedComplaint.assignedTo.userId);
        if (user) {
            user.complaints.pull(deletedComplaint._id);
            await user.save();
        }

        res.status(200).json({ message: "Complaint deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting complaint", error });
    }
};

const getComplaintById = async (req, res) => {
    try {
        const { complaintId } = req.params;

        const complaint = await Complaint.findById(complaintId).populate(
            "assignedTo"
        );

        if (!complaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }

        res.status(200).json(complaint);
    } catch (error) {
        res.status(500).json({ message: "Error fetching complaint", error });
    }
};

const getAllComplaints = async (req, res) => {
    try {
        // Find complaints and populate both complaintBy and assignedTo fields with userName
        const complaints = await Complaint.find()
            .populate("complaintBy", "userName mobileNumber")
            .populate("assignedTo", "userName");
        console.log(complaints);

        // Map the complaints to replace complaintBy and assignedTo with userName
        const formattedComplaints = complaints.map(complaint => ({
            _id: complaint._id,
            complaintFrom: complaint.complaintFrom,
            complaintBy: complaint.complaintBy.userName, // Use userName instead of id
            natureOfComplaint: complaint.natureOfComplaint,
            descriptionOfComplaint: complaint.descriptionOfComplaint,
            dateAndTimeOfComplaint: complaint.dateAndTimeOfComplaint,
            location: complaint.location,
            assignedTo: complaint.assignedTo.userName, // Use userName instead of id
            dateAndTimeOfResolution: complaint.dateAndTimeOfResolution,
            status: complaint.status,
            remarks: complaint.remarks,
            mobileNumber: complaint.complaintBy.mobileNumber
        }));

        res.status(200).json(formattedComplaints);
    } catch (error) {
        res.status(500).json({ message: "Error fetching complaints", error });
    }
};
const getAllComplaintsCompleted = async (req, res) => {
    try {
        // Find complaints and populate both complaintBy and assignedTo fields with userName
        const complaints = await Complaint.find({ status: "Completed" })
            .populate("complaintBy", "userName mobileNumber")
            .populate("assignedTo", "userName");
        console.log(complaints);

        // Map the complaints to replace complaintBy and assignedTo with userName
        const formattedComplaints = complaints.map(complaint => ({
            _id: complaint._id,
            complaintFrom: complaint.complaintFrom,
            complaintBy: complaint.complaintBy.userName, // Use userName instead of id
            natureOfComplaint: complaint.natureOfComplaint,
            descriptionOfComplaint: complaint.descriptionOfComplaint,
            dateAndTimeOfComplaint: complaint.dateAndTimeOfComplaint,
            location: complaint.location,
            assignedTo: complaint.assignedTo.userName, // Use userName instead of id
            dateAndTimeOfResolution: complaint.dateAndTimeOfResolution,
            status: complaint.status,
            remarks: complaint.remarks,
            mobileNumber: complaint.complaintBy.mobileNumber
        }));

        res.status(200).json(formattedComplaints);
    } catch (error) {
        res.status(500).json({ message: "Error fetching complaints", error });
    }
};

const sendNotification = async (user, notificationMessage) => {
    console.log(user)
    console.log("user")
    const receivedToken = user.fcmToken;
    const message = {
        notification: {
            title: "New ticket has been assigned to you",
            body: notificationMessage
        },
        token: receivedToken
    }
    getMessaging().send(message).then((response) => {
        // res.status(200).json({
        //     message: "Successfully sent message",
        //     token: receivedToken,
        // });
        console.log("Successfully sent message:", response);
    })
        .catch((error) => {
            // res.status(400);
            // res.send(error);
            console.log("Error sending message:", error);
        });
}
module.exports = getAllComplaints;



module.exports = {
    addComplaint,
    editComplaint,
    deleteComplaint,
    getAllComplaints,
    getComplaintsByUser,
    updateComplaintStatusAndRemarks,
    getAllComplaintsCompleted,
    getReceivedTickets
};
