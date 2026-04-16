const ENTERTAINMENT_KEYWORDS = [
  "cinema",
  "movie",
  "movies",
  "film",
  "films",
  "box office",
  "hollywood",
  "bollywood",
  "tollywood",
  "kollywood",
  "sandalwood",
  "film actor",
  "film actress",
  "movie actor",
  "movie actress",
  "celebrity",
  "celeb",
  "trailer",
  "teaser",
  "web series",
  "series premiere",
  "season finale",
  "streaming release",
  "netflix",
  "prime video",
  "disney+",
  "hbo",
  "music video",
  "song launch",
  "album launch",
  "red carpet",
  "award show",
  "grammy",
  "oscar",
  "emmy",
  "cannes"
]

const RELATIONSHIP_KEYWORDS = [
  "dating",
  "dating app",
  "romance",
  "romantic",
  "love life",
  "relationship",
  "relationships",
  "couple",
  "couples",
  "matchmaking",
  "wedding",
  "engagement",
  "valentine",
  "tinder",
  "bumble",
  "hinge",
  "breakup"
]

const NOISE_KEYWORDS = [
  "odor",
  "odour",
  "smell",
  "fragrance",
  "perfume",
  "deodorant",
  "body spray",
  "beauty tips",
  "makeup tutorial",
  "viral gossip",
  "astrology",
  "horoscope"
]

function normalizeForPolicy(value) {
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

const BLOCKED_TOPIC_PATTERNS = [
  ...ENTERTAINMENT_KEYWORDS.map(toPattern),
  ...RELATIONSHIP_KEYWORDS.map(toPattern),
  ...NOISE_KEYWORDS.map(toPattern)
]

function isBlockedTopicRelated(article) {
  const merged = normalizeForPolicy([
    article?.title,
    article?.description,
    article?.content,
    article?.source
  ].filter(Boolean).join(" "))

  if (!merged) {
    return false
  }

  return BLOCKED_TOPIC_PATTERNS.some((pattern) => pattern.test(merged))
}

function isEntertainmentRelated(article) {
  return isBlockedTopicRelated(article)
}

function filterNonEntertainmentArticles(items) {
  return (Array.isArray(items) ? items : []).filter((item) => !isBlockedTopicRelated(item))
}

module.exports = {
  filterNonEntertainmentArticles,
  isEntertainmentRelated,
  isBlockedTopicRelated
}
