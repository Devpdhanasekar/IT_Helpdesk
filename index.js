const express = require('express');
const userRouter = require('./routes/user-routes');
const app = express();
const port = 8080;
const CORS = require('cors');
const locationRouter = require('./routes/location-routes');
const complaintRouter = require('./routes/complaint-routes');
const deptRouter = require('./routes/department-routes');
const { applicationDefault } = require('firebase-admin/app')
require('dotenv').config();


var admin = require("firebase-admin");
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);


admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'it-helpdesk-89ecf',
});



app.use(CORS())
require('./models/db')
app.use(express.json());
app.use('/', userRouter)
app.use('/location', locationRouter);
app.use('/ticket', complaintRouter);
app.use('/dept', deptRouter);
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})
