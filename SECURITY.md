# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x     | Yes       |
| < 2.0   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Email: nate@lorecraft.io
3. Include: description of the vulnerability, steps to reproduce, and potential impact.
4. You will receive acknowledgment within 48 hours.

## Credential Model

This MCP server uses Firebase refresh tokens and Motion API keys stored in a local `.env` file with `chmod 600` permissions. These credentials grant full access to your Motion calendar.

**If you suspect your credentials have been compromised:**

1. Rotate your Motion API key at https://app.usemotion.com/settings
2. Sign out of all Motion browser sessions to invalidate the Firebase refresh token
3. Re-run the setup wizard: `npx @lorecraft/motion-mcp setup`

## Scope

- Source code in this repository
- Published npm package (`@lorecraft/motion-mcp`)
- GitHub Actions workflows
