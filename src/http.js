const crypto = require("crypto")

function safeEqual(left, right) {
    const a = Buffer.from(String(left))
    const b = Buffer.from(String(right))
    const size = Math.max(a.length, b.length, 1)
    const padA = Buffer.alloc(size)
    const padB = Buffer.alloc(size)
    a.copy(padA)
    b.copy(padB)
    return crypto.timingSafeEqual(padA, padB) && a.length === b.length
}

function uiConfigured() {
    return Boolean(process.env.BACKUP_UI_USER && process.env.BACKUP_UI_PASSWORD)
}

function uiAuthorized(user, password) {
    if (!uiConfigured()) {
        return false
    }
    return safeEqual(user, process.env.BACKUP_UI_USER)
        && safeEqual(password, process.env.BACKUP_UI_PASSWORD)
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        req.on("data", (chunk) => chunks.push(chunk))
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
        req.on("error", reject)
    })
}

function parseCredentials(req, raw) {
    const type = String(req.headers["content-type"] || "")
    if (type.includes("application/json")) {
        const data = JSON.parse(raw || "{}")
        return {
            user: String(data.user || data.login || ""),
            password: String(data.password || "")
        }
    }
    const params = new URLSearchParams(raw)
    return {
        user: params.get("user") || params.get("login") || "",
        password: params.get("password") || ""
    }
}

function sendJson(res, status, body) {
    res.statusCode = status
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader("Cache-Control", "no-store")
    res.end(JSON.stringify(body))
}

module.exports = {
    uiConfigured,
    uiAuthorized,
    readBody,
    parseCredentials,
    sendJson
}