#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const INTERNAL_BASE = "https://internal.usemotion.com";
const PUBLIC_BASE = "https://api.usemotion.com/v1";
const FIREBASE_TOKEN_URL = "https://securetoken.googleapis.com/v1/token";

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const REFRESH_TOKEN = process.env.FIREBASE_REFRESH_TOKEN;
const USER_ID = process.env.MOTION_USER_ID;
const MOTION_API_KEY = process.env.MOTION_API_KEY;
const TIMEZONE = process.env.MOTION_TIMEZONE || "America/New_York";

// Token cache
let cachedToken = null;
let tokenExpiry = 0;

async function getIdToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) {
    return cachedToken;
  }

  const res = await fetch(`${FIREBASE_TOKEN_URL}?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://app.usemotion.com/",
      Origin: "https://app.usemotion.com",
    },
    body: `grant_type=refresh_token&refresh_token=${REFRESH_TOKEN}`,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  cachedToken = data.id_token;
  tokenExpiry = Date.now() + parseInt(data.expires_in) * 1000;
  return cachedToken;
}

function internalHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json; charset=utf-8",
    "Content-Type": "application/json",
    "x-motion-timezone": TIMEZONE,
    "x-motion-client": "webapp",
    Origin: "https://app.usemotion.com",
    Referer: "https://app.usemotion.com/",
  };
}

async function internalFetch(path, options = {}) {
  const token = await getIdToken();
  const url = `${INTERNAL_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...internalHeaders(token), ...options.headers },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Motion API error (${res.status}): ${body}`);
  }

  return res.json();
}

async function publicFetch(path) {
  const res = await fetch(`${PUBLIC_BASE}${path}`, {
    headers: {
      "X-API-Key": MOTION_API_KEY,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Motion public API error (${res.status}): ${body}`);
  }

  return res.json();
}

// Tool definitions
const TOOLS = [
  {
    name: "list_calendars",
    description:
      "List all calendars connected to your Motion account. Returns calendar names, IDs, email accounts, and whether they are enabled.",
    inputSchema: {
      type: "object",
      properties: {
        enabled_only: {
          type: "boolean",
          description: "If true, only return enabled calendars",
        },
      },
    },
  },
  {
    name: "list_events",
    description:
      "List calendar events within a date range. Returns event titles, times, attendees, locations, and conference links.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
        calendar_id: {
          type: "string",
          description: "Filter to a specific calendar ID (optional)",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "search_events",
    description:
      "Search calendar events by text query. Searches event titles and descriptions.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search text to find in event titles/descriptions",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_event",
    description:
      "Create a new calendar event. Defaults to the primary calendar (nate@lorecraft.io) if no calendar_id is specified.",
    inputSchema: {
      type: "object",
      properties: {
        calendar_id: {
          type: "string",
          description:
            "Calendar ID to create the event in. Defaults to primary calendar if omitted. Use list_calendars to find IDs.",
        },
        title: { type: "string", description: "Event title" },
        start: {
          type: "string",
          description: "Start time in ISO 8601 format (e.g. 2026-04-03T14:00:00.000Z)",
        },
        end: {
          type: "string",
          description: "End time in ISO 8601 format (e.g. 2026-04-03T15:00:00.000Z)",
        },
        description: { type: "string", description: "Event description" },
        location: { type: "string", description: "Event location" },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "Array of attendee email addresses",
        },
        is_all_day: { type: "boolean", description: "Whether this is an all-day event" },
        status: {
          type: "string",
          enum: ["BUSY", "FREE"],
          description: "Event status (default: BUSY)",
        },
        visibility: {
          type: "string",
          enum: ["CONFIDENTIAL", "DEFAULT", "PUBLIC", "PRIVATE"],
          description: "Event visibility (default: DEFAULT)",
        },
        conference_type: {
          type: "string",
          enum: ["none", "zoom", "hangoutsMeet", "meet", "teamsForBusiness", "phone"],
          description: "Conference type (default: none)",
        },
      },
      required: ["title", "start", "end"],
    },
  },
  {
    name: "update_event",
    description: "Update an existing calendar event. Provide the event ID and fields to change.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "The event ID to update" },
        title: { type: "string", description: "New event title" },
        start: { type: "string", description: "New start time in ISO 8601" },
        end: { type: "string", description: "New end time in ISO 8601" },
        description: { type: "string", description: "New description" },
        location: { type: "string", description: "New location" },
      },
      required: ["event_id"],
    },
  },
  {
    name: "delete_event",
    description: "Delete a calendar event by its ID.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: { type: "string", description: "The event ID to delete" },
      },
      required: ["event_id"],
    },
  },
  {
    name: "get_tasks",
    description:
      "List tasks from Motion (via public API). Returns task names, statuses, due dates, and priorities.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["COMPLETED", "IN_PROGRESS", "TODO"],
          description: "Filter by task status",
        },
      },
    },
  },
  {
    name: "check_availability",
    description:
      "Find free time slots in a date range. Returns available slots during working hours (9am-6pm in configured timezone) based on gaps between existing calendar events.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
        duration_minutes: {
          type: "number",
          description: "Minimum slot duration in minutes (default 30)",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_teammate_events",
    description:
      "See teammate calendar events (busy/out-of-office) within a date range. Provide teammate user IDs to check their schedules.",
    inputSchema: {
      type: "object",
      properties: {
        teammate_user_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of teammate Motion user IDs",
        },
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
      },
      required: ["teammate_user_ids", "start_date", "end_date"],
    },
  },
  {
    name: "get_allday_events",
    description:
      "List all-day events within a date range. Filters to only return events marked as all-day (e.g. holidays, PTO, deadlines).",
    inputSchema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
        calendar_id: {
          type: "string",
          description: "Filter to a specific calendar ID (optional)",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "sync_calendars",
    description:
      "Force a calendar sync with Google/Outlook to refresh the calendar list and pull latest events.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "manage_calendars",
    description:
      "Enable or disable a calendar in Motion. Use list_calendars to find calendar IDs first.",
    inputSchema: {
      type: "object",
      properties: {
        calendar_id: {
          type: "string",
          description: "The calendar ID to enable or disable",
        },
        enabled: {
          type: "boolean",
          description: "Set to true to enable, false to disable",
        },
      },
      required: ["calendar_id", "enabled"],
    },
  },
];

