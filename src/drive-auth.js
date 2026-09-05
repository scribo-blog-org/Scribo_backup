const http = require("http")
const { spawn } = require("child_process")
const { google } = require("googleapis")
const { loadEnv } = require("./env")

loadEnv()

const PORT = 3456
const REDIRECT = `http://127.0.0.1:${PORT}`
const SCOPE = ["https://www.googleapis.com/auth/drive"]

async function main() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET

    if (!clientId || !clientSecret) {
        console.error("Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to backup/.env")
        process.exit(1)
    }

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT)
    const url = oauth2.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPE
    })

    console.log("Do not open http://127.0.0.1:3456 yourself.")
    console.log("A Google login page should open. If not, paste this URL in the browser:\n")
    console.log(url)
    console.log("\nIf Google shows redirect_uri_mismatch, add this exact URI to the OAuth client:")
    console.log(" ", REDIRECT)
    console.log("If Google shows 'app isn't verified': Advanced → Go to scribo-blog (unsafe)\n")

    spawn("open", [url], { stdio: "ignore", detached: true }).unref()

    const code = await waitForCode()
    const { tokens } = await oauth2.getToken(code)

    if (!tokens.refresh_token) {
        console.error("No refresh_token. Revoke the app at https://myaccount.google.com/permissions and run drive-auth again.")
        process.exit(1)
    }

    console.log("\nAdd this line to backup/.env and Vercel:\n")
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`)
}

function waitForCode() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const requestUrl = new URL(req.url, REDIRECT)
            const ignored = requestUrl.pathname !== "/" || req.method !== "GET"

            if (ignored) {
                res.statusCode = 204
                res.end()
                return
            }

            const code = requestUrl.searchParams.get("code")
            const error = requestUrl.searchParams.get("error")

            console.log("Browser hit:", requestUrl.pathname + requestUrl.search)

            if (error) {
                res.end("Auth failed. You can close this tab.")
                server.close()
                reject(new Error(error))
                return
            }

            if (!code) {
                res.setHeader("Content-Type", "text/html; charset=utf-8")
                res.end("Waiting for Google login. Use the URL from the terminal, do not open this address yourself.")
                return
            }

            res.setHeader("Content-Type", "text/html; charset=utf-8")
            res.end("Google auth ok. Return to the terminal.")
            server.close()
            resolve(code)
        })

        server.on("error", reject)
        server.listen(PORT, "127.0.0.1")
    })
}

main().catch((error) => {
    console.error(error.message)
    process.exit(1)
})
