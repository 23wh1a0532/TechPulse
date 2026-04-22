const express = require("express")
const jwt = require("jsonwebtoken")

const techService = require("../services/techService")
const scienceService = require("../services/scienceService")
const environmentService = require("../services/environmentService")
const careerService = require("../services/careerService")
const { summarizeSingleArticleBrief } = require("../services/articleSummaryService")
const User = require("../models/User")
const simplify = require("../utils/simplify")
const { filterEnglishArticles } = require("../utils/languageFilter")
const { filterNonEntertainmentArticles } = require("../utils/contentPolicy")
const {
  filterScienceArticles,
  filterCareerArticles,
  filterTechArticles,
  filterEnvironmentArticles
} = require("../utils/relevanceFilter")
const createMagazineIssue = require("../services/magazineService")

const router = express.Router()
const INTEREST_KEYWORDS = {
  ai: ["ai", "artificial intelligence", "machine learning", "model", "llm", "inference", "automation"],
  cybersecurity: ["cybersecurity", "security", "breach", "zero-trust", "threat", "malware", "identity"],
  cloud: ["cloud", "infrastructure", "devops", "platform", "compute", "kubernetes", "observability"],
  startups: ["startup", "funding", "venture", "founder", "market", "product"],
  space: ["space", "nasa", "orbit", "lunar", "rocket", "astronomy", "satellite"],
  science: ["research", "clinical", "biology", "physics", "genomics", "science", "laboratory"],
  climate: ["climate", "renewable", "energy", "emissions", "sustainability", "drought", "grid"],
  careers: ["career", "hiring", "job", "skills", "workforce", "salary", "employment"]
}

