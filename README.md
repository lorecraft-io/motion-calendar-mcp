# Motion Calendar MCP

**Full calendar access for Claude Code -- events, availability, scheduling. What Motion's public API should have been.**

[![npm version](https://img.shields.io/npm/v/motion-calendar-mcp)](https://www.npmjs.com/package/motion-calendar-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-green)](https://modelcontextprotocol.io)

---

## How It Works

Once installed, you just talk to Claude. No commands to memorize, no special syntax, no API calls to learn. You speak in plain English and Claude handles the rest.

```
You:    "What's on my calendar today?"
You:    "Am I free Thursday afternoon?"
You:    "Schedule a meeting called Team Sync tomorrow at 2pm for 30 minutes"
You:    "Move my 3pm to 4pm"
You:    "Cancel the standup on Friday"
You:    "Search my calendar for anything about onboarding"
You:    "Is Sarah busy Wednesday morning?"
```

That's it. Claude sees your calendars, understands your schedule, and takes action -- all through natural conversation. No buttons, no UI, no context switching. You stay in your terminal and your calendar stays in sync.

---

## Why This Exists

Motion's public API has 27 endpoints. Zero of them touch calendar events.

You can create tasks. You can manage projects. You can set custom fields, list workspaces, configure recurring tasks, and query every status under the sun. But you cannot read, create, update, or delete a single calendar event.

For a product that bills itself as an intelligent calendar, that is a remarkable omission.

This MCP server fills that gap. It uses Motion's internal API -- the same one their own web app uses -- to give Claude Code full read/write access to your calendar. Events, availability, search, the works.

## How This Compares to Other Motion MCPs

Every other Motion MCP is limited to what the public API exposes: tasks and projects. This is the only one with calendar event access.

| Feature | motion-calendar-mcp | motion (built-in) | @rf-d/motion-mcp | h3ro-dev/motion-mcp-server |
|---|---|---|---|---|
| Calendar events (read) | **Yes** | No | No | No |
| Calendar events (create) | **Yes** | No | No | No |
| Calendar events (update) | **Yes** | No | No | No |
| Calendar events (delete) | **Yes** | No | No | No |
| Event search | **Yes** | No | No | No |
| Availability checking | **Yes** | No | No | No |
| Teammate visibility | **Yes** | No | No | No |
| All-day event queries | **Yes** | No | No | No |
| Calendar sync trigger | **Yes** | No | No | No |
| Calendar management | **Yes** | No | No | No |
| Calendar listing | **Yes** | No | No | No |
| Task management | Yes | Yes | Yes | Yes |
| Total tools | **12** | 10 | 32 | 20 |
| Uses internal API | Yes | No | No | No |
| Auth complexity | Higher (Firebase) | API key only | API key only | API key only |

The tradeoff is clear: this MCP requires a few extra setup steps because it authenticates through Firebase (the same way the Motion web app does). In exchange, you get access to the entire calendar surface that every other integration is locked out of.

## Features

### Calendar Tools (Internal API)

| Tool | Description |
|---|---|
| `list_calendars` | List all calendars connected to your Motion account -- names, IDs, email accounts, enabled status |
| `list_events` | Fetch events within a date range with full details: titles, times, attendees, locations, conference links |
| `search_events` | Search events by text query across titles and descriptions |
| `create_event` | Create a new event with title, time, description, location, and attendees. Defaults to primary calendar if no calendar ID is specified. Automatically sets organizer, status, visibility, and timezone. |
| `update_event` | Modify an existing event -- change title, time, description, or location |
| `delete_event` | Remove an event by ID |
| `check_availability` | Find free time slots across all your calendars. Scans working hours (9am-6pm, weekdays) and returns open gaps of any minimum duration |
| `get_teammate_events` | See when teammates are busy or out of office. Pass their user IDs and get their calendar events for any date range |
| `get_allday_events` | List all-day events separately (out of office, holidays, deadlines) with optional calendar filtering |
| `sync_calendars` | Force a sync between Motion and your calendar providers (Google, Outlook). Useful when events were just added externally |
| `manage_calendars` | Enable or disable specific calendars in your Motion account |

### Task Tools (Public API)

| Tool | Description |
|---|---|
| `get_tasks` | List tasks with optional status filtering (TODO, IN_PROGRESS, COMPLETED) |

## Quick Install

One command. That is it.

```bash
claude mcp add motion-calendar -- npx -y motion-calendar-mcp
```

Then configure your credentials (see Setup below) and restart Claude Code.

## Setup

This MCP needs four credentials. The Motion API key is straightforward. The other three require extracting values from your browser -- this is because Motion's calendar endpoints are only accessible through their internal authentication flow.

### Step 1: Get your Motion API key

1. Open [Motion](https://app.usemotion.com)
2. Go to **Settings** > **API**
3. Generate or copy your API key

### Step 2: Get your Firebase credentials

The internal API authenticates through Firebase. You need two values: a Firebase API key and a refresh token.

1. Open [app.usemotion.com](https://app.usemotion.com) in Chrome
2. Open DevTools (`Cmd+Option+I` on Mac, `Ctrl+Shift+I` on Windows/Linux)
3. Navigate to **Application** > **IndexedDB** > **firebaseLocalStorageDb** > **firebaseLocalStorage**
4. Click the entry in the table. You will see a JSON object in the panel below.
5. Find `value` > `stsTokenManager` > `refreshToken` -- copy this entire string. This is your `FIREBASE_REFRESH_TOKEN`.
6. For the `FIREBASE_API_KEY`: look at any network request URL in the DevTools Network tab that goes to `googleapis.com`. The `key=` parameter in the URL is your Firebase API key (it starts with `AIza`).

### Step 3: Get your Motion User ID

Your user ID is visible in the same IndexedDB entry from Step 2. Look for the `uid` field in the JSON object. It is a string of letters and numbers (e.g., `abc123def456...`).

Alternatively, you can find it in the Network tab by inspecting request payloads to `internal.usemotion.com` -- the `userId` field appears in several endpoints.

### Step 4: Configure your environment

Create a `.env` file in the project root (or set these as environment variables):

```bash
MOTION_API_KEY=your_motion_api_key_here
FIREBASE_API_KEY=your_firebase_api_key_here
FIREBASE_REFRESH_TOKEN=your_firebase_refresh_token_here
MOTION_USER_ID=your_motion_user_id_here
```

You can also pass these as environment variables in the Claude MCP config:

```json
{
  "mcpServers": {
    "motion-calendar": {
      "command": "npx",
      "args": ["-y", "motion-calendar-mcp"],
      "env": {
        "MOTION_API_KEY": "your_motion_api_key_here",
        "FIREBASE_API_KEY": "your_firebase_api_key_here",
        "FIREBASE_REFRESH_TOKEN": "your_firebase_refresh_token_here",
        "MOTION_USER_ID": "your_motion_user_id_here"
      }
    }
  }
}
```

## Usage Examples

Once installed and configured, just talk to Claude naturally:

**Check your schedule**
> "What's on my calendar today?"

**Find free time**
> "When am I free tomorrow afternoon?"

**Create events**
> "Create a meeting called 'Team Sync' tomorrow at 2pm for 30 minutes"
> "Schedule a call with drew@example.com at 5:30pm today"

**Search your calendar**
> "Search my calendar for anything about 'standup' this week"

**Modify events**
> "Move my 3pm meeting to 4pm"

**Remove events**
> "Delete the event titled 'Cancelled Meeting'"

**List calendars**
> "Which calendars do I have connected?"

**Check tasks**
> "What tasks do I have in progress?"

## Configuration Reference

| Variable | Required | Description |
|---|---|---|
| `MOTION_API_KEY` | Yes | Your Motion API key from Settings > API |
| `FIREBASE_API_KEY` | Yes | Firebase API key extracted from browser (starts with `AIza`) |
| `FIREBASE_REFRESH_TOKEN` | Yes | Firebase refresh token from IndexedDB |
| `MOTION_USER_ID` | Yes | Your Motion user ID from IndexedDB or network requests |

| `MOTION_TIMEZONE` | No | IANA timezone for calendar operations (default: `America/New_York`). Set during install or in your `.env` file. |

The timezone is used for API headers and is automatically included when creating events.

## Important Notes

**Firebase token expiration.** The refresh token lasts approximately 6 months. If you start seeing authentication errors, re-extract the refresh token from your browser using the steps in Setup. The Firebase API key does not expire.

**Internal API stability.** This MCP uses Motion's internal API, which is undocumented and could change without notice. That said, Motion's internal endpoints have been stable for a long time -- they are the backbone of their own web app, so breaking changes are rare and usually accompanied by a frontend update that makes them easy to track.

**Rate limits.** Motion's public API enforces strict rate limits (12 requests per minute). The internal API is more generous since it is designed for interactive web app usage, but be reasonable. Avoid running tight loops or bulk operations.

**Security.** Your Firebase refresh token grants access to your Motion account. Treat it like a password. Do not commit your `.env` file to version control. The `.gitignore` should already exclude it, but verify.

## Development

```bash
# Clone the repo
git clone https://github.com/lorecraft-io/motion-calendar-mcp.git
cd motion-calendar-mcp

# Install dependencies
npm install

# Configure credentials
cp .env.example .env
# Edit .env with your credentials

# Run directly
npm start
```

## Under the Hood

The server runs as a stdio-based MCP server using the official `@modelcontextprotocol/sdk`. Calendar operations go through Motion's internal API (`internal.usemotion.com`), authenticating via Firebase ID tokens. Task operations use the standard public API (`api.usemotion.com/v1`) with your API key.

Token management is handled automatically -- the server caches Firebase ID tokens and refreshes them before expiry so you never hit auth errors during a session.

## License

MIT -- see [LICENSE](LICENSE) for details.

---

Built by [Nathan Davidovich / Lorecraft](https://github.com/lorecraft-io)
