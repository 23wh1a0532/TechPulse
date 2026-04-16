const ENGLISH_HINT_WORDS = new Set([
  "the",
  "and",
  "of",
  "to",
  "in",
  "for",
  "on",
  "with",
  "from",
  "by",
  "is",
  "are",
  "as",
  "at",
  "be",
  "this",
  "that",
  "it",
  "an",
  "or"
])

function getLetterStats(text) {
  const value = String(text || "")
  const allLetters = value.match(/\p{L}/gu) || []
  const latinLetters = value.match(/[A-Za-z]/g) || []

  return {
    totalLetters: allLetters.length,
    latinLetters: latinLetters.length
  }
}

function hasEnglishHints(text) {
  const words = String(text || "").toLowerCase().match(/[a-z']+/g) || []
  if (!words.length) {
    return false
  }

  let hintCount = 0
  for (const word of words) {
    if (ENGLISH_HINT_WORDS.has(word)) {
      hintCount += 1
      if (hintCount >= 2) {
        return true
      }
    }
  }

  return false
}

function isLikelyEnglishArticle(article) {
  const text = [
    article?.title,
    article?.description,
    article?.content
  ].filter(Boolean).join(" ").trim()

  if (!text) {
    return false
  }

  const { totalLetters, latinLetters } = getLetterStats(text)
  if (!totalLetters) {
    return false
  }

  if (latinLetters !== totalLetters) {
    return false
  }

  return hasEnglishHints(text)
}

function filterEnglishArticles(items) {
  return (Array.isArray(items) ? items : []).filter(isLikelyEnglishArticle)
}

module.exports = {
  filterEnglishArticles,
  isLikelyEnglishArticle
}
