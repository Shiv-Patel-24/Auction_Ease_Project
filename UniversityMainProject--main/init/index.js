const mongoose = require("mongoose")
const initData = require('./data.JS')
const Listing = require('../models/listing.js')

const MONGO_URL = 'mongodb://127.0.0.1:27017/finalproject';

main().then(() =>{
    console.log("connected to DB");
}).catch((err) =>{
    console.log(err);
})
 
async function main() {
    await mongoose.connect(MONGO_URL)
}

const initDB = async() =>{
    await Listing.deleteMany({})
     initData.data = initData.data.map((obj) => ({...obj, owner : '686fc38800f75540c8b185b2'}))   //map function create a new array, map can't change in old an array
    await Listing.insertMany(initData.data);
    console.log("data was initialized")
}

initDB();