function getUserFromRequest(req) {
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

function scoreArticleForInterests(article, interests = []) {
  if (!interests.length) {
    return 0
  }

  const text = String([
    article?.title,
    article?.description,
    article?.content,
    article?.source
  ].filter(Boolean).join(" ")).toLowerCase()

  return interests.reduce((score, interest) => {
    const keywords = INTEREST_KEYWORDS[interest] || []
    return score + keywords.reduce((keywordScore, keyword) => {
      return keywordScore + (text.includes(keyword) ? 2 : 0)
    }, 0)
  }, 0)
}

function personalizeArticles(items, interests = []) {
  return (Array.isArray(items) ? items : [])
    .map((article, index) => ({
      article,
      index,
      score: scoreArticleForInterests(article, interests)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.index - right.index
    })
    .map((entry) => entry.article)
}

const CATEGORY_CONFIG = {
  technology_innovation: {
    key: "technology_innovation",
    label: "Technology & Innovation",
    service: techService,
    minimum: 4,
    preprocess: (items) => items,
    refine: (items) => filterTechArticles(filterNonEntertainmentArticles(filterEnglishArticles(items)), 2)
  },
  science_research: {
    key: "science_research",
    label: "Science & Research",
    service: scienceService,
    minimum: 4,
    preprocess: (items) => items,
    refine: (items) => filterScienceArticles(filterNonEntertainmentArticles(filterEnglishArticles(items)), 3)
  },
  environment_global: {
    key: "environment_global",
    label: "Environment & Global",
    service: environmentService,
    minimum: 4,
    preprocess: (items) => dedupeByUrlOrTitle(items),
    refine: (items) => filterEnvironmentArticles(filterNonEntertainmentArticles(filterEnglishArticles(items)), 2)
  },
  careers_industry: {
    key: "careers_industry",
    label: "Careers & Industry",
    service: careerService,
    minimum: 4,
    preprocess: (items) => items,
    refine: (items) => filterCareerArticles(filterNonEntertainmentArticles(filterEnglishArticles(items)), 1)
  }
}

function buildCategoryFallback(label) {
  const now = new Date().toISOString()
  const fallbackMap = {
    "Technology & Innovation": [
      {
        title: "AI Infrastructure Spending Shifts Toward Efficiency",
        description: "Companies are rebalancing AI budgets toward inference optimization, model routing, and observability to reduce operating costs.",
        url: "",
        content: "Engineering teams are moving beyond initial experimentation and focusing on reliability, latency, and measurable business outcomes. The current shift emphasizes practical deployment patterns, faster iteration cycles, and model governance that supports long-term scale.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Cybersecurity Programs Expand Zero-Trust Controls",
        description: "Organizations are tightening identity checks, least-privilege access, and incident response readiness across cloud systems.",
        url: "",
        content: "Security leaders are combining identity-first architecture with stronger endpoint telemetry and continuous risk scoring. This improves resilience against credential misuse while helping teams respond faster to complex multi-stage attacks.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Chipmakers Push Specialized AI Hardware for Lower Energy Use",
        description: "Semiconductor vendors are prioritizing accelerators tuned for inference workloads and power efficiency.",
        url: "",
        content: "The shift reflects growing demand for AI systems that can run at scale without unsustainable energy costs. More specialized designs help cloud providers and enterprise teams improve throughput, reduce latency, and control infrastructure spending while still supporting increasingly complex model deployments.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Enterprise Cloud Teams Standardize AI Observability Practices",
        description: "Platform groups are adding monitoring, tracing, and evaluation layers around production AI systems.",
        url: "",
        content: "Companies want clearer visibility into model latency, reliability, and cost once AI moves into business-critical workflows. Better observability gives teams earlier warning when outputs drift or services slow down, helping them maintain trust while scaling AI features across products.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Enterprise Software Buyers Prioritize Trusted AI Governance",
        description: "Companies are scrutinizing model governance, procurement rules, and audit trails before approving new AI tools.",
        url: "",
        content: "Legal, security, and platform teams are becoming more involved in AI purchasing decisions as organizations move from pilots to broad deployment. Governance features now influence buying cycles because enterprises want clearer controls over data handling, policy enforcement, and accountability before AI becomes embedded in business-critical processes.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Developer Platforms Add More Automation Around Release Quality",
        description: "Engineering organizations are strengthening CI, testing, and rollout automation to reduce production risk.",
        url: "",
        content: "Teams are investing in release pipelines that catch failures earlier and shorten recovery time when incidents occur. The move matters because dependable automation improves engineering velocity without sacrificing service quality, especially as software stacks become more distributed and AI-assisted development increases code volume.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Edge AI Projects Expand in Retail and Manufacturing",
        description: "Businesses are deploying smaller models closer to devices to improve response speed and data control.",
        url: "",
        content: "Edge deployments help organizations process operational data without always sending it back to centralized cloud services. This is especially useful in environments where latency, connectivity, or privacy constraints make local decision-making more valuable than heavyweight centralized inference.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Product Teams Reframe Generative AI Around Workflow Gains",
        description: "Companies are focusing on measurable productivity improvements instead of broad AI claims.",
        url: "",
        content: "Leaders increasingly want product roadmaps that connect AI features to specific workflow bottlenecks, time savings, and customer outcomes. That shift is pushing teams to define narrower use cases, stronger feedback loops, and clearer success metrics before scaling generative tools across organizations.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      }
    ],
    "Science & Research": [
      {
        title: "Precision Medicine Trials Advance Biomarker Use",
        description: "Clinical teams are using more specific biomarkers to match therapies with patient subgroups and improve treatment targeting.",
        url: "",
        content: "Researchers are refining trial design so outcomes can be interpreted faster and with greater confidence. This approach can reduce unnecessary treatment cycles while helping clinicians identify which interventions are most effective for specific populations.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Space Observation Programs Improve Early Hazard Detection",
        description: "New analysis pipelines are helping teams detect and classify near-Earth objects with better consistency.",
        url: "",
        content: "Research organizations are integrating telescope networks with improved data filtering to prioritize high-value observations. The result is more timely risk assessment and stronger collaboration between monitoring centers and mission planning teams.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Laboratories Expand Use of AI to Speed Protein Analysis",
        description: "Research teams are using AI-assisted modeling to shorten analysis cycles in biology and drug discovery.",
        url: "",
        content: "Scientists are combining computational prediction with lab validation to identify promising biological structures faster. This matters because it reduces early-stage research bottlenecks and allows teams to focus resources on the experiments most likely to produce meaningful therapeutic or diagnostic advances.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Climate Science Programs Improve Extreme Weather Attribution",
        description: "Researchers are refining models that link specific extreme events to broader climate patterns.",
        url: "",
        content: "Improved attribution methods help policymakers and emergency planners understand how warming trends influence floods, heat waves, and storms. That creates more practical evidence for resilience planning, infrastructure investment, and faster public communication around climate risks.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Marine Research Networks Improve Ocean Health Tracking",
        description: "Scientists are linking sensors, field studies, and satellite data to monitor ecosystem change with greater consistency.",
        url: "",
        content: "More connected observation systems help researchers detect shifts in temperature, biodiversity, and pollution stress earlier. This matters because better measurements support stronger conservation decisions, more targeted interventions, and quicker identification of environmental pressures that affect coastal communities and marine industries.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Materials Science Teams Advance Safer Battery Chemistries",
        description: "Researchers are refining battery materials to improve stability, longevity, and supply resilience.",
        url: "",
        content: "New chemistry work is aimed at reducing fire risk, lowering dependence on constrained raw materials, and improving overall performance under demanding conditions. Progress here could influence electric mobility, grid storage, and broader energy infrastructure by making advanced batteries more practical and scalable.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Public Health Research Expands Wastewater Surveillance Programs",
        description: "Monitoring systems are being used to track disease activity and emerging health risks at community scale.",
        url: "",
        content: "Wastewater analysis offers a fast, population-level signal that can complement clinical reporting and help officials identify trends earlier. As surveillance methods improve, public health teams can respond more quickly to outbreaks while gaining stronger insight into how health conditions move through different regions.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Astronomy Teams Improve Data Pipelines for Deep-Sky Discovery",
        description: "Observatories are upgrading analysis systems to process larger imaging datasets and flag unusual signals faster.",
        url: "",
        content: "As telescope output grows, better pipelines are becoming essential for separating important events from background noise. Faster classification and prioritization help researchers focus observation time where it matters most and accelerate follow-up studies of rare or potentially significant phenomena.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      }
    ],
    "Environment & Global": [
      {
        title: "Grid Modernization Projects Accelerate Storage Deployment",
        description: "Utilities are expanding battery-backed grid upgrades to manage peak demand and renewable intermittency.",
        url: "",
        content: "Planners are combining energy storage with forecasting tools and automated balancing controls. These upgrades improve reliability during high-load windows and help stabilize power delivery as renewable adoption increases.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Climate Adaptation Programs Prioritize Urban Heat Mitigation",
        description: "Cities are scaling cooling corridors, reflective materials, and water-sensitive planning for vulnerable zones.",
        url: "",
        content: "Municipal teams are prioritizing practical interventions that can be deployed quickly while still supporting long-term resilience. The strategy combines infrastructure retrofits with data-driven planning to reduce public health risk and protect critical services.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Regional Water Networks Expand Real-Time Drought Monitoring",
        description: "Authorities are increasing sensor coverage and predictive analytics to track water stress earlier.",
        url: "",
        content: "Earlier drought detection allows utilities and local governments to manage supplies more carefully before shortages become severe. Better monitoring supports long-term planning, helps protect agriculture and public services, and improves coordination across regions facing changing rainfall patterns.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Industrial Decarbonization Plans Focus on Practical Emissions Cuts",
        description: "Manufacturers are prioritizing cleaner heat, electrification, and process redesign to lower emissions.",
        url: "",
        content: "Many sectors are shifting from high-level climate commitments to specific operational upgrades that reduce carbon intensity. The approach matters because measurable industrial cuts can improve competitiveness, meet regulatory pressure, and support national climate targets without relying only on long-term future technologies.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Coastal Resilience Plans Expand Nature-Based Flood Protection",
        description: "Regions are investing in wetlands, mangroves, and shoreline restoration to reduce storm damage.",
        url: "",
        content: "Nature-based defenses are gaining traction because they can reduce flood risk while improving ecosystems and long-term maintenance costs. Combined with engineered infrastructure, these projects help communities build more adaptable protection against stronger storms and rising sea levels.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Supply Chains Face New Pressure to Measure Scope 3 Emissions",
        description: "Companies are increasing scrutiny of supplier data as climate disclosure expectations grow.",
        url: "",
        content: "Many organizations now need better visibility into upstream and downstream emissions to satisfy reporting needs and investor pressure. That challenge is pushing more collaboration across procurement, operations, and data teams so companies can track climate impact with greater accuracy and credibility.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Agriculture Programs Scale Precision Irrigation to Save Water",
        description: "Farm operators are using sensors and predictive tools to apply water more efficiently across stressed regions.",
        url: "",
        content: "Precision irrigation can lower waste, protect yields, and help farmers respond to more volatile weather patterns. These systems matter because they connect sustainability goals with practical resource management at a time when food production and water security are under growing pressure.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Cities Increase Air Quality Monitoring Around Dense Transport Corridors",
        description: "Urban authorities are adding more localized pollution tracking near high-traffic and industrial areas.",
        url: "",
        content: "More detailed air data helps officials identify exposure hotspots and prioritize interventions where public health impacts are greatest. Better monitoring also gives communities stronger evidence for infrastructure planning, transport policy, and environmental enforcement decisions.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      }
    ],
    "Careers & Industry": [
      {
        title: "Hiring Trends Favor Engineers With Applied AI Delivery Skills",
        description: "Employers are prioritizing candidates who can integrate AI features into real products and workflows.",
        url: "",
        content: "Teams are looking for professionals who can bridge model capability with business metrics, reliability, and user adoption. Practical delivery experience, system thinking, and automation fluency remain strong signals in competitive hiring pipelines.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Technical Roles Emphasize Platform Reliability and Automation",
        description: "Companies continue to value engineers who can streamline deployments, observability, and incident readiness.",
        url: "",
        content: "As platforms grow more complex, organizations are rewarding roles that reduce operational friction and improve service quality. Cross-functional execution, documentation discipline, and dependable release practices are becoming key career accelerators.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Product Teams Value Engineers Who Can Ship AI Features Reliably",
        description: "Hiring managers are looking for candidates who can move AI ideas into stable user-facing products.",
        url: "",
        content: "The emphasis is shifting from theoretical AI familiarity to practical execution across testing, monitoring, integration, and iteration. Employers want people who understand how model behavior affects user experience, operations, and measurable business outcomes in production environments.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Data and Automation Skills Continue to Strengthen Career Mobility",
        description: "Professionals with analytics, workflow automation, and systems thinking remain attractive across teams.",
        url: "",
        content: "These skills matter because companies want employees who can reduce manual effort, improve decisions, and connect technical work to business performance. Candidates with cross-functional communication and automation experience are better positioned for growth in changing hiring markets.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Managers Increase Demand for Cross-Functional Product Operators",
        description: "Organizations want professionals who can align engineering, design, and business execution around delivery goals.",
        url: "",
        content: "Cross-functional operators are becoming more valuable because teams need people who can translate between strategy and implementation without creating friction. The role is growing in importance as companies expect faster execution, tighter prioritization, and clearer links between technical work and customer outcomes.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Employers Put More Weight on Portfolio Evidence Than Abstract Claims",
        description: "Candidates are standing out by showing shipped work, measurable outcomes, and clear ownership stories.",
        url: "",
        content: "Hiring teams increasingly prefer concrete examples over broad descriptions of skills because they reveal how a candidate thinks and executes. Strong project evidence helps employers assess reliability, communication, and decision-making in ways that résumés alone often cannot capture.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Workplace Learning Shifts Toward Embedded Skill Building on the Job",
        description: "Companies are favoring training tied directly to live workflows, tools, and role expectations.",
        url: "",
        content: "Embedded learning models are proving more useful than isolated training because they connect new skills to day-to-day delivery. For employees, that means stronger retention and more visible impact. For employers, it can shorten ramp-up time and improve adaptation as tools and responsibilities change.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      },
      {
        title: "Data Literacy Remains a Career Multiplier Across Business Functions",
        description: "People who can interpret metrics and make evidence-based decisions continue to gain advantage across teams.",
        url: "",
        content: "Data literacy now matters well beyond analytics roles because modern work increasingly depends on dashboards, experimentation, and operational insight. Professionals who can turn numbers into decisions are better positioned to influence strategy, communicate clearly, and adapt to changing expectations.",
        image: "",
        publishedAt: now,
        source: "TechPulse Editorial"
      }
    ]
  }

  return fallbackMap[label] || []
}

function ensureMinimumArticles(label, items, minimum = 4) {
  const list = dedupeByUrlOrTitle(Array.isArray(items) ? items : [])
  if (list.length >= minimum) {
    return list.slice(0, minimum)
  }

  const fallback = buildCategoryFallback(label)
  for (const article of fallback) {
    if (list.length >= minimum) {
      break
    }

    const candidateKey = String(article?.url || article?.storyUrl || "").trim().toLowerCase()
      || String(article?.title || "").trim().toLowerCase()
    const alreadyIncluded = list.some((existing) => {
      const existingKey = String(existing?.url || existing?.storyUrl || "").trim().toLowerCase()
        || String(existing?.title || "").trim().toLowerCase()
      return candidateKey && existingKey === candidateKey
    })

    if (!candidateKey || alreadyIncluded) {
      continue
    }

    list.push(article)
  }

  return list
}

async function fetchSafe(label, fn) {
  try {
    const result = await fn()
    return Array.isArray(result) ? result : []
  } catch (error) {
    console.error(`${label} fetch failed:`, error.response?.data || error.message)
    return []
  }
}

function dedupeByUrlOrTitle(items) {
  const seen = new Set()
  const output = []

  for (const item of Array.isArray(items) ? items : []) {
    const urlKey = String(item?.url || item?.storyUrl || "").trim().toLowerCase()
    const titleKey = String(item?.title || "").trim().toLowerCase()
    const key = urlKey || titleKey

    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    output.push(item)
  }

  return output
}

function buildArchiveEntry(issue, categoryPayload, personalization, selectedConfig = null) {
  const dateKey = new Date().toISOString().slice(0, 10)
  const categoryKey = selectedConfig?.key || "all"
  const categoryLabel = selectedConfig?.label || "All Magazine"
  const archiveKey = `${dateKey}:${categoryKey}`

  return {
    archiveKey,
    issueId: archiveKey,
    title: issue?.cover?.title || "TechPulse Weekly",
    subtitle: issue?.cover?.subtitle || "",
    categoryKey,
    categoryLabel,
    heroImage: issue?.cover?.heroImage || "",
    savedAt: new Date(),
    snapshot: {
      issue,
      personalization,
      ...categoryPayload
    }
  }
}

function mergeArticleForSummary(sourceArticle, requestArticle = {}) {
  return {
    ...sourceArticle,
    ...requestArticle,
    title: String(requestArticle?.title || sourceArticle?.title || "").trim(),
    description: String(requestArticle?.description || sourceArticle?.description || "").trim(),
    content: String(requestArticle?.content || sourceArticle?.content || requestArticle?.summary || "").trim(),
    source: String(requestArticle?.source || sourceArticle?.source || "").trim(),
    image: requestArticle?.image || sourceArticle?.image || "",
    publishedAt: requestArticle?.publishedAt || sourceArticle?.publishedAt || "",
    url: String(
      requestArticle?.storyUrl
      || requestArticle?.url
      || requestArticle?.link
      || sourceArticle?.url
      || sourceArticle?.storyUrl
      || sourceArticle?.link
      || ""
    ).trim()
  }
}

router.post("/article-brief", async (req, res) => {
  try {
    const authUser = getUserFromRequest(req)
    if (!authUser?.userId) {
      return res.status(401).json({ error: "Authentication is required." })
    }

    const user = await User.findById(authUser.userId)
    const userInterests = Array.isArray(user?.interests) ? user.interests : []
    const requestArticle = req.body?.article
    const categoryKey = String(req.body?.categoryKey || "").trim().toLowerCase()
    const categoryLabel = String(req.body?.categoryLabel || "").trim()

    if (!requestArticle || typeof requestArticle !== "object") {
      return res.status(400).json({ error: "An article payload is required." })
    }

    const config = categoryKey ? CATEGORY_CONFIG[categoryKey] : null
    const articleForBrief = mergeArticleForSummary({}, requestArticle)
    const effectiveCategoryKey = config?.key || categoryKey || "article_brief"
    const effectiveCategoryLabel = config?.label || categoryLabel || "Article"

    const brief = await summarizeSingleArticleBrief(articleForBrief, effectiveCategoryKey, {
      categoryLabel: effectiveCategoryLabel,
      profile: {
        interests: userInterests,
        readerName: user?.name || ""
      }
    })

    res.json({
      brief,
      article: {
        title: articleForBrief.title || requestArticle.title || "",
        source: articleForBrief.source || requestArticle.source || "",
        publishedAt: articleForBrief.publishedAt || requestArticle.publishedAt || "",
        storyUrl: articleForBrief.url || requestArticle.storyUrl || requestArticle.url || "",
        image: articleForBrief.image || requestArticle.image || ""
      }
    })
  } catch (error) {
    console.error("Single-article brief generation failed:", error.response?.data || error.message)
    res.status(500).json({ error: "Could not generate the AI brief for this article." })
  }
})

router.get("/", async (req, res) => {

  try {
    const authUser = getUserFromRequest(req)
    const user = authUser?.userId ? await User.findById(authUser.userId) : null
    const userInterests = Array.isArray(user?.interests) ? user.interests : []
    const requestedCategory = String(req.query.category || "").trim().toLowerCase()
    const selectedConfig = requestedCategory ? CATEGORY_CONFIG[requestedCategory] : null

    if (requestedCategory && !selectedConfig) {
      return res.status(400).json({ error: "Unknown category requested." })
    }

    const configs = selectedConfig
      ? [selectedConfig]
      : [
        CATEGORY_CONFIG.technology_innovation,
        CATEGORY_CONFIG.science_research,
        CATEGORY_CONFIG.environment_global,
        CATEGORY_CONFIG.careers_industry
      ]

    const categoryResults = []

    for (const config of configs) {
      const raw = await fetchSafe(config.label, config.service)
      const prepared = config.preprocess(raw)
      const refined = config.refine(prepared)
      const targetMinimum = Math.max(8, config.minimum)
      const rankedArticles = personalizeArticles(refined, userInterests).slice(0, targetMinimum)
      const finalArticles = ensureMinimumArticles(
        config.label,
        rankedArticles,
        targetMinimum
      )

      categoryResults.push({
        key: config.key,
        label: config.label,
        items: finalArticles,
        maxStories: targetMinimum,
        simplified: finalArticles.map((article) => simplify(article, config.key))
      })
    }

    const issue = await createMagazineIssue(categoryResults.map((result) => ({
      key: result.key,
      label: result.label,
      items: Object.assign(result.items.slice(), { maxStories: result.maxStories }),
      summarizedItems: result.simplified
    })), {
      interests: userInterests,
      readerName: user?.name || "",
      focusedCategory: selectedConfig?.label || ""
    })

    const categoryPayload = Object.fromEntries(categoryResults.map((result) => [result.key, result.simplified]))
    const personalization = {
      interests: userInterests,
      category: selectedConfig?.key || ""
    }

    res.json({
      issue,
      personalization,
      ...categoryPayload
    })

  } catch (error) {

    res.status(500).json({ error: error.message })

  }

})

module.exports = router
