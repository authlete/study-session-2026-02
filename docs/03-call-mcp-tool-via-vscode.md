# Visual Studio Code との連携

Visual Studio Code (VS Code) は CIMD に早くから対応している AI Agent です。
最後の章では実際に VS Code から自作の認可サーバーで保護された MCP サーバーに接続し、Agent から Tool の呼び出しができることを確認します。
ここまでの実装ができていれば CIMD でのクライアント登録および、トークン取得、MCP サーバーへの接続が正常に動作するはずです。

## MCP サーバーの実装

MCP サーバーは `@hono/mcp` を利用し [/apps/mcp-server/src/index.ts](/apps/mcp-server/src/index.ts) で実装されています。`@hono/mcp` は Protected Resource Metadata などしか生成しないので、トークンの検証コードや 401 Unauhtorized を返却するコードは自分で書く必要があります。そのため [bearer-guard.ts](/apps/mcp-server/src/auth/bearer-guard.ts) で実装しています。

## MCP サーバーとの接続

MCP サーバーとの接続方法は幾つかありますが、今回はワークスペース設定 ([/.vscode/mcp.json](/.vscode/mcp.json)) から設定します。
すでにサンプルリポジトリに組み込んでいますので VS Code でこのリポジトリを開いて、[/.vscode/mcp.json](/.vscode/mcp.json) を開いてください。

開くと demo-mcp-server の上に Start ボタンが表示されます。

![start mcp server](../img/03-call-mcp-tool-via-vscode/start-mcp.png)

Start ボタンをクリックすると、以下のようなダイアルボックスが表示されるので Allow をクリックします。

![start authorization](../img/03-call-mcp-tool-via-vscode/start-authorization.png)

MCP サーバーの応答する 401 Unauthorized レスポンスの WWW-Authenticate ヘッダーや Protected Resource Metadata の内容から、認可サーバーのメタデータへアクセスが発生します。認可サーバーが正しく実装されていれば、VS Code は CIMD による認可リクエストを試みます。

![authorization request](../img/03-call-mcp-tool-via-vscode/authorization-request.png)

> Note: client_id が https%3A%2F%2Fvscode... から始まることを確認してください

ダイアログで Open をクリックするとブラウザーが認可リクエストを認可サーバーに送信します。うまく実装できていれば、何らかの同意画面が表示されるはずです。

サンプル実装では以下の画面が表示されます。

![consent screen](../img/03-call-mcp-tool-via-vscode/consent-screen.png)

同意を完了し、VS Code に戻ると、以下のように MCP サーバーが起動し Tool が 2 つ存在するという表記に変わります。

![connected mcp server](../img/03-call-mcp-tool-via-vscode/connected-mcp.png)

## GitHub Copilot からの呼び出し

VS Code のコマンドパレットから `Chat: Open Chat` コマンドを実行します。
Chat で以下のように MCP サーバーを指定した指示を出し、MCP サーバーが動作することを確認します。

> #echo ツールを  "Hello world" のメッセージでよびだして

正常動作した場合、以下のような出力が期待されます。

![chat result](../img/03-call-mcp-tool-via-vscode/chat-result.png)

## うまく接続できない場合

MCP サーバーに接続がうまくいかない場合の失敗例を挙げますので参考にしてください。

### メタデータに不備がある

認可サーバーが正しく実装されていない場合、エラーとなったり、クライアント ID を指定するダイアログが出てきます。

![error dialog as does not support CIMD](../img/03-call-mcp-tool-via-vscode/error-dialog.png)

MCP サーバーとの接続時のログは OUTPUT Panel に表示されるので、エラー時には参照してください。

![OUTPUT panel error example (metadata not found)](../img/03-call-mcp-tool-via-vscode/output-panel-error-example.png)

### 認可フローが開始したものの終了していない

なんどもデバッグを繰り返すうちに、認可フローが終わっていな状態で止まってしまうことがあります。
VS Code の右下のアラームアイコンをクリックすることで、継続中の認可フローをキャンセルできることがあるので困った場合には確認してください。

![check notification](../img/03-call-mcp-tool-via-vscode/check-notification.png)

またクライアント ID などのキャッシュを削除するには `removeDynamicAuthenticationProviders` コマンドを利用してください。
