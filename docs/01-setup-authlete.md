# Authlete の設定

Authlete へのサインアップを行いサービスとサンプルクライアントを作成します。Authlete のサービスは「認可サーバー」に該当し、サービスの設定を変更することで認可サーバーのふるまいを決定します。
今回は MCP サーバーを保護する認可サーバーとしての役割を実装するため、以下の内容を設定します。

1. グラントタイプ: 認可コードグラントとリフレッシュトークングラントを有効化
2. 認可コード交換用証明キー（PKCE）を必須にする
3. MCP サーバー用のスコープ (mcp.echo) を追加 
4. JWT 形式のトークン署名用の JWKS セットの登録
5. CIMD (Client ID Metadata Document) の有効化

## .env ファイルのコピー

作業を始める前に、認可サーバーの設定ファイルを作成します。

```sh
cp .env.example .env
```

Authlete コンソールで取得したサービスの ID などはこのファイルに書き込みます。

## Authlete へのサインアップ

最初に Authlete [クイックスタートガイド](https://www.authlete.com/ja/developers/getting_started/) を参照し、無料トライアルアカウントにサインアップし、サービスアクセストークンの作成まで完了させます。
作成したアクセストークンは `AUTHLETE_SERVICE_ACCESSTOKEN` として .env ファイルに保存します。

作成したサービスの [すべてのクライアント] 画面から確認できる `サービスID` と `クラスターURL` をそれぞれ `AUTHLETE_SERVICE_APIKEY`, `AUTHLETE_BASE_URL` として保存します。

![all clients](../img/01-setup-authlete/all-clients.png)

`.env` ファイルは以下のようになるはずです。

```env
# Authlete Settings
AUTHLETE_SERVICE_APIKEY=1122316996 # Replace with your Authlete service API key
AUTHLETE_BASE_URL=https://jp.authlete.com
AUTHLETE_SERVICE_ACCESSTOKEN=CCVfO91zGcjgUkatssaNwSsGG-NYTbFlbO8ORSEkFLQ # Replace with your Authlete service access token
```
## Authlete サービスの設定

### グラントタイプ

[エンドポイント] > [基本設定] > [一般] > [サポート可能なグラントタイプ] では `AUTHORIZATION_CODE` と `REFRESH_TOKEN`, `DEVICE_CODE` のみを選択し、変更を保存をクリックします。

> Note: `DEVICE_CODE` の実装は本ハンズオンでは行いませんが、VS Code のメタデータが `grant_types` に `urn:ietf:params:oauth:grant-type:device_code` を指定しているため有効化しています。[Client Metadata Policy](https://qiita.com/TakahikoKawasaki/items/e4898a31f3ae52be3eff) で認可サーバーのサポートしていない grant_type を上書きすることができますが、本セッション開催時点ではコンソールに設定項目がないため上記の対応としています。

### PKCE を必須にする

[エンドポイント] >  [認可] > [一般] > [認可コード交換用証明キー（PKCE）] で `PKCEを必須にする`, `コードチャレンジメソッドに対してS256を必須にする` を有効にし、変更を保存をクリックします。

###  MCP サーバー用のスコープ (mcp.echo) を追加

1. [トークン&クレーム] > [詳細設定] > [スコープ] > [サポート可能なスコープ] で `追加` をクリックします。
2. スコープ名に `mcp.echo` を、説明に `echo mcp server の呼び出し` と指定し、`追加` をクリックします。
3. 変更を保存をクリックします。

![add scope for mcp server](../img/01-setup-authlete/scope-setting.png)

> Note: ここで設定した scope は .env の `MCP_SCOPES` に対応します。サンプル MCP サーバーの実装はこの値を 401 応答に含まれる `WWW-Authentication ヘッダー` の `scope`, Protected Resource Metadata の `supported_scopes` の値として利用します。

### JWKセットの内容

アクセストークンと ID トークン署名用に、JWK (JSON Web Key) を設定します。まずは https://mkjwk.org にアクセスし、`RS256` のキーペアを作成します。指定するパラメータは以下のようにし、Generate ボタンをクリックします。

- Key Size: 2048
- Key Use: Signature
- Algorithm: RS256
- Key ID: Specify 
    - Key ID の値: rsa1

![https://mkjwk.org](../img/01-setup-authlete/mkjwk.png)

画面真ん中の Public and Private Keypair Set をコピーし、Authlete のサービス設定 [キーマネージメント] > [JWK Set] > [認可サーバー] > [JWKセットの内容] に貼り付けます。IDトークンの署名キーID には `rsa1` を指定します。

![set up jwk set content in console](../img/01-setup-authlete/jwk-set.png)

同様に [トークン&クレーム] > [アクセストークン] > [一般] の `署名アルゴリズムを選択` を `RS256` に、`署名キーIDを入力` に `rsa1` を設定し、変更を保存をクリックします。 

![configure the access token signing key](../img/01-setup-authlete/access-token-signing-key.png)

### CIMD (Client ID Metadata Document) の有効化

サービス設定の [メタデータ] > [クライアントIDメタデータ (CIMD)] > [クライアントIDメタデータドキュメント（CIMD）] を有効にします。また [常にメタデータを取得], [HTTPスキームを許可] も有効化します。

Authlete のサービス設定はこれで完了です。

## サンプルクライアントの作成

認可サーバーの動作確認のためのサンプルクライアントを登録します。

1. Authlete コンソールのサービス設定または [すべてのクライアント] の右上にある [クライアントの新規作成] ボタンをクリックします。
2. 以下のパラメーターでクライアントを登録します。
  1. クライアント名: Sample Client
  2. クライアント ID: sample-client
  3. クライアントの詳細情報: Sample Client for testing
  4. クライアントタイプ: 公開
  5. アプリケーションタイプ: Web

![create new client](../img/01-setup-authlete/create-new-client.png)

3. クライアント設定の [エンドポイント] > [基本設定] > [リダイレクトURI] に `http://localhost:9000/sample-client` を登録します。

![add redirect uri](../img/01-setup-authlete/redirect-uri.png)

4. クライアント設定の [トークンとクレーム] > [IDトークン] > [IDトークン署名アルゴリズム] を `RS256` に設定し、変更を保存をクリックします。 

クライアントの設定は以上です。

認可サーバーの実装が完了したのち改めて各種エンドポイントの設定を行いますが、一旦 Authlete コンソールでの設定項目は完了です。

## 次の手順

[認可サーバーの実装](./02-implement-authorization-server.md)