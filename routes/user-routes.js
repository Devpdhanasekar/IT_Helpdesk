const express = require('express');
const { userSignup, loginUser, validateToken, getAllUsers } = require('../controllers/user-controller');
// const userSignup = require('../controllers/user-controller');
// const loginUser = require('../controllers/user-controller');
const userRouter = express.Router();
userRouter.post('/signup', userSignup);
userRouter.post('/login', loginUser);
userRouter.post('/validateToken', validateToken);
userRouter.get('/getAllUsers', getAllUsers);
module.exports = userRouter;