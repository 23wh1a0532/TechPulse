const axios = require("axios")

const simplify = require("../utils/simplify")

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
const OLLAMA_GENERATE_URL = `${OLLAMA_BASE_URL}/api/generate`
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "mistral:latest"
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 15000)
const USE_OLLAMA = String(process.env.USE_OLLAMA || "false").toLowerCase() === "true"
const USE_OLLAMA_MAGAZINE = String(process.env.USE_OLLAMA_MAGAZINE || "false").toLowerCase() === "true"
const CONTENT_LIMIT = Number(process.env.OLLAMA_ARTICLE_CONTENT_LIMIT || 1000)
const ISSUE_RESPONSE_SCHEMA = {
  type: "object",
  required: ["cover", "categoryDigests", "closing", "generationNote"],
  properties: {
    cover: {
      type: "object",
      required: [
        "title",
        "subtitle",
        "theme",
        "deck",
        "editorNote",
        "spotlightWords",
        "heroStoryTitle",
        "heroStoryCategory",
        "heroImage"
      ],
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        theme: { type: "string" },
        deck: { type: "string" },
        editorNote: { type: "string" },
        spotlightWords: {
          type: "array",
          items: { type: "string" }
        },
        heroStoryTitle: { type: "string" },
        heroStoryCategory: { type: "string" },
        heroImage: { type: "string" }
      }
    },
    categoryDigests: {
      type: "array",
      items: {
        type: "object",
        required: [
          "categoryKey",
          "categoryLabel",
          "pageTitle",
          "intro",
          "highlightedQuote",
          "importantTerms",
          "leadImage",
          "leadSource",
          "leadPublishedAt",
          "articles"
        ],
        properties: {
          categoryKey: { type: "string" },
          categoryLabel: { type: "string" },
          pageTitle: { type: "string" },
          intro: { type: "string" },
          highlightedQuote: { type: "string" },
          importantTerms: {
            type: "array",
            items: { type: "string" }
          },
          leadImage: { type: "string" },
          leadSource: { type: "string" },
          leadPublishedAt: { type: "string" },
          articles: {
            type: "array",
            items: {
              type: "object",
              required: [
                "id",
                "title",
                "summary",
                "highlights",
                "importantTerms",
                "source",
                "image",
                "publishedAt",
                "storyUrl"
              ],
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                summary: { type: "string" },
                highlights: {
                  type: "array",
                  items: { type: "string" }
                },
                importantTerms: {
                  type: "array",
                  items: { type: "string" }
                },
                source: { type: "string" },
                image: { type: "string" },
                publishedAt: { type: "string" },
                storyUrl: { type: "string" }
              }
            }
          }
        }
      }
    },
    closing: {
      type: "object",
      required: ["title", "summary", "actionPoints"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        actionPoints: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    generationNote: { type: "string" }
  }
}

function normalizeSummaryLength(value, fallback = "") {
  const summary = String(value || "").replace(/\s+/g, " ").trim()
  const fallbackSummary = String(fallback || "").replace(/\s+/g, " ").trim()
  const source = summary || fallbackSummary
  const words = source.split(/\s+/).filter(Boolean)

  if (!words.length) {
    return ""
  }

  if (words.length < 70 && fallbackSummary) {
    return fallbackSummary
  }

  if (words.length <= 95) {
    return source
  }

  return `${words.slice(0, 95).join(" ")}...`
}

