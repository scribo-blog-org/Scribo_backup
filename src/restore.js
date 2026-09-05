const { spawnSync } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")
const { loadEnv } = require("./env")

loadEnv()

const archive = process.argv[2]

if (!archive) {
    console.error("Usage: npm run restore -- /path/to/scribo-backup-….tar.gz")
    process.exit(1)
}

if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing")
    process.exit(1)
}

if (!fs.existsSync(archive)) {
    console.error(`File not found: ${archive}`)
    process.exit(1)
}

const drop = process.argv.includes("--drop")
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "scribo-restore-"))

function run(command, args) {
    const result = spawnSync(command, args, { stdio: "inherit" })
    if (result.error && result.error.code === "ENOENT") {
        console.error(`${command} is not installed.`)
        if (command === "mongorestore") {
            console.error("Install MongoDB Database Tools, then retry.")
            console.error("macOS: brew install mongodb-database-tools")
        }
        process.exit(1)
    }
    if (result.status !== 0) {
        process.exit(result.status || 1)
    }
}

run("tar", ["-xzf", path.resolve(archive), "-C", workdir])

const dumpDir = path.join(workdir, "dump")
if (!fs.existsSync(dumpDir)) {
    console.error("Archive is not a mongodump tree (expected dump/<db>/*.bson).")
    process.exit(1)
}

const args = ["--uri", process.env.MONGODB_URI, dumpDir]
if (drop) {
    args.unshift("--drop")
}

console.log(drop
    ? "Restoring with --drop (existing collections with the same names will be replaced)."
    : "Restoring without --drop. Pass --drop to replace existing collections.")

run("mongorestore", args)
console.log("Restore finished.")
