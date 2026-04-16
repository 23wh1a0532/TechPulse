const axios = require("axios")
require("dotenv").config()

const REQUEST_TIMEOUT_MS = 12000

function getLocalTechFallback() {
  const now = new Date().toISOString()
  return [
    {
      title: "AI Infrastructure Spending Shifts Toward Efficient Deployment",
      description: "Companies are moving budgets from experimentation toward inference efficiency, monitoring, and dependable production operations.",
      url: "",
      content: "Engineering teams are prioritizing lower-latency delivery, cost control, and stronger observability as AI usage grows in real products.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    },
    {
      title: "Cybersecurity Teams Expand Identity-First Cloud Controls",
      description: "Security programs are tightening access policies, endpoint visibility, and incident readiness across cloud environments.",
      url: "",
      content: "Organizations are investing in zero-trust patterns and faster response workflows to reduce exposure from account compromise and service misconfiguration.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    }
  ]
}

async function techService(){

const query = "AI OR machine learning OR cloud computing OR cybersecurity OR semiconductors OR robotics OR devops"
const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${process.env.NEWS_API_KEY}`

try {
const res = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS })

return res.data.articles.map(a => ({
title: a.title,
description: a.description,
url: a.url,
content: a.content,
image: a.urlToImage,
publishedAt: a.publishedAt,
source: a.source.name
}))
} catch (error) {
  console.error("Technology NewsAPI fetch failed:", error.response?.data || error.message)
  return getLocalTechFallback()
}

}

module.exports = techService