function trimContent(value, maxLength = CONTENT_LIMIT) {
  const text = String(value || "").replace(/\s+/g, " ").trim()
  if (!text || text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`
}

function makeCategoryEntry(key, label, items, summarizedItems = []) {
  const maxStories = Math.max(1, Number(items?.maxStories || items?.length || 4))
  return {
    categoryKey: key,
    categoryLabel: label,
    maxStories,
    summarizedItems: Array.isArray(summarizedItems) ? summarizedItems.slice(0, maxStories) : [],
    stories: items.slice(0, maxStories).map((item) => ({
      title: item.title || "",
      description: item.description || "",
      content: trimContent(item.content),
      source: item.source || "",
      link: item.url || "",
      image: item.image || "",
      publishedAt: item.publishedAt || ""
    }))
  }
}

function formatInterestLabel(value) {
  const labels = {
    ai: "AI",
    cybersecurity: "Cybersecurity",
    cloud: "Cloud",
    startups: "Startups",
    space: "Space",
    science: "Science",
    climate: "Climate",
    careers: "Careers"
  }

  return labels[value] || String(value || "")
}

function buildArticleFromStory(story, categoryKey, index) {
  const simplified = simplify({
    title: story.title,
    description: story.description,
    content: story.content,
    source: story.source,
    url: story.link,
    image: story.image,
    publishedAt: story.publishedAt
  }, `${categoryKey}-${index}`)

  return {
    id: simplified.id,
    title: simplified.title,
    summary: simplified.summary,
    highlights: simplified.highlights,
    importantTerms: simplified.importantTerms,
    source: simplified.source,
    image: simplified.image || "",
    publishedAt: simplified.publishedAt || "",
    storyUrl: simplified.link || ""
  }
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function findMatchingDigest(digests, group) {
  const expectedKey = String(group?.categoryKey || "").trim().toLowerCase()
  const expectedLabel = normalizeText(group?.categoryLabel)

  return (Array.isArray(digests) ? digests : []).find((digest) => {
    const digestKey = String(digest?.categoryKey || "").trim().toLowerCase()
    const digestLabel = normalizeText(digest?.categoryLabel)

    if (expectedKey && digestKey && expectedKey === digestKey) {
      return true
    }

    if (expectedLabel && digestLabel && expectedLabel === digestLabel) {
      return true
    }

    return false
  }) || null
}

function findMatchingStory(stories, article) {
  const requestedUrl = String(article?.storyUrl || article?.link || "").trim()
  const requestedTitle = normalizeText(article?.title)

  return stories.find((story) => {
    const storyUrl = String(story.link || "").trim()
    const storyTitle = normalizeText(story.title)

    if (requestedUrl && storyUrl && requestedUrl === storyUrl) {
      return true
    }

    if (requestedTitle && storyTitle && requestedTitle === storyTitle) {
      return true
    }

    return false
  }) || null
}

function buildCategoryArticles(group, requestedArticles = []) {
  const maxStories = Math.max(1, Number(group?.maxStories || 4))
  const sourceStories = Array.isArray(group?.stories) ? group.stories.slice(0, maxStories) : []
  const fallbackArticles = sourceStories.map((story, index) => {
    return group.summarizedItems?.[index] || buildArticleFromStory(story, group.categoryKey, index)
  })

  if (!requestedArticles.length) {
    return fallbackArticles
  }

  const usedUrls = new Set()
  const matchedArticles = []

  requestedArticles.forEach((article, index) => {
    const story = findMatchingStory(sourceStories, article)
    if (!story) {
      return
    }

    const storyUrl = String(story.link || "").trim()
    if (storyUrl && usedUrls.has(storyUrl)) {
      return
    }

    if (storyUrl) {
      usedUrls.add(storyUrl)
    }

    const storyIndex = sourceStories.indexOf(story)
    const baseArticle = fallbackArticles[storyIndex] || buildArticleFromStory(story, group.categoryKey, index)
    matchedArticles.push({
      ...baseArticle,
      ...article,
      summary: normalizeSummaryLength(article.summary, baseArticle.summary),
      image: article.image || baseArticle.image,
      publishedAt: article.publishedAt || baseArticle.publishedAt,
      source: article.source || baseArticle.source,
      storyUrl: baseArticle.storyUrl
    })
  })

  fallbackArticles.forEach((article) => {
    if (matchedArticles.length >= maxStories) {
      return
    }

    const storyUrl = String(article.storyUrl || "").trim()
    if (storyUrl && usedUrls.has(storyUrl)) {
      return
    }

    if (storyUrl) {
      usedUrls.add(storyUrl)
    }

    matchedArticles.push(article)
  })

  return matchedArticles.slice(0, maxStories)
}

function pickHeroImage(groups) {
  for (const group of groups) {
    const withImage = (group.stories || []).find((story) => story.image)
    if (withImage) {
      return withImage.image
    }
  }

  return ""
}

function buildFallbackCategory(group, profile = {}) {
  const articles = buildCategoryArticles(group)
  const interests = Array.isArray(profile.interests) ? profile.interests.map(formatInterestLabel) : []
  const interestNote = interests.length
    ? `Selected for readers following ${interests.slice(0, 3).join(", ")}.`
    : ""

  const leadArticle = articles[0] || {
    title: group.categoryLabel,
    image: "",
    source: "TechPulse",
    publishedAt: ""
  }

  return {
    categoryKey: group.categoryKey,
    categoryLabel: group.categoryLabel,
    pageTitle: `${group.categoryLabel} Briefing`,
    intro: `A focused edit of the latest ${group.categoryLabel.toLowerCase()} coverage, condensed into clear article summaries. ${interestNote}`.trim(),
    highlightedQuote: articles[0]?.highlights?.[0] || articles[0]?.summary || "",
    importantTerms: Array.from(new Set(articles.flatMap((article) => article.importantTerms || []))).slice(0, 5),
    leadImage: leadArticle.image || "",
    leadSource: leadArticle.source,
    leadPublishedAt: leadArticle.publishedAt,
    articles
  }
}

function buildFallbackIssue(groups, profile = {}) {
  const digests = groups.map((group) => buildFallbackCategory(group, profile))
  const leadDigest = digests[0] || {
    categoryLabel: "World Briefing",
    articles: [{ title: "Today in focus" }],
    leadImage: ""
  }

  const interests = Array.isArray(profile.interests) ? profile.interests.map(formatInterestLabel) : []
  const personalizedTheme = interests.length
    ? `A visual briefing across technology, science, environment, and careers, tuned for readers tracking ${interests.slice(0, 3).join(", ")}.`
    : "A visual briefing across technology, science, environment, and careers."

  return {
    source: "fallback",
    cover: {
      title: "TechPulse Weekly",
      subtitle: "Feature Issue",
      theme: personalizedTheme,
      deck: "A dense editorial digest built from live reporting, with each category carrying multiple article summaries.",
      editorNote: "",
      spotlightWords: ["Feature Edit", "Two Stories Each", "Visual Briefing", "English Sources"],
      heroStoryTitle: leadDigest.articles[0]?.title || "Cover feature",
      heroStoryCategory: leadDigest.categoryLabel,
      heroImage: pickHeroImage(groups) || leadDigest.leadImage || ""
    },
    categoryDigests: digests,
    closing: {
      title: "Issue Index",
      summary: "This issue pairs each category with multiple concise article summaries so the magazine reads like a curated editorial digest rather than a generic feed.",
      actionPoints: [
        "Compare how each category frames urgency, discovery, and change.",
        "Open any source story for the full report and original context.",
        "Refresh the issue to pull a new set of live articles."
      ]
    },
    generationNote: profile.generationNote || "Fallback summarization was used because Ollama did not answer."
  }
}

function buildPrompt(groups, profile = {}) {
  const interests = Array.isArray(profile.interests) ? profile.interests.map(formatInterestLabel) : []
  const readerContext = interests.length
    ? `Reader interests: ${interests.join(", ")}. Where appropriate, foreground details connected to those interests without inventing facts.`
    : "No explicit reader interests were provided."

  const categoryBlocks = groups.map((group) => {
    const stories = Array.isArray(group.summarizedItems) && group.summarizedItems.length
      ? group.summarizedItems
      : buildCategoryArticles(group)

    const storyBlocks = stories.slice(0, group.maxStories || 4).map((story, index) => [
      `Article ${index + 1}:`,
      `Title: ${story.title || ""}`,
      `Source: ${story.source || ""}`,
      `Published: ${story.publishedAt || ""}`,
      `Summary: ${story.summary || ""}`,
      `Highlights: ${(story.highlights || []).join(" | ")}`,
      `Important Terms: ${(story.importantTerms || []).join(" | ")}`,
      `Story URL: ${story.storyUrl || ""}`
    ].join("\n")).join("\n\n")

    return [
      `Category: ${group.categoryLabel}`,
      storyBlocks
    ].join("\n")
  }).join("\n\n")

  return [
    "Create one complete digital magazine issue from the provided English-language article summaries.",
    readerContext,
    "Rules:",
    "- Return exactly one top-level JSON object.",
    "- The top-level object must contain: cover, categoryDigests, closing, generationNote.",
    "- Do not return a schema, instructions, placeholders, or explanations.",
    "- Use only facts from the provided summaries and metadata.",
    "- Keep the tone editorial and polished.",
    "- For each category, include 2 to 4 article summaries.",
    "- Each summary should be 70 to 95 words.",
    "- highlightedQuote must be a short factual line.",
    "- importantTerms must contain 3 to 5 short phrases.",
    "- If a value is unavailable, return an empty string or empty array instead of omitting the field.",
    "- Return raw JSON only.",
    "",
    "Magazine source material:",
    categoryBlocks
  ].join("\n")
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

function normalizeIssue(issue, groups, profile = {}) {
  if (!issue || typeof issue !== "object") {
    return buildFallbackIssue(groups, profile)
  }

  const fallback = buildFallbackIssue(groups, profile)
  const digests = Array.isArray(issue.categoryDigests) ? issue.categoryDigests : []

  return {
    source: issue.source || "ollama",
    cover: {
      ...fallback.cover,
      ...(issue.cover || {})
    },
    categoryDigests: groups.map((sourceGroup, index) => {
      const digest = findMatchingDigest(digests, sourceGroup)
      const fallbackDigest = fallback.categoryDigests[index] || buildFallbackCategory(sourceGroup, profile)
      const articles = buildCategoryArticles(sourceGroup, Array.isArray(digest?.articles) ? digest.articles : [])

      return {
        ...fallbackDigest,
        ...(digest || {}),
        categoryKey: sourceGroup.categoryKey,
        categoryLabel: sourceGroup.categoryLabel,
        leadImage: articles[0]?.image || fallbackDigest.leadImage,
        leadSource: articles[0]?.source || fallbackDigest.leadSource,
        leadPublishedAt: articles[0]?.publishedAt || fallbackDigest.leadPublishedAt,
        articles
      }
    }),
    closing: {
      ...fallback.closing,
      ...(issue.closing || {})
    },
    generationNote: issue.generationNote || fallback.generationNote
  }
}

async function createMagazineIssue(rawGroups, profile = {}) {
  const groups = rawGroups.map((group) => makeCategoryEntry(
    group.key,
    group.label,
    group.items,
    group.summarizedItems
  ))

  if (!USE_OLLAMA || !USE_OLLAMA_MAGAZINE) {
    const reason = !USE_OLLAMA
      ? "USE_OLLAMA is false"
      : "USE_OLLAMA_MAGAZINE is false"
    console.log(`Ollama skipped for magazine generation: ${reason}. Using fallback issue generation.`)
    return buildFallbackIssue(groups, {
      ...profile,
      generationNote: "Fast local issue generation is active. Ollama magazine generation is disabled."
    })
  }

  try {
    console.log(`Ollama generation started with model ${DEFAULT_MODEL}.`)
    const response = await axios.post(
      OLLAMA_GENERATE_URL,
      {
        model: DEFAULT_MODEL,
        prompt: buildPrompt(groups, profile),
        format: ISSUE_RESPONSE_SCHEMA,
        stream: false,
        options: {
          temperature: 0.4
        }
      },
      {
        timeout: OLLAMA_TIMEOUT_MS
      }
    )

    console.log("Ollama response received. Extracting JSON output.")
    console.log(response.data?.response)
    const outputText = extractJson(response.data?.response)
    if (!outputText) {
      throw new Error("Ollama response did not include JSON text.")
    }

    const issue = JSON.parse(outputText)
    console.log("Ollama JSON parsed successfully. Validating generated issue structure.")
    console.log("Raw Ollama issue keys:", Object.keys(issue || {}))
    console.log(
      "Raw Ollama categoryDigests length:",
      Array.isArray(issue?.categoryDigests) ? issue.categoryDigests.length : "missing"
    )
    const normalizedIssue = normalizeIssue(issue, groups, profile)
    console.log(`Final issue source after normalization: ${normalizedIssue.source}.`)
    return normalizedIssue
  } catch (error) {
    console.error("Ollama magazine generation failed:", error.response?.data || error.message)
    console.log("Fallback issue generation is being used instead.")
    return buildFallbackIssue(groups, profile)
  }
}

module.exports = createMagazineIssue
