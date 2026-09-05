const { loadEnv, hasOAuth } = require("./env")

loadEnv()

function missingEnv() {
    const missing = ["MONGODB_URI", "GOOGLE_DRIVE_FOLDER_ID"].filter((key) => !process.env[key])

    if (!hasOAuth()) {
        missing.push("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REFRESH_TOKEN")
    }

    return missing
}

const missing = missingEnv()
if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")}`)
    if (!hasOAuth()) {
        console.error("First add OAuth client id/secret, then run: npm run drive-auth")
    }
    process.exit(1)
}

const { runBackup } = require("./backup")

console.log("Starting backup…")

runBackup()
    .then((result) => {
        console.log("Backup uploaded to Google Drive")
        console.log(JSON.stringify(result, null, 2))
        console.log("Restore: download the .tar.gz, then")
        console.log(`  npm run restore -- /path/to/${result.fileName}`)
        console.log("Add --drop to replace existing collections with the same names.")
    })
    .catch((error) => {
        console.error(error.stack || error.message)
        process.exit(1)
    })
