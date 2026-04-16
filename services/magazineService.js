const axios = require("axios")

const simplify = require("../utils/simplify")

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
const OLLAMA_GENERATE_URL = `${OLLAMA_BASE_URL}/api/generate`
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b"
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 15000)
const USE_OLLAMA = String(process.env.USE_OLLAMA || "false").toLowerCase() === "true"

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

function makeCategoryEntry(key, label, items) {
  const maxStories = Math.max(1, Number(items?.maxStories || items?.length || 4))
  return {
    categoryKey: key,
    categoryLabel: label,
    maxStories,
    stories: items.slice(0, maxStories).map((item) => ({
      title: item.title || "",
      description: item.description || "",
      content: item.content || "",
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
  const fallbackArticles = sourceStories.map((story, index) => buildArticleFromStory(story, group.categoryKey, index))

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

    const baseArticle = buildArticleFromStory(story, group.categoryKey, index)
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

  return [
    "Create an eye-catching digital magazine issue from the provided English-language news groups.",
    readerContext,
    "Requirements:",
    "- Use only facts that appear in the provided articles. Do not invent details.",
    "- The tone should feel editorial and polished, not academic or student-focused.",
    "- Completely exclude cinema and entertainment coverage. Do not include movies, actors, celebrities, trailers, or award-show topics.",
    "- Build a striking cover page without mentioning paper size, dimensions, or layout specs.",
    "- For every category, include at least 2 article summaries.",
    "- Each article summary should be 70 to 95 words and summarize the article only.",
    "- In each summary, clearly explain what happened, why it matters, and the practical impact for readers.",
    "- Do not mention students, learning goals, study tips, or audience-purpose language.",
    "- highlightedQuote should be a short excerpt-style line drawn from the provided article facts.",
    "- importantTerms should contain 3 to 5 short phrases worth visually highlighting.",
    "- Keep the writing clear, elegant, and magazine-like.",
    "- Prefer article images when available.",
    "- Do not mention paper size, orientation, magazine dimensions, or technical layout details in the copy.",
    "- Return valid JSON only. Do not include markdown fences or extra commentary.",
    "- Use this exact JSON shape:",
    JSON.stringify({
      cover: {
        title: "string",
        subtitle: "string",
        theme: "string",
        deck: "string",
        editorNote: "string",
        spotlightWords: ["string", "string"],
        heroStoryTitle: "string",
        heroStoryCategory: "string",
        heroImage: "string"
      },
      categoryDigests: [
        {
          categoryKey: "string",
          categoryLabel: "string",
          pageTitle: "string",
          intro: "string",
          highlightedQuote: "string",
          importantTerms: ["string", "string", "string"],
          leadImage: "string",
          leadSource: "string",
          leadPublishedAt: "string",
          articles: [
            {
              id: "string",
              title: "string",
              summary: "string",
              highlights: ["string", "string", "string"],
              importantTerms: ["string", "string"],
              source: "string",
              image: "string",
              publishedAt: "string",
              storyUrl: "string"
            }
          ]
        }
      ],
      closing: {
        title: "string",
        summary: "string",
        actionPoints: ["string", "string", "string"]
      },
      generationNote: "string"
    }, null, 2),
    "",
    "Article groups:",
    JSON.stringify(groups, null, 2)
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

  if (!digests.length) {
    return fallback
  }

  return {
    source: issue.source || "ollama",
    cover: {
      ...fallback.cover,
      ...(issue.cover || {})
    },
    categoryDigests: digests.map((digest, index) => {
      const sourceGroup = groups[index] || {
        categoryKey: `category-${index + 1}`,
        categoryLabel: `Category ${index + 1}`,
        maxStories: 4,
        stories: []
      }
      const fallbackDigest = fallback.categoryDigests[index] || buildFallbackCategory(sourceGroup, profile)
      const articles = buildCategoryArticles(sourceGroup, Array.isArray(digest.articles) ? digest.articles : [])

      return {
        ...fallbackDigest,
        ...digest,
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
  const groups = rawGroups.map((group) => makeCategoryEntry(group.key, group.label, group.items))

  if (!USE_OLLAMA) {
    return buildFallbackIssue(groups, {
      ...profile,
      generationNote: "Local summarization is active. Ollama generation is disabled."
    })
  }

  try {
    const response = await axios.post(
      OLLAMA_GENERATE_URL,
      {
        model: DEFAULT_MODEL,
        prompt: buildPrompt(groups, profile),
        format: "json",
        stream: false,
        options: {
          temperature: 0.4
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

    const issue = JSON.parse(outputText)
    return normalizeIssue(issue, groups, profile)
  } catch (error) {
    console.error("Ollama magazine generation failed:", error.response?.data || error.message)
    return buildFallbackIssue(groups, profile)
  }
}

module.exports = createMagazineIssue
