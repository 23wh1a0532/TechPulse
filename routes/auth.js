const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

const User = require("../models/User")

const router = express.Router()
const ALLOWED_INTERESTS = new Set([
  "ai",
  "cybersecurity",
  "cloud",
  "startups",
  "space",
  "science",
  "climate",
  "careers"
])

function normalizeInterests(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter((value) => ALLOWED_INTERESTS.has(value))))
}

function normalizeBookmark(input) {
  const title = String(input?.title || input?.source || input?.categoryLabel || "Saved article").trim()

  const storyUrl = String(input?.storyUrl || input?.url || "").trim()
  const fallbackUrl = String(input?.fallbackUrl || "").trim()
  const bookmarkKey = String(input?.bookmarkKey || storyUrl || fallbackUrl || title.toLowerCase()).trim()
  if (!bookmarkKey) {
    return null
  }

  return {
    bookmarkKey,
    title,
    storyUrl,
    fallbackUrl,
    source: String(input?.source || "").trim(),
    categoryLabel: String(input?.categoryLabel || "").trim(),
    image: String(input?.image || "").trim(),
    summary: String(input?.summary || "").replace(/\s+/g, " ").trim(),
    publishedAt: String(input?.publishedAt || "").trim(),
    savedAt: new Date()
  }
}

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    interests: user.interests || [],
    bookmarks: Array.isArray(user.bookmarks) ? user.bookmarks : []
  }
}

function normalizeStoredBookmarks(items) {
  const seen = new Set()
  const output = []

  for (const item of Array.isArray(items) ? items : []) {
    const normalized = normalizeBookmark(item)
    if (!normalized) {
      continue
    }

    const key = String(normalized.bookmarkKey || "").trim()
    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    output.push({
      ...normalized,
      savedAt: item?.savedAt || normalized.savedAt
    })
  }

  return output
}

function normalizeArchiveEntry(item) {
  const archiveKey = String(item?.archiveKey || item?.issueId || "").trim()
  const issueId = String(item?.issueId || archiveKey || "").trim()
  const snapshot = item?.snapshot

  if (!archiveKey || !issueId || !snapshot || typeof snapshot !== "object") {
    return null
  }

  return {
    archiveKey,
    issueId,
    title: String(item?.title || snapshot?.issue?.cover?.title || "TechPulse Issue").trim(),
    subtitle: String(item?.subtitle || snapshot?.issue?.cover?.subtitle || "").trim(),
    categoryKey: String(item?.categoryKey || snapshot?.personalization?.category || "").trim(),
    categoryLabel: String(item?.categoryLabel || "").trim(),
    heroImage: String(item?.heroImage || snapshot?.issue?.cover?.heroImage || "").trim(),
    savedAt: item?.savedAt || new Date(),
    snapshot
  }
}

function buildArchiveEntryFromPayload(payload) {
  const snapshot = payload?.snapshot
  if (!snapshot || typeof snapshot !== "object" || !snapshot.issue || typeof snapshot.issue !== "object") {
    return null
  }

  const categoryKey = String(payload?.categoryKey || snapshot?.personalization?.category || "all").trim() || "all"
  const savedAt = new Date()
  const dateKey = savedAt.toISOString().slice(0, 10)
  const archiveKey = `${dateKey}:${categoryKey}`

  return normalizeArchiveEntry({
    archiveKey,
    issueId: archiveKey,
    title: payload?.title || snapshot?.issue?.cover?.title || "TechPulse Weekly",
    subtitle: payload?.subtitle || snapshot?.issue?.cover?.subtitle || "",
    categoryKey,
    categoryLabel: payload?.categoryLabel || "",
    heroImage: payload?.heroImage || snapshot?.issue?.cover?.heroImage || "",
    savedAt,
    snapshot
  })
}

function normalizeStoredArchives(items) {
  const seen = new Set()
  const output = []

  for (const item of Array.isArray(items) ? items : []) {
    const normalized = normalizeArchiveEntry(item)
    if (!normalized) {
      continue
    }

    const key = String(normalized.archiveKey || "").trim()
    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    output.push(normalized)
  }

  return output.sort((left, right) => new Date(right.savedAt) - new Date(left.savedAt))
}

function createToken(user) {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error("JWT_SECRET is missing. Add it to backend/.env before using auth.")
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email
    },
    secret,
    {
      expiresIn: "7d"
    }
  )
}

