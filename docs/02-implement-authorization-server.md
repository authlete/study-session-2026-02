# 認可サーバーの実装

## 利用ライブラリ

ハンズオンでは beta リリースされている [@authlete/typescript-sdk](https://github.com/authlete/authlete-typescript-sdk) を利用します。
Web サーバーには [hono](https://hono.dev/) を利用していますが、express など、使慣れたフレームワークで実装しても構いません。

[@authlete/typescript-sdk](https://github.com/authlete/authlete-typescript-sdk) の利用例は以下の通りです。

```ts
import { Authlete } from "@authlete/typescript-sdk";

const authlete = new Authlete({
  bearer: process.env["AUTHLETE_BEARER"] ?? "",
});

async function run() {
  const result = await authlete.service.get({
    serviceId: "<id>",
  });

  console.log(result);
}
```

このサンプルにはすでに Authlete SDK が組み込まれており、[.env.example](/.env.example) で示した以下の環境変数から、必要なデータを読みとりインスタンスを生成します。

```conf
# Authlete Settings
AUTHLETE_BASE_URL=https://jp.authlete.com
AUTHLETE_SERVICE_APIKEY=your_authlete_service_apikey_here # Replace with your Authlete service API key
AUTHLETE_SERVICE_ACCESSTOKEN=your_authlete_service_accesstoken_here # Replace with your Authlete service access token
```

インスタンスの初期化は [getAuthlete](/apps/oauth-server/src/authlete.ts) メソッド内で実施しています。
このインスタンスは hono の context に追加済みなので、各 Handler では context からインスタンスを取得してください。詳しくは後述します。

## 実装するエンドポイント

実装する OAuth/OIDC のエンドポイントは以下の通りです。

| No. | Method | Path | Name | Description | Authlete API path | Authlete Typescript SDK メソッド | ドキュメント |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [1] | GET | `/.well-known/openid-configuration` | OpenID Discovery エンドポイント | サーバーメタデータを公開するエンドポイント | `GET /api/{serviceId}/service/configuration` | `authlete.service.getConfiguration({ serviceId })` | https://docs.authlete.com/en/shared/latest#get-/api/-serviceId-/service/configuration |
| [2] | GET/POST | `/authorize` | 認可エンドポイント | クライアントアプリケーションの認可リクエストを処理するエンドポイント | `POST /api/{serviceId}/auth/authorization` | `authlete.authorization.processRequest({ serviceId, authorizationRequest })` | https://docs.authlete.com/en/shared/latest#post-/api/-serviceId-/auth/authorization |
| [3] | POST | `/consent` | ユーザー同意結果取得エンドポイント | ユーザーの同意結果を取得し、認可コードを発行するエンドポイント | `POST /api/{serviceId}/auth/authorization/issue` | `authlete.authorization.issue({ serviceId, authorizationIssueRequest })` | https://docs.authlete.com/en/shared/latest#post-/api/-serviceId-/auth/authorization/issue |
| [4] | POST | `/token` | トークンエンドポイント | クライアントアプリケーションのトークンリクエストを処理するエンドポイント | `POST /api/{serviceId}/auth/token` | `authlete.token.process({ serviceId, tokenRequest })` | https://docs.authlete.com/en/shared/latest#post-/api/-serviceId-/auth/token |
| [5] | GET | `/jwks` | JWK セットエンドポイント | トークン署名検証用の公開鍵を JWKS 形式で公開するエンドポイント | `GET /api/{serviceId}/service/jwks/get` | `authlete.jwkSetEndpoint.serviceJwksGetApi({ serviceId })` | https://docs.authlete.com/en/shared/latest#get-/api/-serviceId-/service/jwks/get |

各エンドポイントでは、内部的に Authlete API の列に示した API を呼び出し、認可処理を実装します。認可サーバーは Authlete からの応答を解析し、認可サーバー独自のカスタマイズを実施したうえで、クライアントに結果を返却します。

ユーザーが同意をキャンセルした場合など、エラー応答を返却したい場合、採番対象外として以下の API を利用します。

| Authlete API path | 概要 | Authlete Typescript SDK メソッド | ドキュメント |
| --- | --- | --- | --- |
| `POST /api/{serviceId}/auth/authorization/fail` | 認可失敗（ユーザー拒否、`prompt=none` 非対応など）時に、OAuth/OIDC エラー応答を生成する | `authlete.authorization.fail({ serviceId, authorizationFailRequest })` | https://docs.authlete.com/en/shared/latest#post-/api/-serviceId-/auth/authorization/fail |


## フロー図

今回実装する全体のフローを記載します。🛠️【実装対象】と記載がある部分が今回のワークショップで実装する箇所です。
上述の実装するエンドポイントの採番に対応していますので、対応するメソッドとドキュメントの確認に利用してください。

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryTextColor': '#000000',
    'secondaryTextColor': '#000000',
    'tertiaryTextColor': '#000000',
    'lineColor': '#000000',
    'actorTextColor': '#000000',
    'noteTextColor': '#000000',
    'signalTextColor': '#000000',
    'sequenceNumberColor': '#000000'
  },
  'themeCSS': '.messageText, .labelText, .loopText, .noteText, .actor, .actor > tspan, .sequenceNumber, text { fill: #000 !important; color: #000 !important; }'
}}%%
sequenceDiagram
    participant U as User
    participant C as MCP Client
    participant UA as User Agent<br/>(Browser)
    participant AS as Authorization Server<br/>(https://example.ngrok-free.app)
    participant AL as Authlete
    participant MS as MCP Server<br/>(http://localhost:9001)

    %% Initial MCP Server Access
    rect rgb(255, 252, 252)
        Note over C,MS: Initial MCP Server Access (Authentication Challenge)
        C->>MS: POST /mcp (MCP Protocol)<br/>(without Authorization header)
        MS-->>C: 401 Unauthorized<br/>WWW-Authenticate: Bearer<br/>resource_metadata="http://localhost:9001/.well-known/oauth-protected-resource/mcp"
    end

    %% MCP Protected Resource Metadata
    rect rgb(248, 255, 248)
        Note over C,MS: MCP Protected Resource Metadata Discovery
        C->>MS: GET /.well-known/oauth-protected-resource/mcp
        MS-->>C: 200 {authorization_servers:["https://example.ngrok-free.app"],<br/>resource:"http://localhost:9001/mcp",<br/>scopes_supported:["mcp.echo"]}
    end

    %% [1] OpenID Configuration Discovery
    rect rgb(225, 232, 255)
        Note over C,AL: [1] 🛠️【実装対象】
        C->>AS: GET /.well-known/openid-configuration
        AS->>AL: GET /service/configuration<br/>(authlete.service.getConfiguration)
        AL-->>AS: 200 Service Configuration
        AS-->>C: 200 {issuer:"https://example.ngrok-free.app",<br/>authorization_endpoint:"https://example.ngrok-free.app/authorize",<br/>token_endpoint:"https://example.ngrok-free.app/token",<br/>jwks_uri:"https://example.ngrok-free.app/jwks"}
    end

    %% [2]-[3] Authorization (CIMD resolved by Authlete)
    rect rgb(250, 247, 255)
        Note over U,AL: OAuth 2.1 Authorization Code + PKCE (CIMD)
        U->>C: Start sign-in / connect MCP
        C->>UA: Open authorization URL
        rect rgb(226, 205, 245)
            Note over UA,AS: [2] 🛠️【実装対象】
            UA->>AS: GET /authorize?<br/>client_id=https://client.example/metadata.json&...
            AS->>AL: POST /auth/authorization {parameters}<br/>(authlete.authorization.processRequest)
            Note over AL: Check existing client registration<br/>If registered, check metadata cache expiration<br/>Check cimdAllowlist
            AL->>C: GET client_id (https://client.example/metadata.json)
            C-->>AL: 200 Client Metadata (JSON)
            Note over AL: Verify metadata client_id matches URL<br/>Ensure no symmetric crypto is used<br/>Apply policy
            AL-->>AS: 200 {action:"INTERACTION", ticket}
            Note right of AS: Save ticket to session
            AS-->>UA: 200 HTML (Login + Consent UI)
        end
        rect rgb(217, 191, 242)
            Note over UA,AS: [3] 🛠️【実装対象】
            U->>UA: Approve consent
            UA-->>AS: POST /consent
            Note right of AS: Load ticket from session
            AS->>AL: POST /auth/authorization/issue {ticket, subject}<br/>(authlete.authorization.issue)
            AL-->>AS: 200 {action:"LOCATION", responseContent}
            AS-->>UA: 302 redirect_uri?code=AUTH_CODE&state=...
            UA-->>C: Deliver authorization response (code, state)
        end
    end

    %% [4] Token Request
    rect rgb(225, 245, 245)
        Note over C,AS: [4] 🛠️【実装対象】
        C->>AS: POST /token<br/>grant_type=authorization_code&code=AUTH_CODE&...
        AS->>AL: POST /auth/token {parameters}<br/>(authlete.token.process)
        Note over AL: Issue signed JWT access token<br/>iss=https://example.ngrok-free.app<br/>aud=http://localhost:9001/mcp<br/>scope=mcp.echo
        AL-->>AS: 200 {action:"OK", responseContent}
        AS-->>C: 200 {access_token:"eyJhbGciOiJSUzI1NiIs...", token_type:"Bearer"}
    end

    %% Resource Access (JWT Validation)
    rect rgb(255, 250, 244)
        Note over C,MS: MCP Protocol with JWT Protection
        C->>MS: POST /mcp<br/>Authorization: Bearer eyJhbGciOi...
        rect rgb(255, 233, 204)
            Note over MS,AS: [1] 🛠️【実装対象】
            MS->>AS: GET /.well-known/openid-configuration
            AS->>AL: GET /service/configuration<br/>(authlete.service.getConfiguration)
            AL-->>AS: 200 Service Configuration
            AS-->>MS: 200 {issuer, jwks_uri}
        end
        rect rgb(255, 221, 179)
            Note over MS,AS: [5] 🛠️【実装対象】
            MS->>AS: GET /jwks
            AS->>AL: GET /service/jwks/get<br/>(authlete.jwkSetEndpoint.serviceJwksGetApi)
            AL-->>AS: 200 JWKS
            AS-->>MS: 200 {keys:[...]}
        end
        Note over MS: Validate JWT<br/>Verify signature (kid)<br/>Check iss=https://example.ngrok-free.app<br/>Check aud=http://localhost:9001/mcp<br/>Check exp<br/>Check scope=mcp.echo
        MS-->>C: 200 MCP Response
    end
```

## 具体的な実装方針

[apps/oauth-server/src/index.ts](/apps/oauth-server/src/index.ts) に、各エンドポイントの空実装があります。ハンズオンでは、各エンドポイントを実装していきます。

実装方針としては以下の通りです。

1. hono のコンテキストから Authlete SDK のインスタンス (authlete) と serviceId を取得します
1. クライアントからのリクエストを解析し、ヘッダー、クエリパラメータ、Body など必要な情報を取得します
1. 上記情報をもとに、Authlete SDK を利用し Authlete API を呼び出します
1. Authlete API の応答を解析し、クライアントにレスポンスを応答します

以下に実装の足掛かりとなる例を示します。

### OpenID Discovery エンドポイント

最もシンプルな Authlete サーバーの呼び出し例は OpenID Discovery エンドポイントの呼び出しです。
`/.well-known/openid-configuration` を呼び出された認可サーバーは、Authlete の service/configuration API を呼び出し、Authlete のレスポンスをそのまま応答します。

```ts
app.get('/.well-known/openid-configuration', async (c: Context) => {
    //コンテキストから authlete インスタンスと serviceId を取り出し
    const { authlete, serviceId } = c.var;
    //Authlete API の呼び出し
    const config = await authlete.service.getConfiguration({
        serviceId
    })
    //レスポンスをそのまま応答
    return c.json(config)
});
```

jwks エンドポイントについても同様です。

### その他のエンドポイント

認可エンドポイントやトークンエンドポイントは OpenID Discovery に比べると少し複雑です。
Authlete はリクエストの解析結果を認可サーバーに応答しますが、その中に認可サーバーが次に何をすべきかを示す `action` 応答が含まれています。`action` 応答に応じて適切なハンドリングを実装します。

[Authlete API からのレスポンスの処理に関する基本的な考えかた - Authlete](https://www.authlete.com/ja/kb/getting-started/implementing-an-authorization-server/handling-responses-from-authlete-apis/)

Authlete API の応答をどのように解析する必要があるかについては各 API ドキュメントを参照してください。

例えば認可エンドポイントでは `action: INTERACTION` が応答される場合があります。これはユーザーが未同意であればインタラクティブな同意画面を表示せよという指示なので、認可画面をレンダリングして応答します。

```ts
app.get('/authorize', async (c: Context) => {
  console.log('GET /authorize called');

  // implement authorization endpoint logic here
  const { authlete, serviceId } = c.var;
  const { search } = new URL(c.req.url);
  const parameters = search.startsWith('?') ? search.slice(1) : '';
  const authorizationRequest: AuthorizationRequest = {
    parameters
  };
  const response: AuthorizationResponse = await authlete.authorization.processRequest({
    serviceId: serviceId,
    authorizationRequest
  });

  const responseContent = response.responseContent ?? '';
  c.header('Cache-Control', 'no-store');
  c.header('Pragma', 'no-cache');

  // Authlete からのアクションをもとに応答を生成する
  switch (response.action) {
    case 'INTERNAL_SERVER_ERROR':
      c.header('Content-Type', 'application/json');
      return c.body(responseContent, 500);
    case 'BAD_REQUEST':
      c.header('Content-Type', 'application/json');
      return c.body(responseContent, 400);
    case 'LOCATION':
      if (responseContent) {
        return c.redirect(responseContent);
      }
      c.header('Content-Type', 'application/json');
      return c.body('', 500);
    case 'FORM':
      c.header('Content-Type', 'text/html; charset=UTF-8');
      return c.body(responseContent, 200);
    case 'INTERACTION':
      // ticket など必要な情報をセッションに保存する
      const authorizationSession = response.ticket
        ? {
          ticket: response.ticket,
          scopesToConsent: response.scopes
            ?.map((scope) => scope.name)
            .filter((scope): scope is string => Boolean(scope)) ?? [],
        }
        : undefined;
      await c.var.session.update((prev) => ({
        ...prev,
        authorization: authorizationSession,
      } satisfies AuthorizationSession));
      // 同意画面を生成する
      return renderConsent(c, response);
    case 'NO_INTERACTION':
      const errorResponse = await authlete.authorization.fail({
        serviceId,
        authorizationFailRequest: {
          ticket: response.ticket!,
          reason: 'SERVER_ERROR',
          description: 'prompt=none is not supported in this sample server'
        }
      });
      return handleFailAction(c, errorResponse);
    default:
      c.header('Content-Type', 'application/json');
      return c.body('', 500);
  }
});
```

> Note: クライアント ID の表示ロジックは CIMD ドキュメントの [クライアントプロパティ](https://www.authlete.com/ja/developers/cimd/#client_properties) を参照ください。[samples/handlers](/apps/oauth-server/src/samples/handlers.ts) に含まれる resolveClientId 関数が実装例ですので、基本的にはこちらのメソッドを利用いただいて構いません。

今回の実装ではユーザー認証は実装しないため、以下のデモユーザーで認証済みである前提で進めます。
また、アクセストークンのクレームには claims で示したクレームを追加します。これは後ほど連携する MCP サーバーの Tool で特定のクレームが必要となるためです。

```ts
const demoUser: User = {
    id: 'demo-user',
    claims: {
        family_name: 'Demo',
        given_name: 'Authlete',
        preferred_username: "Authlete Demo User"
    },
    consentedScopes: [],
};
```

## サンプル実装

開発の補助として認可コードフローでトークンを取得する SPA (Single Page Application) を `/sample-client` に実装しています。最初の目標はこのクライアントで正常にトークンを取得できるようになることです。

各エンドポイントのサンプル実装は [/apps/oauth-server/src/samples/handlers.ts](/apps/oauth-server/src/samples/handlers.ts) に含まれています。困った際の参照として利用ください。また、実際に以下のようにサンプルに含まれる Handler を指定することで、動作するデモサーバーを実装出来ます。

```ts
import {
  authorizeHandler,
  consentHandler,
  jwksHandler,
  openIdConfigHandler,
  tokenHandler,
} from './samples/handlers';

app.get('/authorize', authorizeHandler);
app.post('/authorize', authorizeHandler);
app.post('/consent', consentHandler);
app.post('/token', tokenHandler);
app.get('/jwks', jwksHandler);
app.get('/.well-known/openid-configuration', openIdConfigHandler);
```

ご自身での実装が難しい場合には、上記の Handler を利用して動作を確認してください。

## サンプルクライアントでのトークン取得

実装が完了したら http://localhost:9000/sample-client にアクセスを行い、認可リクエストを送信してみましょう。
`Start authorization` ボタンをクリックすると、認可リクエストが送信されます。認可エンドポイントから正しく認可コード応答が返り、`Exchange code` ボタンでトークンの交換ができれば完了です。

https://jwt.io などでトークンをデコードし、ペイロードを確認してみましょう。認可リクエストで指定したパラメーターや、認可サーバーで埋め込んだユーザークレームが含まれていることを確認してください。

## HTTPS での公開

`/sample-client` では認可エンドポイントやトークンエンドポイントを `/authorize` や `/token` など、決め打ちで相対パスを指定しています。
一方で MCP クライアントとの接続ではメタデータを通じてエンドポイントや jwks_uri を提供する必要があります。

メタデータ内の認可エンドポイントなどはサービスの各種設定がそのまま反映されますが、セキュリティの観点からこれらのエンドポイントは https のみが指定できます。したがって Authlete をバックエンドに利用している認可サーバー自身は、https でホストする必要があります。※

HTTPS で公開する方法については `mkcert` などで自己署名証明書を利用する、何らかのホスティングサービスにデプロイする、`ngrok` などのプロキシサービスを通じて公開するといった方法がありますが、今回は環境ごとの差異が生じにくい `ngrok` を使った方法を利用します。

README にある通りに ngrok のセットアップを実施後に、`ngrok http 9000` コマンドを実行します。
Forwarding に表示された URL をコピーし、以下の個所に反映させます。

1. `.env` ファイルの `OAUTH_SERVER_ISSUER`
2. Authlete コンソールの対象サービス内の各種エンドポイント設定※

※ クライアント設定ではなくサービス設定を更新する必要があります。クライアント設定を開いている場合、一度コンソールトップ (https://console.authlete.com/) に戻り、対象組織 > 対象サービス から [すべてのクライアント] 画面に移動し [サービス設定] をクリックしてください。

| メタデータ内のプロパティ | 設定箇所 | 設定する値 |
| ---------------------- | ------- | --------- |
| issuer | [基本設定] > [詳細設定]> [発行者識別子] | `OAUTH_SERVER_ISSUER` |
| authorization_endpoint | [エンドポイント] > [認可] > [一般] > [認可エンドポイントURL] | `OAUTH_SERVER_ISSUER`/authorize |
|token_endpoint| [エンドポイント] > [トークン] > [一般] > [トークンエンドポイントURL] | `OAUTH_SERVER_ISSUER`/token |
|jwks_uri| [キーマネージメント] > [JWK Set] > [認可サーバー] > [JWKセットエンドポイントのURI] | `OAUTH_SERVER_ISSUER`/jwks |

3. Authlete コンソールのサンプルクライアント [エンドポイント] > [基本設定] > [一般] > [リダイレクトURI] に `OAUTH_SERVER_ISSUER`/sample-client を追加

例えば ngrok で `https://example.ngrok-free.dev` の URL が公開されている場合、`OAUTH_SERVER_ISSUER` には `https://example.ngrok-free.dev` を、[認可エンドポイントURL] には `https://example.ngrok-free.dev/authorize` を指定します。


> ※開発中のワークアラウンドとしてメタデータの応答 (例えば authorization_endpoint) を編集し、http スキーマに書き換えるといった手法もありますが、今回は素直に HTTPS での公開をします。

## 最終確認

全ての設定が終わったら、`npm run dev` コマンドで開発用サーバーを再起動します。

以下を順に確認してください。

### 1. MCP サーバーの Protected Resource Metadata

MCP サーバーの Protected Resource Metadata (http://localhost:9001/.well-known/oauth-protected-resource/mcp) に含まれる `authorization_servers` の値が、HTTPS で公開している認可サーバーの URL (https://example.ngrok-free.dev など) になっているか確認します。
MCP クライアントはこの情報を利用し、MCP サーバーがどの認可サーバーで保護されているかを確認します。
正しい値になっていない場合 `.env` の `OAUTH_SERVER_ISSUER` を修正します。

### 2. 認可サーバーの OpenID Configuration 

認可サーバーの OpenID Configuration (http://localhost:9000/.well-known/openid-configuration) に含まれる以下のエンドポイントが、実際に HTTPS で公開している認可サーバーの URL になっているか確認します。

  * `issuer`
  * `authorization_endpoint`
  * `token_endpoint`
  * `jwks_uri`
 
`client_id_metadata_document_supported` が `true` になっているか確認します。

MCP クライアントは上記値をもとに認可リクエストを構築するため、値が間違っていると誤った認可リクエストを送信してしまいます。
値が間違っている場合 `HTTPS での公開` セクションを参考に Authlete コンソールからサービス設定を更新してください。

認可サーバーの実装はこれで完了です。

## 次の手順

[VS Code との連携確認](./03-call-mcp-tool-via-vscode.md)
