function cleanText(value) {
  return String(value || "")
    .replace(/\[(\+\d+\schars|\d+\schars)\]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function countWords(text) {
  return cleanText(text).split(/\s+/).filter(Boolean).length
}

function splitSentences(text) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function clamp(text, maxLength) {
  const cleaned = cleanText(text)
  if (cleaned.length <= maxLength) {
    return cleaned
  }

  return `${cleaned.slice(0, maxLength - 3).trim()}...`
}

function trimToWordLimit(text, maxWords) {
  const words = cleanText(text).split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) {
    return words.join(" ")
  }

  return `${words.slice(0, maxWords).join(" ")}...`
}

function createSlug(text) {
  return cleanText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function buildSummary(title, description, content) {
  const sentences = splitSentences([description, content].filter(Boolean).join(" "))
  const unique = []

  for (const sentence of sentences) {
    if (!unique.some((item) => item.toLowerCase() === sentence.toLowerCase())) {
      unique.push(sentence)
    }
  }

  const assembled = []

  if (title) {
    assembled.push(`${cleanText(title)}.`)
  }

  for (const sentence of unique) {
    const candidate = [...assembled, sentence].join(" ").trim()
    assembled.push(sentence)

    if (countWords(candidate) >= 80) {
      break
    }
  }

  const summary = trimToWordLimit(assembled.join(" "), 95)
  return clamp(summary, 980)
}

function extractHighlights(title, description, content) {
  const sentences = splitSentences([title, description, content].filter(Boolean).join(" "))
  return sentences.slice(0, 5).map((sentence) => clamp(sentence, 190))
}

function findImportantTerms(title, description, content) {
  const text = cleanText([title, description, content].filter(Boolean).join(" "))
  const ignored = new Set([
    "the", "and", "for", "with", "from", "that", "this", "have", "will", "into",
    "about", "after", "before", "their", "there", "while", "where", "which",
    "technology", "science", "research", "environment", "global", "careers", "industry"
  ])

  const words = text
    .toLowerCase()
    .match(/[a-z][a-z0-9-]{3,}/g) || []

  const counts = new Map()
  words.forEach((word) => {
    if (ignored.has(word)) {
      return
    }

    counts.set(word, (counts.get(word) || 0) + 1)
  })

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([word]) => word.replace(/(^|-)([a-z])/g, (_, dash, letter) => `${dash}${letter.toUpperCase()}`))
}

function simplify(article, category) {
  const title = cleanText(article.title) || "Untitled insight"
  const description = cleanText(article.description) || "A short overview is not available for this article yet."
  const content = cleanText(article.content)
  const summary = buildSummary(title, description, content)
  const keyPoints = extractHighlights(title, description, content)
  const importantTerms = findImportantTerms(title, description, content)

  return {
    id: createSlug(`${category}-${title}`),
    category,
    title,
    description: clamp(description, 220),
    summary,
    highlights: keyPoints,
    importantTerms,
    source: cleanText(article.source) || "Unknown source",
    link: article.url,
    image: article.image || "",
    publishedAt: article.publishedAt || "",
    readTime: Math.max(1, Math.round(summary.split(/\s+/).filter(Boolean).length / 160))
  }
}

module.exports = simplify
