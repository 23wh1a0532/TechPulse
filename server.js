const express = require("express")
const cors = require("cors")
const path = require("path")
require("dotenv").config()

const connectDb = require("./config/db")
const authRoute = require("./routes/auth")
const insightsRoute = require("./routes/insights")

const app = express()
const frontendDir = path.join(__dirname, "..", "frontend")

app.use(cors())
app.use(express.json())
app.use(express.static(frontendDir))

app.use("/api/auth", authRoute)
app.use("/api/insights", insightsRoute)

app.get("/", (req, res) => {
  res.redirect("/home.html")
})

const PORT = process.env.PORT || 5000

async function startServer() {
  try {
    await connectDb()
    app.listen(PORT, () => {
      console.log(`TechPulse server running on ${PORT}`)
    })
  } catch (error) {
    console.error("Server startup failed:", error.message)
    process.exit(1)
  }
}

startServer()
