const { dumpDatabase } = require("./dump")
const { uploadBackup, rotateBackups } = require("./drive")

function keepCount() {
    const keep = Number.parseInt(process.env.BACKUP_KEEP, 10)
    return Number.isFinite(keep) && keep > 0 ? keep : 8
}

async function runBackup() {
    const dump = await dumpDatabase()
    const uploaded = await uploadBackup({
        fileName: dump.fileName,
        buffer: dump.buffer,
        createdAt: dump.createdAt
    })
    const rotation = await rotateBackups(keepCount())

    return {
        createdAt: dump.createdAt,
        database: dump.database,
        collectionCount: dump.collectionCount,
        fileName: dump.fileName,
        fileId: uploaded.id,
        keep: keepCount(),
        deleted: rotation.deleted
    }
}

module.exports = { runBackup }