function getAuthUser(req) {
  const header = String(req.headers.authorization || "")
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  const secret = process.env.JWT_SECRET

  if (!token || !secret) {
    return null
  }

  try {
    return jwt.verify(token, secret)
  } catch (error) {
    return null
  }
}

async function requireAuth(req, res, next) {
  const authUser = getAuthUser(req)

  if (!authUser?.userId) {
    return res.status(401).json({ error: "Authentication required." })
  }

  const user = await User.findById(authUser.userId)
  if (!user) {
    return res.status(401).json({ error: "User not found." })
  }

  req.user = user
  next()
}

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, interests } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const existingUser = await User.findOne({ email: normalizedEmail })

    if (existingUser) {
      return res.status(409).json({ error: "An account with that email already exists." })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const normalizedInterests = normalizeInterests(interests)
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      interests: normalizedInterests
    })

    const token = createToken(user)

    return res.status(201).json({
      message: "Account created successfully.",
      token,
      user: serializeUser(user)
    })
  } catch (error) {
    console.error("Signup failed:", error.message)
    return res.status(500).json({ error: "Signup failed. Please try again." })
  }
})

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const user = await User.findOne({ email: normalizedEmail })

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." })
    }

    const passwordMatches = await bcrypt.compare(password, user.password)

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." })
    }

    const token = createToken(user)

    return res.json({
      message: "Login successful.",
      token,
      user: serializeUser(user)
    })
  } catch (error) {
    console.error("Login failed:", error.message)
    return res.status(500).json({ error: "Login failed. Please try again." })
  }
})

router.get("/profile", requireAuth, async (req, res) => {
  req.user.bookmarks = normalizeStoredBookmarks(req.user.bookmarks)
  req.user.archivedIssues = normalizeStoredArchives(req.user.archivedIssues)
  return res.json({
    user: serializeUser(req.user)
  })
})

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const interests = normalizeInterests(req.body?.interests)
    req.user.interests = interests
    await req.user.save()

    return res.json({
      message: "Profile updated successfully.",
      user: serializeUser(req.user)
    })
  } catch (error) {
    console.error("Profile update failed:", error.message)
    return res.status(500).json({ error: "Profile update failed. Please try again." })
  }
})

router.get("/bookmarks", requireAuth, async (req, res) => {
  req.user.bookmarks = normalizeStoredBookmarks(req.user.bookmarks)
  return res.json({
    bookmarks: Array.isArray(req.user.bookmarks) ? req.user.bookmarks : []
  })
})

router.get("/archives", requireAuth, async (req, res) => {
  req.user.bookmarks = normalizeStoredBookmarks(req.user.bookmarks)
  req.user.archivedIssues = normalizeStoredArchives(req.user.archivedIssues)

  return res.json({
    archives: (req.user.archivedIssues || []).map((entry) => ({
      archiveKey: entry.archiveKey,
      issueId: entry.issueId,
      title: entry.title,
      subtitle: entry.subtitle,
      categoryKey: entry.categoryKey,
      categoryLabel: entry.categoryLabel,
      heroImage: entry.heroImage,
      savedAt: entry.savedAt
    }))
  })
})

router.get("/archives/:archiveKey", requireAuth, async (req, res) => {
  req.user.bookmarks = normalizeStoredBookmarks(req.user.bookmarks)
  req.user.archivedIssues = normalizeStoredArchives(req.user.archivedIssues)
  const archiveKey = String(req.params.archiveKey || "").trim()
  const archive = (req.user.archivedIssues || []).find((entry) => entry.archiveKey === archiveKey)

  if (!archive) {
    return res.status(404).json({ error: "Archived issue not found." })
  }

  return res.json(archive.snapshot)
})

