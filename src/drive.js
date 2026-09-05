const { Readable } = require("stream")
const { google } = require("googleapis")
const { hasOAuth } = require("./env")

const FOLDER_MIME = "application/vnd.google-apps.folder"
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut"
const DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive"]

function serviceAccountCredentials() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!raw) {
        return null
    }

    const parsed = JSON.parse(raw)
    if (typeof parsed.private_key === "string") {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n")
    }

    return parsed
}

function createAuth() {
    if (hasOAuth()) {
        const oauth2 = new google.auth.OAuth2(
            process.env.GOOGLE_OAUTH_CLIENT_ID,
            process.env.GOOGLE_OAUTH_CLIENT_SECRET
        )
        oauth2.setCredentials({
            refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN
        })
        return oauth2
    }

    const parsed = serviceAccountCredentials()
    if (!parsed) {
        throw new Error("Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REFRESH_TOKEN. Run npm run drive-auth")
    }

    return new google.auth.GoogleAuth({
        credentials: parsed,
        scopes: DRIVE_SCOPE.concat("https://www.googleapis.com/auth/drive")
    })
}

function driveClient() {
    return google.drive({ version: "v3", auth: createAuth() })
}

function folderId() {
    const id = String(process.env.GOOGLE_DRIVE_FOLDER_ID || "").trim()
    if (!id) {
        throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing")
    }
    return id
}

async function resolveFolderId() {
    const drive = driveClient()
    const id = folderId()

    try {
        const response = await drive.files.get({
            fileId: id,
            fields: "id,name,mimeType,shortcutDetails",
            supportsAllDrives: true
        })

        if (response.data.mimeType === SHORTCUT_MIME) {
            return response.data.shortcutDetails.targetId
        }

        if (response.data.mimeType !== FOLDER_MIME) {
            throw new Error("GOOGLE_DRIVE_FOLDER_ID points to a file, not a folder")
        }

        return response.data.id
    }
    catch (error) {
        if (error.code === 404 || /File not found/i.test(error.message)) {
            throw new Error("Drive folder not found. Sign in with the Google account that owns the folder (npm run drive-auth).")
        }
        throw error
    }
}

async function uploadBackup({ fileName, buffer, createdAt }) {
    const drive = driveClient()
    const parent = await resolveFolderId()

    const response = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [parent],
            description: `Scribo MongoDB backup ${createdAt}`
        },
        media: {
            mimeType: "application/gzip",
            body: Readable.from(buffer)
        },
        fields: "id,name,createdTime",
        supportsAllDrives: true
    })

    return response.data
}

async function listBackups() {
    const drive = driveClient()
    const parent = await resolveFolderId()
    const prefix = process.env.BACKUP_PREFIX || "scribo-backup-"
    const files = []
    let pageToken

    do {
        const response = await drive.files.list({
            q: `'${parent}' in parents and name contains '${prefix}' and trashed = false`,
            fields: "nextPageToken, files(id, name, createdTime)",
            orderBy: "createdTime",
            pageSize: 100,
            pageToken,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        })

        files.push(...(response.data.files || []))
        pageToken = response.data.nextPageToken
    } while (pageToken)

    return files.sort((a, b) => String(a.createdTime).localeCompare(String(b.createdTime)))
}

async function deleteFile(id) {
    const drive = driveClient()
    await drive.files.delete({
        fileId: id,
        supportsAllDrives: true
    })
}

const WEEK_MS = 6 * 24 * 60 * 60 * 1000

function fileTime(file) {
    return new Date(file.createdTime).getTime()
}

async function rotateBackups(keep) {
    const files = await listBackups()
    const newestFirst = [...files].sort((a, b) => fileTime(b) - fileTime(a))
    const kept = []
    const removed = []

    for (const file of newestFirst) {
        const time = fileTime(file)
        const lastKept = kept[kept.length - 1]
        const sameWeekAsNewer = lastKept && fileTime(lastKept) - time < WEEK_MS

        if (kept.length >= keep || sameWeekAsNewer) {
            removed.push(file)
        }
        else {
            kept.push(file)
        }
    }

    for (const file of removed) {
        await deleteFile(file.id)
    }

    return {
        kept: kept.length,
        deleted: removed.map((file) => file.name)
    }
}

module.exports = {
    uploadBackup,
    rotateBackups
}