// Primary calendar cache
let cachedPrimaryCalendar = null;

async function getPrimaryCalendar() {
  if (cachedPrimaryCalendar) return cachedPrimaryCalendar;
  const data = await internalFetch("/v2/calendars");
  const mainId = data.mainCalendarId;
  const cal = (data.calendars || []).find((c) => c.id === mainId);
  if (cal) {
    cachedPrimaryCalendar = { id: cal.id, email: cal.providerId };
  }
  return cachedPrimaryCalendar;
}

// Tool handlers
async function handleListCalendars(args) {
  const data = await internalFetch("/v2/calendars");
  let calendars = data.calendars || [];

  if (args.enabled_only) {
    calendars = calendars.filter((c) => c.isEnabled);
  }

  const formatted = calendars.map((c) => ({
    id: c.id,
    title: c.title,
    email: c.providerId,
    isPrimary: c.isPrimary,
    isEnabled: c.isEnabled,
    accessRole: c.accessRole,
    type: c.type,
  }));

  return {
    mainCalendarId: data.mainCalendarId,
    calendars: formatted,
  };
}

async function handleListEvents(args) {
  const data = await internalFetch("/v3/calendar-events/scheduling-assistant", {
    method: "POST",
    body: JSON.stringify({
      userIds: [USER_ID],
      range: { start: args.start_date, end: args.end_date },
    }),
  });

  const userEvents = data[USER_ID];
  if (!userEvents) return { events: [] };

  let events = userEvents.events || [];

  if (args.calendar_id) {
    events = events.filter((e) => e.calendarId === args.calendar_id);
  }

  return {
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      isAllDay: e.isAllDay,
      status: e.status,
      location: e.location,
      conferenceLink: e.conferenceLink,
      description: e.description?.substring(0, 500),
      calendarId: e.calendarId,
      attendees: e.attendees?.map((a) => ({
        email: a.email,
        status: a.status,
        isOrganizer: a.isOrganizer,
      })),
      organizer: e.organizer?.email,
    })),
  };
}

async function handleSearchEvents(args) {
  const data = await internalFetch(
    `/v2/calendar_events/search?query=${encodeURIComponent(args.query)}`
  );
  return data;
}

