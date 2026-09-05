const { runBackup } = require("../src/backup")
const {
    uiConfigured,
    uiAuthorized,
    readBody,
    parseCredentials,
    sendJson
} = require("../src/http")

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: "method_not_allowed" })
        return
    }

    if (!uiConfigured()) {
        sendJson(res, 503, { ok: false, error: "ui_not_configured" })
        return
    }

    let credentials
    try {
        credentials = parseCredentials(req, await readBody(req))
    }
    catch {
        sendJson(res, 400, { ok: false, error: "bad_request" })
        return
    }

    if (!uiAuthorized(credentials.user, credentials.password)) {
        sendJson(res, 401, { ok: false, error: "unauthorized" })
        return
    }

    try {
        const result = await runBackup()
        sendJson(res, 200, {
            ok: true,
            createdAt: result.createdAt,
            database: result.database,
            collectionCount: result.collectionCount,
            fileName: result.fileName,
            fileId: result.fileId,
            keep: result.keep,
            deleted: result.deleted
        })
    }
    catch (error) {
        console.error(error)
        sendJson(res, 500, { ok: false, error: "backup_failed" })
    }
}
