# Authorization Server Hands-on

In this hands-on session you will build an authorization server that issues JWT access tokens.
You will also publish metadata so that an MCP server can validate those JWT access tokens.

## Overview

Authlete provides OpenID Connect/OAuth functionality as APIs.
Authorization server implementers build the front-end authorization server and call Authlete APIs inside it.
In this session, a web server running at http://localhost:9000 is used as the front-end authorization server.

![](https://www.authlete.com/img/developers/overview/authletes-role-in-authorization.png)

## Out of Scope

The following are not implemented in this hands-on session.

* User authentication and session management (assume a demo user is already authenticated)
* Determining which scopes the user can consent to (assume all requested scopes can be consented to)
* Determining claims to include in tokens (embed preconfigured demo-user claims)
* Security countermeasures such as CSRF protection

If you have extra time, you may try adding them as optional exercises.

## Hands-on Steps

You will implement the authorization server in the following steps.

1. [Sign up for Authlete 3.0 and create a service](./01-setup-authlete.md)
2. [Implement the authorization server and verify with a sample client](./02-implement-authorization-server.md)
3. [Verify the integration with VS Code](./03-call-mcp-tool-via-vscode.md)

The final goal is to use VS Code as an OAuth client and obtain tokens via the authorization code flow for the MCP server implemented in [apps/mcp-server](apps/mcp-server/index.ts).

## Disclaimer

This sample is provided to explain how to implement with Authlete and is not intended for production authorization servers.
Authlete assumes no responsibility for any direct or indirect damage or loss caused by using this implementation.
