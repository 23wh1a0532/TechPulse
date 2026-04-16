const axios = require("axios")

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim()
}

function stripTags(text) {
  return String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

function getTagValue(block, tagName) {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i")
  const match = block.match(regex)
  return match ? decodeHtmlEntities(match[1]) : ""
}

function parseGoogleNewsTitle(title) {
  const cleaned = decodeHtmlEntities(title)
  const lastSeparator = cleaned.lastIndexOf(" - ")

  if (lastSeparator <= 0) {
    return { title: cleaned, source: "Google News" }
  }

  return {
    title: cleaned.slice(0, lastSeparator).trim(),
    source: cleaned.slice(lastSeparator + 3).trim() || "Google News"
  }
}

async function fetchRssArticles(url, limit = 5) {
  const response = await axios.get(url, { timeout: 15000 })
  const xml = String(response.data || "")

  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  const items = []
  let match

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const itemBlock = match[1]
    const rawTitle = getTagValue(itemBlock, "title")
    const parsed = parseGoogleNewsTitle(rawTitle)
    const link = getTagValue(itemBlock, "link")
    const description = stripTags(getTagValue(itemBlock, "description"))
    const publishedAt = getTagValue(itemBlock, "pubDate")

    if (!parsed.title && !description) {
      continue
    }

    items.push({
      title: parsed.title || "Untitled story",
      description: description || "Latest update from aggregated RSS coverage.",
      url: link,
      content: description,
      image: "",
      publishedAt,
      source: parsed.source || "Google News"
    })
  }

  return items
}

module.exports = {
  fetchRssArticles
}