async function handleCreateEvent(args) {
  // Resolve calendar — default to primary if not specified
  let calendarId = args.calendar_id;
  let organizerEmail;

  if (calendarId) {
    const calData = await internalFetch("/v2/calendars");
    const calendar = (calData.calendars || []).find((c) => c.id === calendarId);
    organizerEmail = calendar?.providerId || "";
  } else {
    const primary = await getPrimaryCalendar();
    calendarId = primary.id;
    organizerEmail = primary.email;
  }

  const body = {
    title: args.title,
    start: args.start,
    end: args.end,
    isAllDay: args.is_all_day || false,
    status: args.status || "BUSY",
    visibility: args.visibility || "DEFAULT",
    timezone: TIMEZONE,
    conferenceType: args.conference_type || "none",
    organizer: { email: organizerEmail, userId: USER_ID },
    attendees: [],
  };

  // Add organizer as first attendee
  body.attendees.push({
    email: organizerEmail,
    isOptional: false,
    isOrganizer: true,
  });

  // Add additional attendees
  if (args.attendees) {
    for (const email of args.attendees) {
      body.attendees.push({
        email,
        isOptional: false,
        isOrganizer: false,
      });
    }
  }

  if (args.description) body.description = args.description;
  if (args.location) body.location = args.location;

  const data = await internalFetch(
    `/v3/calendar-events/${calendarId}`,
    { method: "POST", body: JSON.stringify(body) }
  );

  return data;
}

async function handleUpdateEvent(args) {
  const body = {};
  if (args.title) body.title = args.title;
  if (args.start) body.start = args.start;
  if (args.end) body.end = args.end;
  if (args.description) body.description = args.description;
  if (args.location) body.location = args.location;

  const data = await internalFetch(`/v3/calendar-events/${args.event_id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return data;
}

async function handleDeleteEvent(args) {
  const token = await getIdToken();
  const res = await fetch(
    `${INTERNAL_BASE}/v2/calendar_events/${args.event_id}`,
    {
      method: "DELETE",
      headers: internalHeaders(token),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Delete failed (${res.status}): ${body}`);
  }

  return { success: true, deletedId: args.event_id };
}

async function handleGetTasks(args) {
  let path = "/tasks?";
  if (args.status) path += `status=${args.status}&`;
  const data = await publicFetch(path);
  return data;
}

async function handleCheckAvailability(args) {
  const durationMinutes = args.duration_minutes || 30;

  const data = await internalFetch("/v3/calendar-events/scheduling-assistant", {
    method: "POST",
    body: JSON.stringify({
      userIds: [USER_ID],
      range: { start: args.start_date, end: args.end_date },
    }),
  });

  const userEvents = data[USER_ID];
  const events = userEvents?.events || [];

  // Filter to non-all-day events and sort by start time
  const timedEvents = events
    .filter((e) => !e.isAllDay)
    .map((e) => ({
      start: new Date(e.start),
      end: new Date(e.end),
      title: e.title,
    }))
    .sort((a, b) => a.start - b.start);

  // Build date range using string-based date iteration to avoid timezone issues
  const slots = [];
  const WORK_START_HOUR = 9;
  const WORK_END_HOUR = 18;

  // Parse start/end as YYYY-MM-DD strings and iterate by date string
  const dateStrings = [];
  const [sy, sm, sd] = args.start_date.split("-").map(Number);
  const [ey, em, ed] = args.end_date.split("-").map(Number);
  const endMs = new Date(ey, em - 1, ed).getTime();

  for (let dt = new Date(sy, sm - 1, sd); dt.getTime() <= endMs; dt.setDate(dt.getDate() + 1)) {
    const dayOfWeek = dt.getDay();
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    dateStrings.push(`${y}-${m}-${day}`);
  }

  for (const dateStr of dateStrings) {
    const dayStart = new Date(`${dateStr}T${String(WORK_START_HOUR).padStart(2, "0")}:00:00`);
    const dayEnd = new Date(`${dateStr}T${String(WORK_END_HOUR).padStart(2, "0")}:00:00`);

    // Get events for this day
    const dayEvents = timedEvents.filter(
      (e) => e.start < dayEnd && e.end > dayStart
    );

    // Find gaps
    let cursor = dayStart;
    for (const evt of dayEvents) {
      const evtStart = evt.start < dayStart ? dayStart : evt.start;
      const evtEnd = evt.end > dayEnd ? dayEnd : evt.end;

      if (evtStart > cursor) {
        const gapMinutes = (evtStart - cursor) / 60_000;
        if (gapMinutes >= durationMinutes) {
          slots.push({
            date: dateStr,
            start: cursor.toISOString(),
            end: evtStart.toISOString(),
            duration_minutes: Math.round(gapMinutes),
          });
        }
      }
      if (evtEnd > cursor) {
        cursor = evtEnd;
      }
    }

    // Gap after last event until end of working hours
    if (cursor < dayEnd) {
      const gapMinutes = (dayEnd - cursor) / 60_000;
      if (gapMinutes >= durationMinutes) {
        slots.push({
          date: dateStr,
          start: cursor.toISOString(),
          end: dayEnd.toISOString(),
          duration_minutes: Math.round(gapMinutes),
        });
      }
    }
  }

  return {
    timezone: TIMEZONE,
    working_hours: `${WORK_START_HOUR}:00 - ${WORK_END_HOUR}:00`,
    minimum_duration_minutes: durationMinutes,
    available_slots: slots,
    total_slots: slots.length,
  };
}

