const { Readable } = require("stream")
const { MongoClient } = require("mongodb")
const { loadEnv, hasOAuth } = require("./env")
const { driveClient, resolveFolderId } = require("./drive")

loadEnv()

async function checkMongo() {
    const uri = process.env.MONGODB_URI
    if (!uri) {
        throw new Error("MONGODB_URI is missing")
    }

    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 })

    try {
        await client.connect()
        const db = client.db(process.env.MONGODB_DB || undefined)
        await db.command({ ping: 1 })
        console.log(`Mongo OK (${db.databaseName})`)
    }
    finally {
        await client.close()
    }
}

async function checkDrive() {
    if (!hasOAuth()) {
        throw new Error("GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET or GOOGLE_OAUTH_REFRESH_TOKEN is missing")
    }

    const folder = await resolveFolderId()
    const drive = driveClient()
    const name = `scribo-deploy-probe-${Date.now()}.txt`
    const created = await drive.files.create({
        requestBody: {
            name,
            parents: [folder]
        },
        media: {
            mimeType: "text/plain",
            body: Readable.from(Buffer.from("ok"))
        },
        fields: "id",
        supportsAllDrives: true
    })

    await drive.files.delete({
        fileId: created.data.id,
        supportsAllDrives: true
    })

    console.log("Drive OK (read folder, write and delete probe file)")
}

async function main() {
    const errors = []

    try {
        await checkMongo()
    }
    catch (error) {
        errors.push(`Mongo: ${error.message}`)
    }

    try {
        await checkDrive()
    }
    catch (error) {
        errors.push(`Drive: ${error.message}`)
    }

    if (errors.length) {
        console.error("Connection check failed:")
        for (const line of errors) {
            console.error(line)
        }
        process.exit(1)
    }
}

main()
