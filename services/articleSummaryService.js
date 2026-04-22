const axios = require("axios")

const simplify = require("../utils/simplify")

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
const OLLAMA_GENERATE_URL = `${OLLAMA_BASE_URL}/api/generate`
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b"
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 90000)
const USE_OLLAMA = String(process.env.USE_OLLAMA || "false").toLowerCase() === "true"
const USE_OLLAMA_ARTICLE_BRIEF = String(process.env.USE_OLLAMA_ARTICLE_BRIEF || String(USE_OLLAMA)).toLowerCase() === "true"
const CONTENT_LIMIT = Number(process.env.OLLAMA_ARTICLE_CONTENT_LIMIT || 2200)
const ARTICLE_BATCH_SIZE = Math.max(1, Number(process.env.OLLAMA_ARTICLE_BATCH_SIZE || 1))
const ARTICLE_RETRY_CONTENT_LIMITS = [
  CONTENT_LIMIT,
  Math.max(1200, Math.floor(CONTENT_LIMIT * 0.65)),
  Math.max(700, Math.floor(CONTENT_LIMIT * 0.4))
]
const ARTICLE_BRIEF_RETRY_CONTENT_LIMITS = [
  CONTENT_LIMIT,
  Math.max(1000, Math.floor(CONTENT_LIMIT * 0.55))
]
const ARTICLE_RESPONSE_SCHEMA = {
  type: "object",
  required: ["articles"],
  properties: {
    articles: {
      type: "array",
      items: {
        type: "object",
        required: ["title", "summary", "highlights", "importantTerms"],
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          highlights: {
            type: "array",
            items: { type: "string" }
          },
          importantTerms: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    }
  }
}
const ARTICLE_BRIEF_RESPONSE_SCHEMA = {
  type: "object",
  required: ["title", "summary", "whyItMatters", "keyPoints", "relatedTopics"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    whyItMatters: { type: "string" },
    keyPoints: {
      type: "array",
      items: { type: "string" }
    },
    relatedTopics: {
      type: "array",
      items: { type: "string" }
    }
  }
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\[(\+\d+\schars|\d+\schars)\]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function clampText(value, maxLength = CONTENT_LIMIT) {
  const cleaned = normalizeText(value)
  if (!cleaned || cleaned.length <= maxLength) {
    return cleaned
  }

  return `${cleaned.slice(0, Math.max(0, maxLength - 3)).trim()}...`
}

function countWords(value) {
  return normalizeText(value).split(/\s+/).filter(Boolean).length
}

function limitSummaryLength(value, fallback = "") {
  const summary = normalizeText(value)
  const fallbackSummary = normalizeText(fallback)
  const candidate = summary || fallbackSummary
  const words = candidate.split(/\s+/).filter(Boolean)

  if (!words.length) {
    return ""
  }

  if (summary && countWords(summary) >= 60 && countWords(summary) <= 100) {
    return summary
  }

  if (fallbackSummary) {
    return fallbackSummary
  }

  if (words.length <= 100) {
    return candidate
  }

  return `${words.slice(0, 100).join(" ")}...`
}

function uniqueList(values, minimum, maximum, fallback = []) {
  const output = []

  for (const value of Array.isArray(values) ? values : []) {
    const cleaned = normalizeText(value)
    if (!cleaned) {
      continue
    }

    if (!output.some((entry) => entry.toLowerCase() === cleaned.toLowerCase())) {
      output.push(cleaned)
    }

    if (output.length >= maximum) {
      break
    }
  }

  if (output.length >= minimum) {
    return output
  }

  return (Array.isArray(fallback) ? fallback : []).slice(0, maximum)
}

function extractJson(text) {
  const cleaned = String(text || "").trim()
  const fenced = cleaned.match(/```json\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) {
    return fenced[1].trim()
  }

  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1)
  }

  return cleaned
}

function buildArticleBlock(article, index, contentLimit = CONTENT_LIMIT) {
  return [
    `Article ${index + 1}:`,
    `Title: ${normalizeText(article.title) || "Untitled insight"}`,
    `Source: ${normalizeText(article.source) || "Unknown source"}`,
    `Published: ${normalizeText(article.publishedAt) || ""}`,
    `Description: ${normalizeText(article.description) || ""}`,
    `Content: ${clampText(article.content, contentLimit) || ""}`
  ].join("\n")
}

function buildPrompt(articles, categoryLabel, profile = {}, contentLimit = CONTENT_LIMIT) {
  const interests = Array.isArray(profile.interests) ? profile.interests.filter(Boolean) : []
  const readerContext = interests.length
    ? `Reader interests: ${interests.join(", ")}. Emphasize those angles only when they are clearly supported by the article text.`
    : "No specific reader interests were provided."

  return [
    `You are summarizing ${categoryLabel || "news"} articles for a digital magazine.`,
    readerContext,
    "Return raw JSON only.",
    "Return exactly one object with an articles array.",
    "Keep article order exactly the same as the input.",
    "For each article return:",
    "- title",
    "- summary between 60 and 95 words",
    "- highlights with 2 to 3 short factual phrases",
    "- importantTerms with 3 to 5 short phrases",
    "Use only facts from the supplied article text.",
    "Prefer the main events, claims, numbers, dates, and named entities from the article body over generic framing.",
    "",
    articles.map((article, index) => buildArticleBlock(article, index, contentLimit)).join("\n\n")
  ].join("\n")
}

function buildArticleBriefPrompt(article, categoryLabel, profile = {}, contentLimit = CONTENT_LIMIT) {
  const interests = Array.isArray(profile.interests) ? profile.interests.filter(Boolean) : []
  const readerContext = interests.length
    ? `Reader interests: ${interests.join(", ")}. Connect the relevance to those interests only when the article supports it.`
    : "No specific reader interests were provided."

  return [
    `You are creating a concise AI reading brief for a ${categoryLabel || "news"} article.`,
    readerContext,
    "Return raw JSON only.",
    "Return exactly one object.",
    "Return these fields:",
    "- title",
    "- summary between 70 and 110 words",
    "- whyItMatters between 35 and 70 words",
    "- keyPoints with exactly 3 short factual bullets",
    "- relatedTopics with 3 to 5 short phrases",
    "Use only facts from the supplied article text.",
    "Prefer concrete events, claims, numbers, dates, and named entities over generic framing.",
    "",
    buildArticleBlock(article, 0, contentLimit)
  ].join("\n")
}

async function requestArticleSummaries(articles, options = {}) {
  const contentLimit = Number(options.contentLimit || CONTENT_LIMIT)
  const response = await axios.post(
    OLLAMA_GENERATE_URL,
    {
      model: DEFAULT_MODEL,
      prompt: buildPrompt(articles, options.categoryLabel, options.profile, contentLimit),
      format: ARTICLE_RESPONSE_SCHEMA,
      stream: false,
      options: {
        temperature: 0.2
      }
    },
    {
      timeout: OLLAMA_TIMEOUT_MS
    }
  )

  const outputText = extractJson(response.data?.response)
  if (!outputText) {
    throw new Error("Ollama response did not include JSON text.")
  }

  const parsed = JSON.parse(outputText)
  return Array.isArray(parsed?.articles) ? parsed.articles : []
}

async function requestArticleBrief(article, options = {}) {
  const contentLimit = Number(options.contentLimit || CONTENT_LIMIT)
  const response = await axios.post(
    OLLAMA_GENERATE_URL,
    {
      model: DEFAULT_MODEL,
      prompt: buildArticleBriefPrompt(article, options.categoryLabel, options.profile, contentLimit),
      format: ARTICLE_BRIEF_RESPONSE_SCHEMA,
      stream: false,
      options: {
        temperature: 0.2
      }
    },
    {
      timeout: OLLAMA_TIMEOUT_MS
    }
  )

  const outputText = extractJson(response.data?.response)
  if (!outputText) {
    throw new Error("Ollama response did not include JSON text.")
  }

  return JSON.parse(outputText)
}

function chunkArray(items, size) {
  const chunks = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function normalizeAiArticle(aiArticle, fallbackArticle) {
  return {
    ...fallbackArticle,
    title: normalizeText(aiArticle?.title) || fallbackArticle.title,
    summary: limitSummaryLength(aiArticle?.summary, fallbackArticle.summary),
    highlights: uniqueList(aiArticle?.highlights, 2, 3, fallbackArticle.highlights),
    importantTerms: uniqueList(aiArticle?.importantTerms, 3, 5, fallbackArticle.importantTerms)
  }
}

function buildFallbackWhyItMatters(fallbackArticle, categoryLabel, profile = {}) {
  const interests = Array.isArray(profile.interests) ? profile.interests.filter(Boolean) : []
  const categoryText = normalizeText(categoryLabel || fallbackArticle?.category || "this topic")
  const interestText = interests.length ? ` for readers tracking ${interests.slice(0, 2).join(" and ")}` : ""
  const summary = normalizeText(fallbackArticle?.summary)

  return limitSummaryLength(
    `${summary || "This article highlights a meaningful development."} This matters in ${categoryText}${interestText} because it helps explain what is changing, who is affected, and where the trend may head next.`,
    `This article matters in ${categoryText}${interestText} because it helps explain what is changing, who is affected, and why the development deserves attention now.`
  )
}

function normalizeArticleBrief(aiBrief, fallbackArticle, options = {}) {
  return {
    title: normalizeText(aiBrief?.title) || fallbackArticle.title,
    summary: limitSummaryLength(aiBrief?.summary, fallbackArticle.summary),
    whyItMatters: limitSummaryLength(
      aiBrief?.whyItMatters,
      buildFallbackWhyItMatters(fallbackArticle, options.categoryLabel, options.profile)
    ),
    keyPoints: uniqueList(aiBrief?.keyPoints, 3, 3, fallbackArticle.highlights).slice(0, 3),
    relatedTopics: uniqueList(aiBrief?.relatedTopics, 3, 5, fallbackArticle.importantTerms)
  }
}

async function summarizeSingleArticleBrief(article, categoryKey, options = {}) {
  const fallbackArticle = simplify(article, categoryKey)

  if (!USE_OLLAMA_ARTICLE_BRIEF) {
    return normalizeArticleBrief(null, fallbackArticle, options)
  }

  for (const contentLimit of ARTICLE_BRIEF_RETRY_CONTENT_LIMITS) {
    try {
      const aiBrief = await requestArticleBrief(article, {
        ...options,
        contentLimit
      })
      return normalizeArticleBrief(aiBrief, fallbackArticle, options)
    } catch (error) {
      console.error(
        `Ollama article brief failed for ${categoryKey || "article"} with content limit ${contentLimit}:`,
        error.response?.data || error.message
      )
    }
  }

  return normalizeArticleBrief(null, fallbackArticle, options)
}

async function summarizeSingleArticleWithRetries(article, fallbackArticle, options = {}, categoryKey, articleIndex) {
  for (const contentLimit of ARTICLE_RETRY_CONTENT_LIMITS) {
    try {
      const aiArticles = await requestArticleSummaries([article], {
        ...options,
        contentLimit
      })
      return normalizeAiArticle(aiArticles[0], fallbackArticle)
    } catch (error) {
      console.error(
        `Ollama single-article summarization failed for ${categoryKey} at article ${articleIndex} with content limit ${contentLimit}:`,
        error.response?.data || error.message
      )
    }
  }

  return fallbackArticle
}

async function summarizeArticlesWithAi(articles, categoryKey, options = {}) {
  const fallbackArticles = (Array.isArray(articles) ? articles : []).map((article) => simplify(article, categoryKey))

  if (!fallbackArticles.length || !USE_OLLAMA) {
    return fallbackArticles
  }

  const normalizedResults = new Array(fallbackArticles.length)
  const chunks = chunkArray(articles, ARTICLE_BATCH_SIZE)
  let articleOffset = 0

  for (const chunk of chunks) {
    const fallbackChunk = fallbackArticles.slice(articleOffset, articleOffset + chunk.length)

    if (chunk.length === 1) {
      normalizedResults[articleOffset] = await summarizeSingleArticleWithRetries(
        chunk[0],
        fallbackChunk[0],
        options,
        categoryKey,
        articleOffset
      )
      articleOffset += chunk.length
      continue
    }

    try {
      const aiArticles = await requestArticleSummaries(chunk, options)
      fallbackChunk.forEach((fallbackArticle, index) => {
        normalizedResults[articleOffset + index] = normalizeAiArticle(aiArticles[index], fallbackArticle)
      })
      articleOffset += chunk.length
      continue
    } catch (error) {
      console.error(
        `Ollama batch summarization failed for ${categoryKey} at offset ${articleOffset}:`,
        error.response?.data || error.message
      )
    }

    for (let index = 0; index < chunk.length; index += 1) {
      normalizedResults[articleOffset + index] = await summarizeSingleArticleWithRetries(
        chunk[index],
        fallbackChunk[index],
        options,
        categoryKey,
        articleOffset + index
      )
    }

    articleOffset += chunk.length
  }

  return normalizedResults.map((entry, index) => entry || fallbackArticles[index])
}

module.exports = {
  summarizeArticlesWithAi,
  summarizeSingleArticleBrief
}