async function handleGetTeammateEvents(args) {
  const data = await internalFetch("/v3/calendar-events/scheduling-assistant", {
    method: "POST",
    body: JSON.stringify({
      userIds: args.teammate_user_ids,
      range: { start: args.start_date, end: args.end_date },
    }),
  });

  const results = {};
  for (const userId of args.teammate_user_ids) {
    const userData = data[userId];
    if (!userData) {
      results[userId] = { events: [], error: "No data returned for this user" };
      continue;
    }

    const events = (userData.events || []).map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      isAllDay: e.isAllDay,
      status: e.status,
      location: e.location,
      organizer: e.organizer?.email,
    }));

    results[userId] = { events, total: events.length };
  }

  return { teammates: results };
}

async function handleGetAlldayEvents(args) {
  const data = await internalFetch("/v3/calendar-events/scheduling-assistant", {
    method: "POST",
    body: JSON.stringify({
      userIds: [USER_ID],
      range: { start: args.start_date, end: args.end_date },
    }),
  });

  const userEvents = data[USER_ID];
  if (!userEvents) return { events: [], total: 0 };

  let events = (userEvents.events || []).filter((e) => e.isAllDay === true);

  if (args.calendar_id) {
    events = events.filter((e) => e.calendarId === args.calendar_id);
  }

  return {
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      status: e.status,
      calendarId: e.calendarId,
      description: e.description?.substring(0, 500),
    })),
    total: events.length,
  };
}

async function handleSyncCalendars() {
  const data = await internalFetch("/v2/calendars/sync", {
    method: "POST",
    body: JSON.stringify({}),
  });

  return { success: true, message: "Calendar sync triggered", data };
}

async function handleManageCalendars(args) {
  const data = await internalFetch(`/v2/calendars/${args.calendar_id}`, {
    method: "PATCH",
    body: JSON.stringify({ isEnabled: args.enabled }),
  });

  return {
    success: true,
    calendar_id: args.calendar_id,
    enabled: args.enabled,
    data,
  };
}

// Server setup
const server = new Server(
  { name: "motion-calendar", version: "2.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    switch (name) {
      case "list_calendars":
        result = await handleListCalendars(args || {});
        break;
      case "list_events":
        result = await handleListEvents(args);
        break;
      case "search_events":
        result = await handleSearchEvents(args);
        break;
      case "create_event":
        result = await handleCreateEvent(args);
        break;
      case "update_event":
        result = await handleUpdateEvent(args);
        break;
      case "delete_event":
        result = await handleDeleteEvent(args);
        break;
      case "get_tasks":
        result = await handleGetTasks(args || {});
        break;
      case "check_availability":
        result = await handleCheckAvailability(args);
        break;
      case "get_teammate_events":
        result = await handleGetTeammateEvents(args);
        break;
      case "get_allday_events":
        result = await handleGetAlldayEvents(args);
        break;
      case "sync_calendars":
        result = await handleSyncCalendars();
        break;
      case "manage_calendars":
        result = await handleManageCalendars(args);
        break;
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
