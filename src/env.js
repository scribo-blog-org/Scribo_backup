const fs = require("fs")
const path = require("path")

function stripQuotes(value) {
    const trimmed = value.trim()
    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1)
    }
    return trimmed
}

function loadEnv() {
    const file = path.join(__dirname, "..", ".env")
    if (!fs.existsSync(file)) {
        return
    }

    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/)

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) {
            continue
        }

        const index = trimmed.indexOf("=")
        if (index <= 0) {
            continue
        }

        const key = trimmed.slice(0, index).trim()
        let value = trimmed.slice(index + 1)

        if (value.trim().startsWith("{") && !value.trim().endsWith("}")) {
            const chunks = [value]
            let depth = (value.match(/{/g) || []).length - (value.match(/}/g) || []).length

            while (depth > 0 && i + 1 < lines.length) {
                i += 1
                chunks.push(lines[i])
                depth += (lines[i].match(/{/g) || []).length
                depth -= (lines[i].match(/}/g) || []).length
            }

            value = chunks.join("\n")
        }

        if (process.env[key] === undefined) {
            let parsed = stripQuotes(value)
            if (parsed.startsWith(`${key}=`)) {
                parsed = parsed.slice(key.length + 1)
            }
            process.env[key] = parsed
        }
    }
}

function hasOAuth() {
    return Boolean(
        process.env.GOOGLE_OAUTH_CLIENT_ID &&
        process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
        process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    )
}

module.exports = {
    loadEnv,
    hasOAuth
}
