const mongoose = require('mongoose')

const Schema = mongoose.Schema

const locationSchema = new Schema({
    location: {
        type: String,
        required: true
    },
},{timestamps:true})

module.exports = mongoose.model("LocationName", locationSchema);