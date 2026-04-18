# Changelog

All notable changes to `fidgetcoding-motion-mcp` are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note on package name:** This package was originally published as `motion-calendar-mcp` on npm. Renamed to `fidgetcoding-motion-mcp` on 2026-04-18 under the FidgetCoding brand umbrella (after briefly trying the scoped `@lorecraft/motion-mcp` as an intermediate stop — bare `motion-mcp` was blocked by an unrelated `motionmcp` package on npm). The old `motion-calendar-mcp` package is unpublished from npm; the GitHub repo was renamed from `lorecraft-io/motion-calendar-mcp` → `lorecraft-io/motion-mcp` (GitHub 301 redirects the old URL).

## [2.1.0] - 2026-04-18

### Changed
- **npm package renamed to `fidgetcoding-motion-mcp`** (was `motion-calendar-mcp`; briefly `@lorecraft/motion-mcp`). Install command updated across docs.
- **GitHub repo renamed to `lorecraft-io/motion-mcp`** (was `motion-calendar-mcp`). Old URL 301-redirects.
- README v2: Quick Navigation table, banner image, tagline polish ("Full calendar access for Claude Code — events, availability, scheduling"), low-maintenance-mode callout (Nate moved to Morgen for personal use; Motion MCP stays live for users who prefer Motion).
- README banner image link swapped to absolute `raw.githubusercontent.com` URL so the banner renders on npmjs.com as well as GitHub.
- README example prompts: `drew@example.com` → `teammate@example.com`; `"Drew <> Nate 1:1"` → `"Weekly 1:1"` (public example placeholders scrubbed of real names).
- `.env.example` header refreshed: "Motion Calendar MCP Configuration" → "Motion MCP Configuration"; setup URL updated to the renamed repo.
- `package-lock.json` regenerated with the correct package name field.
- Git history: `Co-Authored-By: claude-flow <ruv@ruv.net>` trailer stripped from all commits; `Nathan Davidovich` author fields rewritten to `Nate Davidovich`.

### Added
- `bugs.url` in `package.json`.
- `CHANGELOG.md` (this file).

### Dependencies
- All dependencies pinned to exact versions (removed `^` carets) for reproducible builds.

## [2.0.0] and earlier

Pre-rename history is preserved in `git log` under the old `motion-calendar-mcp` authorship and package name. The 2.0.0 line shipped the initial hardened MCP server for Motion calendar — Firebase refresh-token auth, internal API routing for event CRUD / availability / teammate visibility, Motion API key for tasks. Public Motion API (`api.usemotion.com/v1`) is tasks-only; this MCP routes events through the internal Firebase-authed endpoints.

12 tools (unchanged across rename): `list_calendars`, `list_events`, `search_events`, `create_event`, `update_event`, `delete_event`, `check_availability`, `get_teammate_events`, `get_allday_events`, `sync_calendars`, `manage_calendars`, `get_tasks`.
