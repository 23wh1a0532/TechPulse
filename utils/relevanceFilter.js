const SCIENCE_KEYWORDS = [
  "research",
  "study",
  "scientist",
  "scientists",
  "clinical trial",
  "peer reviewed",
  "lab",
  "laboratory",
  "experiment",
  "experiments",
  "space",
  "nasa",
  "astronomy",
  "astrophysics",
  "physics",
  "biology",
  "biotech",
  "genomics",
  "medicine",
  "medical",
  "healthcare innovation",
  "vaccine",
  "drug discovery",
  "cell",
  "molecule",
  "telescope",
  "satellite",
  "climate science",
  "quantum",
  "neuroscience"
]

const SCIENCE_SOURCES = [
  "nasa",
  "nature",
  "science",
  "scientific american",
  "new scientist",
  "phys.org",
  "sciencedaily",
  "livescience",
  "national geographic",
  "nih",
  "who",
  "cdc"
]

const SCIENCE_BLOCKED_KEYWORDS = [
  "soap",
  "soap opera",
  "entertainment",
  "celebrity",
  "movie",
  "cinema",
  "fashion",
  "dating",
  "romance",
  "wedding",
  "astrology",
  "horoscope",
  "gossip",
  "reality show",
  "box office",
  "music video"
]

const CAREER_KEYWORDS = [
  "career",
  "careers",
  "hiring",
  "recruitment",
  "job market",
  "job growth",
  "workforce",
  "upskilling",
  "reskilling",
  "employment",
  "layoff",
  "layoffs",
  "salary",
  "compensation",
  "internship",
  "engineering role",
  "developer role",
  "software engineer",
  "product manager",
  "data scientist",
  "cloud engineer",
  "cybersecurity analyst",
  "startup hiring",
  "remote work",
  "skills demand"
]

const TECH_KEYWORDS = [
  "artificial intelligence",
  "ai",
  "machine learning",
  "cybersecurity",
  "cloud",
  "devops",
  "software",
  "programming",
  "developer",
  "api",
  "automation",
  "robotics",
  "data engineering",
  "blockchain",
  "semiconductor",
  "chip",
  "quantum computing",
  "internet of things",
  "edge computing",
  "digital transformation"
]

const ENVIRONMENT_KEYWORDS = [
  "climate",
  "sustainability",
  "renewable energy",
  "solar",
  "wind energy",
  "carbon",
  "emissions",
  "net zero",
  "biodiversity",
  "conservation",
  "environment",
  "pollution",
  "water quality",
  "ecology",
  "green technology",
  "climate adaptation",
  "resilience",
  "energy transition"
]

function normalize(value) {
  return String(value || "").toLowerCase()
}

function toPattern(keyword) {
  const escaped = keyword
    .toLowerCase()
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+")

  return new RegExp(`\\b${escaped}\\b`, "i")
}

const SCIENCE_PATTERNS = SCIENCE_KEYWORDS.map(toPattern)
const SCIENCE_BLOCKED_PATTERNS = SCIENCE_BLOCKED_KEYWORDS.map(toPattern)
const CAREER_PATTERNS = CAREER_KEYWORDS.map(toPattern)
const TECH_PATTERNS = TECH_KEYWORDS.map(toPattern)
const ENVIRONMENT_PATTERNS = ENVIRONMENT_KEYWORDS.map(toPattern)

function scoreScienceRelevance(article) {
  const text = normalize([
    article?.title,
    article?.description,
    article?.content
  ].filter(Boolean).join(" "))
  const source = normalize(article?.source)

  if (!text) {
    return 0
  }

  let score = 0
  for (const pattern of SCIENCE_PATTERNS) {
    if (pattern.test(text)) {
      score += 1
    }
  }

  const trustedSource = SCIENCE_SOURCES.some((trusted) => source.includes(trusted))
  if (trustedSource) {
    score += 2
  }

  const hasBlockedTopic = SCIENCE_BLOCKED_PATTERNS.some((pattern) => pattern.test(text))
  if (hasBlockedTopic) {
    return 0
  }

  // Very strict gate: allow trusted sources with moderate signal,
  // otherwise require stronger science keyword density.
  if (!trustedSource && score < 3) {
    return 0
  }

  return score
}

function filterScienceArticles(items, minScore = 3) {
  return (Array.isArray(items) ? items : []).filter((article) => scoreScienceRelevance(article) >= minScore)
}

function scoreCareerRelevance(article) {
  const text = normalize([
    article?.title,
    article?.description,
    article?.content
  ].filter(Boolean).join(" "))

  if (!text) {
    return 0
  }

  let score = 0
  for (const pattern of CAREER_PATTERNS) {
    if (pattern.test(text)) {
      score += 1
    }
  }

  return score
}

function filterCareerArticles(items, minScore = 2) {
  return (Array.isArray(items) ? items : []).filter((article) => scoreCareerRelevance(article) >= minScore)
}

function scoreTechRelevance(article) {
  const text = normalize([
    article?.title,
    article?.description,
    article?.content
  ].filter(Boolean).join(" "))

  if (!text) {
    return 0
  }

  let score = 0
  for (const pattern of TECH_PATTERNS) {
    if (pattern.test(text)) {
      score += 1
    }
  }

  return score
}

function filterTechArticles(items, minScore = 2) {
  return (Array.isArray(items) ? items : []).filter((article) => scoreTechRelevance(article) >= minScore)
}

function scoreEnvironmentRelevance(article) {
  const text = normalize([
    article?.title,
    article?.description,
    article?.content
  ].filter(Boolean).join(" "))

  if (!text) {
    return 0
  }

  let score = 0
  for (const pattern of ENVIRONMENT_PATTERNS) {
    if (pattern.test(text)) {
      score += 1
    }
  }

  return score
}

function filterEnvironmentArticles(items, minScore = 2) {
  return (Array.isArray(items) ? items : []).filter((article) => scoreEnvironmentRelevance(article) >= minScore)
}

module.exports = {
  filterScienceArticles,
  scoreScienceRelevance,
  filterCareerArticles,
  scoreCareerRelevance,
  filterTechArticles,
  scoreTechRelevance,
  filterEnvironmentArticles,
  scoreEnvironmentRelevance
}
