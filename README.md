# Authlete Study Session 2026-02

This repository contains hands-on materials for the Authlete study session  
[OAuth & OpenID Connect Study Session – Hands-on: Building an Authorization Server Compatible with the Latest MCP Specification](https://authlete.connpass.com/event/380872/).

In this hands-on session, you will build an authorization server compliant with  
[Model Context Protocol Version 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) using [Authlete](https://www.authlete.com).

The goal is to use VS Code as an MCP client, leverage a Client ID Metadata Document (CIMD) for automatic registration, and call an MCP server protected by your own authorization server.

## Prerequisites

Before participating in the hands-on session, please install the following tools and perform the verification steps described later.

- git: Required to clone the repository.
- Node.js runtime (>= 18): Required to run the sample.
- [ngrok CLI](https://ngrok.com/download): Required to expose the authorization server over HTTPS.
- [Visual Studio Code](https://code.visualstudio.com/): Used as the MCP client. You can implement the code in any editor you like.
- Sign up for the free (or higher) plan of [GitHub Copilot](https://github.com/features/copilot/): Used to confirm the connection between VS Code and the MCP server. Any other client that supports CIMD is also fine.

### Installing Node.js and Verifying the Setup

Download Node.js from the [Node.js](https://nodejs.org/ja/download) website, or install it using your OS package manager.

```sh
# eg)
sudo apt install nodejs
winget install "Node.js LTS"
```

After installation, clone this repository and start the mock servers.

```sh
git clone https://github.com/authlete/study-session-2026-02.git
cd authlete-study-sessoin-2026-02

npm install
npm run dev

# > authlete-study-session-2026-02@0.1.0 dev
# > npx concurrently -k -n oauth,mcp -c green,cyan "npm:dev:oauth" "npm:dev:mcp"
# 
# [mcp] 
# [mcp] > authlete-study-session-2026-02@0.1.0 dev:mcp
# [mcp] > npx tsx watch apps/mcp-server/src/index.ts
# [mcp] 
# [oauth] 
# [oauth] > authlete-study-session-2026-02@0.1.0 dev:oauth
# [oauth] > npx tsx watch apps/oauth-server/src/index.ts
# [oauth] 
# [mcp] mcp-server listening on http://localhost:9001
# [oauth] AUTHLETE_BASE_URL is not set.
# [oauth] AUTHLETE_SERVICE_ACCESSTOKEN is not set.
# [oauth] AUTHLETE_SERVICE_APIKEY is not set.
# [oauth] oauth-server listening on http://localhost:9000
```

Access http://localhost:9000.  
If you see a JSON response such as  
`{"service":"oauth-server","status":"ok","note":"Development stub running over http"}`, the setup is successful.

### Installing ngrok and Verifying the Setup

Visit [ngrok](https://ngrok.com/) and sign up or log in.  
Follow the instructions on [Setup & Installation](https://dashboard.ngrok.com/get-started/setup/) to install and initialize ngrok.

Command examples:

```sh
# macOS
brew install ngrok

# windows
winget install ngrok -s msstore

ngrok config add-authtoken <your-ngrok-token>
```

After installation, open another terminal while the development servers are running and execute the following command:

```
ngrok http 9000

# ngrok                                                                                                 (Ctrl+C to quit)
#                                                                                                                       
# 🚪 One gateway for every AI model. Available in early access *now*: https://ngrok.com/r/ai                            
#                                                                                                                       
# Session Status                online                                                                                  
# Account                       **************** (Plan: Free)                                               
# Version                       3.35.0                                                                                  
# Region                        United States (us)                                                                      
# Latency                       184ms                                                                                   
# Web Interface                 http://127.0.0.1:4040                                                                   
# Forwarding                    https://60609a8e4e64.ngrok-free.app -> http://localhost:9000 
```

Access the URL shown under `Forwarding`.  
If you receive the same response as locally,  
`{"service":"oauth-server","status":"ok","note":"Development stub running over http"}`, the setup is complete.

### (Optional) Fixing the ngrok URL

The URL issued by ngrok changes every time ngrok is restarted.  
During the hands-on session, this is usually not an issue because ngrok will remain connected. However, if you want a fixed URL, you can issue a custom domain from the [ngrok Domain settings](https://dashboard.ngrok.com/domains). Even on the free plan, you can obtain a dev domain such as `<prefix>.ngrok-free.dev`.

If you have obtained a domain, start ngrok with the following command:

```sh
ngrok http --url=<prefix>.ngrok-free.dev 9000
```

This completes the preparation.  
Materials for the hands-on work on the day of the session will be added under [docs](./docs-en).
