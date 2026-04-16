const mongoose = require("mongoose")

async function connectDb() {
  const connectionString = process.env.MONGODB_URI

  if (!connectionString) {
    throw new Error("MONGODB_URI is missing. Add your MongoDB connection string to backend/.env.")
  }

  await mongoose.connect(connectionString)
  console.log("MongoDB connected")
}

module.exports = connectDb
