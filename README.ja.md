# Authlete Study Session 2026-02

このリポジトリは Authlete 勉強会 [OAuth & OpenID Connect 勉強会ー最新MCP仕様対応認可サーバー構築ハンズオン](https://authlete.connpass.com/event/380872/) のハンズオン資料です。
このハンズオンでは [Model Context Protocol Version 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) に対応した認可サーバーを [Authlete](https://www.authlete.com) を使って構築します。
目標は VS Code を MCP クライアントとして Client ID Metadata Document (CIMD) を利用し自動登録し、自作の認可サーバーで保護された MCP サーバーを呼び出すことです。

## 事前準備

ハンズオンに参加する前に、以下のツールをインストールし、後述の動作確認を行ってください。

- git: リポジトリをクローンするために必要です。
- Node.js runtime (>= 18): サンプルの動作に必要です。
- [ngrok CLI](https://ngrok.com/download): 認可サーバーを HTTPS で公開するために必要です。他のツール、たとえば GitHub Codespaces のポートフォワーディングなどを利用しても構いません。
- [Visual Studio Code](https://code.visualstudio.com/): MCP サーバーに接続するためのクライアントとして利用します。コードの実装はお好きなエディタで実装して構いません。
- [GitHub Copilot](https://github.com/features/copilot/) のフリープラン (またはそれ以上のプラン) へのサインアップ: VS Code と MCP サーバーの接続確認に利用します。CIMD に対応した他のクライアントでも構いません。

### Node.js のインストールと動作確認

[Node.js](https://nodejs.org/ja/download) のインストールサイトからダウンロードするか、各 OS のパッケージマネージャーを利用しインストールします。

```sh
# eg)
sudo apt install nodejs
winget install "Node.js LTS"
```

インストール後、本リポジトリをクローンし、モックサーバーを起動します。

```sh
git clone https://github.com/authlete/study-session-2026-02.git
cd study-sessoin-2026-02

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

http://localhost:9000 にアクセスし、`{"service":"oauth-server","status":"ok","note":"Development stub running over http"}` のように JSON 応答が確認できれば OK です。

### ngrok のインストールと動作確認

[ngrok](https://ngrok.com/) にアクセスし、サインアップまたはログインします。[Setup&Installation](https://dashboard.ngrok.com/get-started/setup/) の手順に従い ngrok のインストールと初期設定を行います。

コマンド例

```sh
# macOS
brew install ngrok

# windows
winget install ngrok -s msstore

ngrok config add-authtoken <your-ngrok-token>
```

インストール後、開発サーバーが起動している状態で別ターミナルを起動し、以下のコマンドを実行します。

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

Forwarding に表示された URL にアクセスし、ローカルと同様に `{"service":"oauth-server","status":"ok","note":"Development stub running over http"}` のレスポンスが得られれば準備完了です。

### (オプション) ngrok の URL を固定する

ngrok が発行する URL は ngrok 起動の度に変わってしまいます。ハンズオン中は基本的に ngrok を接続したままにするので問題ないですが、固定したい場合 [ngrok の Domain 設定](https://dashboard.ngrok.com/domains)から、独自のドメインを発行しておきましょう。フリープランであっても `<prefix>.ngrok-free.dev` のような dev ドメインを取得できます。
ドメインを取得した場合、ngrok の起動コマンドは以下のようになります。

```sh
ngrok http --url=<prefix>.ngrok-free.dev 9000
```

これで事前準備は完了です。
当日の作業については [docs](./docs) に資料を追加予定です。