router.delete("/archives/:archiveKey", requireAuth, async (req, res) => {
  try {
    req.user.bookmarks = normalizeStoredBookmarks(req.user.bookmarks)
    req.user.archivedIssues = normalizeStoredArchives(req.user.archivedIssues)
    const archiveKey = String(req.params.archiveKey || "").trim()

    if (!archiveKey) {
      return res.status(400).json({ error: "An archive key is required to delete an archived issue." })
    }

    req.user.archivedIssues = (req.user.archivedIssues || []).filter((entry) => entry?.archiveKey !== archiveKey)
    await req.user.save()

    return res.json({
      message: "Archived issue deleted.",
      archives: req.user.archivedIssues.map((entry) => ({
        archiveKey: entry.archiveKey,
        issueId: entry.issueId,
        title: entry.title,
        subtitle: entry.subtitle,
        categoryKey: entry.categoryKey,
        categoryLabel: entry.categoryLabel,
        heroImage: entry.heroImage,
        savedAt: entry.savedAt
      }))
    })
  } catch (error) {
    console.error("Archive deletion failed:", error.message)
    return res.status(500).json({ error: "Could not delete archived issue." })
  }
})

router.post("/archives", requireAuth, async (req, res) => {
  try {
    req.user.bookmarks = normalizeStoredBookmarks(req.user.bookmarks)
    req.user.archivedIssues = normalizeStoredArchives(req.user.archivedIssues)
    const archiveEntry = buildArchiveEntryFromPayload(req.body)

    if (!archiveEntry) {
      return res.status(400).json({ error: "The issue snapshot was incomplete." })
    }

    const existingArchives = Array.isArray(req.user.archivedIssues)
      ? req.user.archivedIssues.filter((entry) => entry?.archiveKey !== archiveEntry.archiveKey)
      : []

    req.user.archivedIssues = [archiveEntry, ...existingArchives].slice(0, 30)
    await req.user.save()

    return res.status(201).json({
      message: "Issue archived.",
      archive: {
        archiveKey: archiveEntry.archiveKey,
        issueId: archiveEntry.issueId,
        title: archiveEntry.title,
        subtitle: archiveEntry.subtitle,
        categoryKey: archiveEntry.categoryKey,
        categoryLabel: archiveEntry.categoryLabel,
        heroImage: archiveEntry.heroImage,
        savedAt: archiveEntry.savedAt
      },
      archives: req.user.archivedIssues.map((entry) => ({
        archiveKey: entry.archiveKey,
        issueId: entry.issueId,
        title: entry.title,
        subtitle: entry.subtitle,
        categoryKey: entry.categoryKey,
        categoryLabel: entry.categoryLabel,
        heroImage: entry.heroImage,
        savedAt: entry.savedAt
      }))
    })
  } catch (error) {
    console.error("Issue archive save failed:", error.message)
    return res.status(500).json({ error: "Could not archive the issue." })
  }
})

router.post("/bookmarks", requireAuth, async (req, res) => {
  try {
    req.user.bookmarks = normalizeStoredBookmarks(req.user.bookmarks)
    const bookmark = normalizeBookmark(req.body)
    if (!bookmark) {
      return res.status(400).json({ error: "The bookmark details were incomplete." })
    }

    const existing = (req.user.bookmarks || []).find((item) => String(item.bookmarkKey || "").trim() === bookmark.bookmarkKey)
    if (existing) {
      return res.json({
        message: "Bookmark already saved.",
        bookmarks: req.user.bookmarks || []
      })
    }

    req.user.bookmarks = [bookmark, ...(req.user.bookmarks || [])].slice(0, 100)
    await req.user.save()

    return res.status(201).json({
      message: "Bookmark saved.",
      bookmarks: req.user.bookmarks || []
    })
  } catch (error) {
    console.error("Bookmark save failed:", error.message)
    return res.status(500).json({ error: "Could not save bookmark." })
  }
})

router.delete("/bookmarks", requireAuth, async (req, res) => {
  try {
    req.user.bookmarks = normalizeStoredBookmarks(req.user.bookmarks)
    const bookmarkKey = String(req.body?.bookmarkKey || req.query?.bookmarkKey || req.body?.storyUrl || req.query?.storyUrl || "").trim()
    if (!bookmarkKey) {
      return res.status(400).json({ error: "A bookmark key is required to remove a bookmark." })
    }

    req.user.bookmarks = (req.user.bookmarks || []).filter((item) => {
      return String(item.bookmarkKey || "").trim() !== bookmarkKey
    })
    await req.user.save()

    return res.json({
      message: "Bookmark removed.",
      bookmarks: req.user.bookmarks || []
    })
  } catch (error) {
    console.error("Bookmark removal failed:", error.message)
    return res.status(500).json({ error: "Could not remove bookmark." })
  }
})

module.exports = router
