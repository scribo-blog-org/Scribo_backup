const { runBackup } = require("../src/backup")

function authorized(req) {
    const secret = process.env.CRON_SECRET
    if (!secret) {
        return false
    }

    const header = req.headers.authorization || ""
    return header === `Bearer ${secret}`
}

module.exports = async (req, res) => {
    if (req.method !== "GET" && req.method !== "POST") {
        res.statusCode = 405
        res.end()
        return
    }

    if (!authorized(req)) {
        res.statusCode = 401
        res.setHeader("Content-Type", "application/json")
        res.end(JSON.stringify({ ok: false }))
        return
    }

    try {
        const result = await runBackup()
        res.statusCode = 200
        res.setHeader("Content-Type", "application/json")
        res.end(JSON.stringify({ ok: true, ...result }))
    }
    catch (error) {
        console.error(error)
        res.statusCode = 500
        res.setHeader("Content-Type", "application/json")
        res.end(JSON.stringify({ ok: false }))
    }
}
