const axios = require("axios")
require("dotenv").config()
const { fetchRssArticles } = require("../utils/rssFallback")

const REQUEST_TIMEOUT_MS = 12000
const CACHE_TTL_MS = 10 * 60 * 1000
const GNEWS_RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000

let cachedCareerArticles = []
let cacheExpiresAt = 0
let skipGnewsUntil = 0

function getLocalCareerFallback() {
  const now = new Date().toISOString()
  return [
    {
      title: "AI Product Roles Continue to Grow Across Startups",
      description: "Hiring demand is rising for professionals who can combine product strategy, data fluency, and rapid experimentation.",
      url: "",
      content: "Teams are prioritizing candidates who can turn model capabilities into measurable customer outcomes.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    },
    {
      title: "Cloud Security Skills Remain a Top Hiring Signal",
      description: "Companies are emphasizing practical experience in identity, monitoring, and incident response for modern cloud stacks.",
      url: "",
      content: "Security-focused engineering roles are expanding as organizations tighten governance and resilience standards.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    },
    {
      title: "Developer Hiring Shifts Toward Systems and Automation",
      description: "Employers are favoring engineers who can improve reliability, deployment workflows, and operational efficiency.",
      url: "",
      content: "Career momentum is strongest for candidates with strong fundamentals and automation-focused project experience.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    },
    {
      title: "Platform Engineering Hiring Rewards Reliability Experience",
      description: "Teams are actively seeking engineers who can strengthen release processes, observability, and incident response.",
      url: "",
      content: "Operational maturity is becoming a hiring differentiator as companies look for candidates who can keep complex products stable while shipping quickly.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    },
    {
      title: "Data Literacy Remains Valuable Across Technical and Business Roles",
      description: "Employers continue to reward professionals who can connect metrics, experimentation, and daily execution.",
      url: "",
      content: "Candidates with strong analytical communication skills are standing out because they can turn dashboards and performance data into decisions teams can act on.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    },
    {
      title: "Career Growth Favors Engineers Who Can Automate Repetitive Work",
      description: "Automation experience is helping professionals improve team efficiency and demonstrate clear business impact.",
      url: "",
      content: "Hiring managers are looking for people who can remove manual overhead, improve workflows, and support scalable delivery through practical tooling.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    },
    {
      title: "Cross-Functional Delivery Skills Help Candidates Stand Out",
      description: "Organizations want people who can align engineering work with product goals, customer outcomes, and measurable execution.",
      url: "",
      content: "Professionals who can communicate clearly across teams and drive projects from planning through launch are gaining an advantage in competitive hiring cycles.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    },
    {
      title: "Embedded Learning Programs Support Faster Workforce Adaptation",
      description: "Companies are investing in role-based upskilling tied directly to the tools and workflows employees use each day.",
      url: "",
      content: "On-the-job learning is gaining traction because it helps teams adopt new systems more quickly while giving employees visible paths to growth and mobility.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    },
    {
      title: "Portfolio Evidence Carries More Weight in Technical Hiring",
      description: "Candidates are differentiating themselves with shipped work, measurable outcomes, and clearer ownership stories.",
      url: "",
      content: "Recruiters and hiring managers increasingly prefer practical evidence of execution over generic claims because it makes judgment, reliability, and impact easier to assess.",
      image: "",
      publishedAt: now,
      source: "TechPulse Fallback"
    }
  ]
}

function mapGnewsArticle(a) {
  return {
    title: a.title,
    description: a.description,
    url: a.url,
    content: a.content,
    image: a.image,
    publishedAt: a.publishedAt,
    source: a.source?.name || "Unknown source"
  }
}

function mapNewsApiArticle(a) {
  return {
    title: a.title,
    description: a.description,
    url: a.url,
    content: a.content,
    image: a.urlToImage,
    publishedAt: a.publishedAt,
    source: a.source?.name || "Unknown source"
  }
}

function getCachedArticles() {
  if (!cachedCareerArticles.length || Date.now() >= cacheExpiresAt) {
    return null
  }

  return cachedCareerArticles
}

function setCachedArticles(articles) {
  const normalized = Array.isArray(articles) ? articles : []

  if (!normalized.length) {
    return normalized
  }

  cachedCareerArticles = normalized
  cacheExpiresAt = Date.now() + CACHE_TTL_MS
  return normalized
}

function isRateLimitedError(error) {
  const status = Number(error?.response?.status || 0)
  const payload = JSON.stringify(error?.response?.data || "").toLowerCase()
  const message = String(error?.message || "").toLowerCase()

  return status === 429 || payload.includes("too many requests") || message.includes("too many requests")
}

async function careerService() {
  const cached = getCachedArticles()
  if (cached) {
    return cached
  }

  const careerQuery = "tech jobs OR software engineer OR hiring OR layoffs OR workforce OR employment OR upskilling OR reskilling OR internship OR salaries OR startup hiring"
  const gnewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(careerQuery)}&lang=en&max=20&apikey=${process.env.GNEWS_API_KEY}`

  if (Date.now() >= skipGnewsUntil) {
    try {
      const gnewsResponse = await axios.get(gnewsUrl, { timeout: REQUEST_TIMEOUT_MS })
      const gnewsArticles = (gnewsResponse.data?.articles || []).map(mapGnewsArticle)

      if (gnewsArticles.length) {
        return setCachedArticles(gnewsArticles)
      }
    } catch (error) {
      if (isRateLimitedError(error)) {
        skipGnewsUntil = Date.now() + GNEWS_RATE_LIMIT_COOLDOWN_MS
        console.warn("Careers GNews rate limited. Using fallback sources until cooldown ends.")
      } else {
        console.error("Careers GNews fetch failed:", error.response?.data || error.message)
      }
    }
  }

  const newsApiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(careerQuery)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${process.env.NEWS_API_KEY}`

  try {
    const newsApiResponse = await axios.get(newsApiUrl, { timeout: REQUEST_TIMEOUT_MS })
    const newsApiArticles = (newsApiResponse.data?.articles || []).map(mapNewsApiArticle)
    if (newsApiArticles.length) {
      return setCachedArticles(newsApiArticles)
    }
  } catch (error) {
    console.error("Careers NewsAPI fallback failed:", error.response?.data || error.message)
  }

  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(careerQuery)}&hl=en-US&gl=US&ceid=US:en`
  try {
    const rssArticles = await fetchRssArticles(rssUrl, 20)
    if (rssArticles.length) {
      return setCachedArticles(rssArticles)
    }
  } catch (error) {
    console.error("Careers RSS fallback failed:", error.response?.data || error.message)
  }

  return setCachedArticles(getLocalCareerFallback())
}

module.exports = careerService
