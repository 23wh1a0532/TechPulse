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
app.use(express.json({ limit: "2mb" }))
app.use(express.static(frontendDir))

app.use("/api/auth", authRoute)
app.use("/api/insights", insightsRoute)

app.get("/", (req, res) => {
  res.redirect("/home.html")
})

app.use((error, req, res, next) => {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      error: "The request payload was too large. Try archiving a smaller issue snapshot."
    })
  }

  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({
      error: "The request body was not valid JSON."
    })
  }

  if (error) {
    console.error("Unhandled server error:", error.message)
    return res.status(500).json({
      error: "An unexpected server error occurred."
    })
  }

  next()
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
