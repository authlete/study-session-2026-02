import { Context } from "hono";
import { config } from "../config";

export const sampleClientHandler = (c: Context) => {
    const tokenEndpoint = '/token';
    const scope = config.mcpScopes;
    return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sample Client</title>
  </head>
  <body>
    <main>
      <h1>Sample Client</h1>
      <h2>Authorization Request</h2>
      <pre id="authorize-url">Loading...</pre>
      <button id="authorize" type="button">Start authorization</button>
      <h2>Callback Query</h2>
      <pre id="params">Loading...</pre>
      <button id="exchange" type="button">Exchange code</button>
      <button id="reset" type="button">Reset</button>
      <h2>Token Response</h2>
      <pre id="result">Waiting...</pre>
    </main>
    <script>
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');
      const paramsView = document.getElementById('params');
      const authorizeUrlView = document.getElementById('authorize-url');
      const result = document.getElementById('result');
      const authorizeButton = document.getElementById('authorize');
      const exchangeButton = document.getElementById('exchange');
      const resetButton = document.getElementById('reset');
      const authorizeEndpoint = '/authorize';
      const pkceStorageKey = 'sample-client:pkce_verifier';

      paramsView.textContent = JSON.stringify(Object.fromEntries(params), null, 2) || '{}';
      exchangeButton.disabled = !code || Boolean(error);

      if (error) {
        result.textContent = 'Error: ' + error;
      } else if (!code) {
        result.textContent = 'No code in query string.';
      }

      function base64UrlEncode(bytes) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary).replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
      }

      function generateVerifier() {
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        return base64UrlEncode(bytes);
      }

      async function sha256(input) {
        const data = new TextEncoder().encode(input);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return new Uint8Array(digest);
      }

      async function buildAuthorizeUrl() {
        const verifier = generateVerifier();
        const challengeBytes = await sha256(verifier);
        const challenge = base64UrlEncode(challengeBytes);
        sessionStorage.setItem(pkceStorageKey, verifier);
        const authorizeParams = new URLSearchParams({
          response_type: 'code',
          client_id: 'sample-client',
          redirect_uri: window.location.origin + '/sample-client',
          scope: '${scope}',
          code_challenge: challenge,
          code_challenge_method: 'S256',
          resource: 'https://testresource.example.com',
        });
        return authorizeEndpoint + '?' + authorizeParams.toString();
      }

      async function refreshAuthorizeUrl() {
        if (!window.crypto || !window.crypto.subtle) {
          authorizeUrlView.textContent = 'Crypto APIs are not available in this browser.';
          authorizeButton.disabled = true;
          return;
        }
        const authorizeUrl = await buildAuthorizeUrl();
        authorizeUrlView.textContent = authorizeUrl;
        authorizeButton.addEventListener('click', () => {
          window.location.href = authorizeUrl;
        }, { once: true });
      }

      if (!code && !error) {
        refreshAuthorizeUrl();
      }

      exchangeButton.addEventListener('click', () => {
        if (!code || error) {
          return;
        }
        result.textContent = 'Exchanging code...';
        const verifier = sessionStorage.getItem(pkceStorageKey);
        if (!verifier) {
          result.textContent = 'PKCE verifier not found. Start authorization again.';
          return;
        }
        const body = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: 'sample-client',
          redirect_uri: window.location.origin + '/sample-client',
          code_verifier: verifier,
        });

        fetch('${tokenEndpoint}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        })
          .then((res) => res.json())
          .then((data) => {
            result.textContent = JSON.stringify(data, null, 2);
          })
          .catch((err) => {
            result.textContent = 'Token request failed: ' + err;
          });
      });

      resetButton.addEventListener('click', () => {
        sessionStorage.removeItem(pkceStorageKey);
        window.location.href = window.location.origin + '/sample-client';
      });
    </script>
  </body>
</html>`);
};
