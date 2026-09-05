const { MongoClient } = require("mongodb")
const { BSON, EJSON } = require("bson")
const { gzipSync } = require("zlib")
const { packTar } = require("./tar")

function mongoUri() {
    const uri = process.env.MONGODB_URI
    if (!uri) {
        throw new Error("MONGODB_URI is missing")
    }
    return uri
}

function collectionUuid(info) {
    const uuid = info?.info?.uuid
    if (!uuid) {
        return undefined
    }
    if (typeof uuid.toHexString === "function") {
        return uuid.toHexString()
    }
    if (Buffer.isBuffer(uuid.buffer)) {
        return Buffer.from(uuid.buffer).toString("hex")
    }
    return undefined
}

function serializeDocuments(docs) {
    const chunks = docs.map((doc) => BSON.serialize(doc))
    return chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0)
}

function metadataJson(info, indexes) {
    const metadata = {
        indexes,
        collectionName: info.name,
        type: info.type || "collection"
    }
    const uuid = collectionUuid(info)
    if (uuid) {
        metadata.uuid = uuid
    }
    if (info.options && Object.keys(info.options).length) {
        metadata.options = info.options
    }
    return EJSON.stringify(metadata, { relaxed: false })
}

async function dumpCollection(db, info, session) {
    const files = []
    const prefix = `dump/${db.databaseName}/${info.name}`
    const collection = db.collection(info.name)
    const indexes = await collection.listIndexes({ session }).toArray()

    files.push({
        name: `${prefix}.metadata.json`,
        data: metadataJson(info, indexes)
    })

    if (info.type === "view") {
        return files
    }

    const docs = await collection.find({}, { session }).toArray()
    files.push({
        name: `${prefix}.bson`,
        data: serializeDocuments(docs)
    })

    return files
}

async function listAndDump(db, session) {
    const collections = await db.listCollections({}, { session }).toArray()
    const files = []

    for (const info of collections) {
        if (info.name.startsWith("system.")) {
            continue
        }
        files.push(...await dumpCollection(db, info, session))
    }

    return files
}

async function dumpDatabase() {
    const client = new MongoClient(mongoUri())
    const createdAt = new Date().toISOString()

    try {
        await client.connect()
        const db = client.db(process.env.MONGODB_DB || undefined)
        let files

        const session = client.startSession()
        try {
            session.startTransaction({
                readConcern: { level: "snapshot" },
                readPreference: "primary"
            })
            files = await listAndDump(db, session)
            await session.commitTransaction()
        }
        catch {
            if (session.inTransaction()) {
                await session.abortTransaction()
            }
            files = await listAndDump(db)
        }
        finally {
            await session.endSession()
        }

        const buffer = gzipSync(packTar(files))
        const stamp = createdAt.replace(/[:.]/g, "-")
        const prefix = process.env.BACKUP_PREFIX || "scribo-backup-"
        const collectionCount = new Set(
            files
                .map((file) => file.name.match(/\/([^/]+)\.metadata\.json$/)?.[1])
                .filter(Boolean)
        ).size

        return {
            createdAt,
            database: db.databaseName,
            collectionCount,
            fileName: `${prefix}${stamp}.tar.gz`,
            buffer
        }
    }
    finally {
        await client.close()
    }
}

module.exports = { dumpDatabase }
