require("dotenv").config()
const mongoose = require("mongoose");

const connectDB = async () => {
  await mongoose.connect(
    process.env.MONGODB_CONNECTION_STRING + "/chess"
  );
};

module.exports = connectDB;
