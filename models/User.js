const mongoose = require("mongoose")

const bookmarkSchema = new mongoose.Schema(
  {
    bookmarkKey: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    storyUrl: {
      type: String,
      trim: true
    },
    fallbackUrl: {
      type: String,
      default: "",
      trim: true
    },
    source: {
      type: String,
      default: "",
      trim: true
    },
    categoryLabel: {
      type: String,
      default: "",
      trim: true
    },
    bookmarkType: {
      type: String,
      default: "article",
      trim: true
    },
    image: {
      type: String,
      default: "",
      trim: true
    },
    summary: {
      type: String,
      default: "",
      trim: true
    },
    whyItMatters: {
      type: String,
      default: "",
      trim: true
    },
    keyPoints: {
      type: [String],
      default: []
    },
    relatedTopics: {
      type: [String],
      default: []
    },
    publishedAt: {
      type: String,
      default: "",
      trim: true
    },
    savedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
)

const archiveEntrySchema = new mongoose.Schema(
  {
    archiveKey: {
      type: String,
      required: true,
      trim: true
    },
    issueId: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      default: "",
      trim: true
    },
    subtitle: {
      type: String,
      default: "",
      trim: true
    },
    categoryKey: {
      type: String,
      default: "",
      trim: true
    },
    categoryLabel: {
      type: String,
      default: "",
      trim: true
    },
    heroImage: {
      type: String,
      default: "",
      trim: true
    },
    savedAt: {
      type: Date,
      default: Date.now
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  },
  {
    _id: false
  }
)

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    interests: {
      type: [String],
      default: [],
      set: (values) => Array.from(new Set((Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)))
    },
    bookmarks: {
      type: [bookmarkSchema],
      default: []
    },
    archivedIssues: {
      type: [archiveEntrySchema],
      default: []
    }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.model("User", userSchema)
