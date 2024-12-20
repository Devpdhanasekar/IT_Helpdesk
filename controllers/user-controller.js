const User = require("../models/User");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSignup = async (req, res, next) => {
  console.log("-----", req.body)
  const {
    userName,
    empName,
    password,
    mobileNumber,
    role,
    location
  } = req.body;

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ mobileNumber });
    console.log("existingUser", existingUser)
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = bcryptjs.hashSync(password);

    // Create a new user
    const user = new User({
      userName,
      empName,
      password: hashedPassword,
      location,
      role,
      mobileNumber
    });

    // Save the user
    const savedUser = await user.save();

    if (!savedUser) {
      return res
        .status(500)
        .json({ message: "Unexpected error during saving user" });
    }

    // Generate a token
    const token = jwt.sign(
      { mobileNumber: savedUser.mobileNumber, userId: savedUser._id },
      "ITHelpdesk",
      { expiresIn: "1week" }
    );

    // Send response
    res
      .status(201)
      .json({ message: "Signup Successful", token, user: savedUser });

    // Pass the token and userId to the next middleware if needed
    req.generatedToken = token;
    req.userId = savedUser._id;

    next();
  } catch (err) {
    console.error("Error during signup:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};


const loginUser = async (req, res, next) => {
  const { userName, password, fcmToken } = req.body
  console.log(req.body)
  let existingUser;
  try {
    existingUser = await User.findOne({ userName })
  } catch (err) {
    console.log(err)
  }

  if (!existingUser) {
    res.status(404).json({ message: "User not found" })
  }

  console.log(existingUser)
  const correctPassword = bcryptjs.compareSync(password, existingUser.password)

  if (correctPassword) {
    try {
      await User.updateOne({ _id: existingUser._id }, { fcmToken: fcmToken });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: "Could not update FCM token" });
    }
    const token = jwt.sign(
      { id: existingUser._id },
      "ITHelpdesk", // Replace with your secret key for signing the token
      { expiresIn: "1week" } // Token expiration time
    );
    req.generatedToken = token;
    res.status(200).json({ existingUser, "message": "Login Successful", token: token });
  }
  next()
}


const getAllComplaints = async (req, res) => {
  try {
    const complaints = await User.find();

    res.status(200).json(complaints);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching complaints', error });
  }
};


const validateToken = async (req, res) => {
  console.log("is called");
  const { token } = req.body;
  if (token) {
    jwt.verify(token, "ITHelpdesk", async (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: false });
      } else {
        console.log(decoded);
        try {
          const user = await User.findById(decoded.id);
          console.log(user);
          return res.status(200).json({ message: true, existingUser: user });
        } catch (error) {
          console.error(error);
          return res.status(500).json({ message: false });
        }
      }
    });
  } else {
    return res.status(400).json({ message: false });
  }
};


// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-createdAt -updatedAt -__v');;
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteUserByEmail = async (req, res) => {
  const { email } = req.body; // Assuming the email is sent in the request body

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    const user = await User.findOneAndDelete({ userName: email });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: "User account deleted successfully.", user });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};



module.exports = {
  loginUser,
  userSignup,
  validateToken,
  getAllUsers,
  deleteUserByEmail
}