const fs = require("fs")
const path = require("path")

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8")

module.exports = (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.statusCode = 405
        res.end()
        return
    }

    res.statusCode = 200
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("Cache-Control", "no-store")
    res.setHeader("X-Robots-Tag", "noindex")
    res.end(req.method === "HEAD" ? "" : html)
}
