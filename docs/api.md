<!-- docs/api.md -->
# Skuld API reference

Skuld is a personal timesheet tracker. This document is a complete reference for reading and writing its data over HTTP, written so that an agent can use it as its only context. Every example below was run against a live instance and shows its real response.

## Basics

The base URL is `http://127.0.0.1:3456` on the machine that runs the server, or `https://skuld.home.vorheim.com` on the home network. All routes are under `/api`, and `GET /api/routes` lists them all as the running server has them, with the fields each accepts. The examples set a shell variable first:

```bash
SKULD=http://127.0.0.1:3456/api
```

There is no authentication. Requests and responses are JSON; send `content-type: application/json` with every body. Every route answers 200 on success, including the ones that create records (there are no 201s).

### Field formats

- **`date`** is a local calendar day key, `YYYY-MM-DD`: the day the work belongs to in the user's own timezone. It is a plain label, never converted between timezones, and it is what range queries filter on.
- **`startedAt`, `endedAt`** are UTC ISO 8601 timestamps, such as `2026-10-20T13:15:00.000Z`. The caller converts the user's local wall-clock time to UTC: in US Eastern daylight time (UTC−4), 9:15 AM is `13:15:00.000Z`. A timestamp with an offset (`2026-10-20T09:15:00-04:00`) is also accepted, and is stored and returned as UTC. The server runs in the user's timezone.
- **`createdAt`** is the server's UTC insert time in SQLite's format, `YYYY-MM-DD HH:MM:SS` (a space, no `Z`).
- **`client`** on an entry is the client's code: 1–3 letters, stored uppercase.
- **`project`** on an entry is a project name under that client, or `""` for none.
- **`ticket`** is free text that may hold several comma-separated refs, such as `RES-1201, RES-1207`. Anything that counts tickets splits on commas, trims, and dedupes case-insensitively.
- **`externalId`** is an optional caller-chosen string key for idempotent writes (see [Idempotent writes](#idempotent-writes-with-externalid)), or `null`.
- **Minutes and hours.** An entry's duration is always computed as `(endedAt − startedAt) / 60000` minutes and is never stored. Where a response gives `hours`, it is `minutes / 60` rounded to 2 decimals, as a number (`2.75`, `1`).

### Quarter-hour rounding

The server rounds every saved entry to 15-minute boundaries in the user's favor: `startedAt` floors to the previous :00/:15/:30/:45, and `endedAt` ceils to the next one. It applies to both `POST` and `PUT`, and the response carries the rounded values. A 9:07–9:52 entry is stored as 9:00–10:00; a time already on a boundary is unchanged. Send the real times and let the server round; don't pre-round in a way that loses minutes.

### Overlaps

Overlapping entries are allowed and saved, in any order. The web UI marks double-booked time with a red "overlap" separator. Totals deliberately double-count overlapping time (the same slot can legitimately be billed to two clients), so every total is a plain sum of entry durations. The summary and weeks responses report `overlapMinutes`, the minutes a day's total exceeds the time its entries actually cover, so a reporting agent can tell when a total is inflated. Overlap is measured within a day; a range's `overlapMinutes` is the sum of its days'.

### Clients and projects are auto-created

Saving an entry with a client code or project name the catalog doesn't have adds it to the catalog: an unknown code becomes a new active client (it must be 1–3 letters, or the save is a 400), and an unknown project name becomes a new project under the entry's client. Matching is case-insensitive and the response uses the catalog's casing, so `pc` saves as `PC`. Saving under an inactive client or project is accepted and leaves it inactive. Because a typo silently creates a new client or project, **read `/api/clients` and `/api/projects` first and use the existing codes and names**.

### Errors

Every error response has the same body shape, `{ "error": "<message>" }`:

| Status | When |
| --- | --- |
| 400 | A field the route checks is wrong: end not after start, a malformed `date` or timestamp, a bad client code, a bad query parameter, a malformed setting. The message says which. |
| 400 | The request doesn't match the route's schema: a required field or query parameter missing, a field of the wrong type, or a body that isn't JSON. The message is always `Invalid request body`, query parameters included. |
| 404 | The entry, client, or project id doesn't exist, or the path isn't a route (`Not found`). |
| 409 | A duplicate: a client code or project name that already exists, or an `externalId` already held by another entry. |
| 500 | `Internal server error`; a server fault, not something a retry with the same input fixes. |

Schema mismatches are a 400 here, not the 422 the framework (Elysia) returns by default: the server maps its validation and parse errors to 400.

```bash
curl -s -X POST $SKULD/entries -H 'content-type: application/json' -d '{"date":"2026-10-20"}'
# 400 {"error":"Invalid request body"}

curl -s -X POST $SKULD/entries -H 'content-type: application/json' \
  -d '{"date":"2026-10-20","startedAt":"2026-10-20T15:00:00.000Z","endedAt":"2026-10-20T15:00:00.000Z","client":"PC"}'
# 400 {"error":"End time must be after start time"}

curl -s -X POST $SKULD/entries -H 'content-type: application/json' \
  -d '{"date":"2026-10-20","startedAt":"9:00","endedAt":"2026-10-20T15:00:00.000Z","client":"PC"}'
# 400 {"error":"startedAt must be an ISO 8601 timestamp"}

curl -s -X POST $SKULD/entries -H 'content-type: application/json' \
  -d '{"date":"2026-10-20","startedAt":"2026-10-20T17:00:00.000Z","endedAt":"2026-10-20T18:00:00.000Z","client":"ACME"}'
# 400 {"error":"Client code must be 1–3 letters"}
```

## How to report a day

1. **Learn the typical shape first.** Call `GET /api/weeks` (the two complete weeks before this one, every entry included). Look at which clients and projects are used, how notes are worded (short task names, such as `Standup` or `Route optimizer retries`), how tickets are written (`RES-1201`, bare numbers for some clients, several refs comma-separated), what time the day usually starts, and how long entries usually run. New entries should look like those. PR reviews follow a fixed form; see [Writing review notes](#writing-review-notes).
1. **Read the catalog.** `GET /api/clients` and `GET /api/projects`. Use existing active codes and names exactly; an unknown one creates a new record. `GET /api/settings` gives the preferred start time for a day's first entry.
1. **Check the day before writing.** `GET /api/entries?from=<day>&to=<day>`. The user may already have logged some or all of it by hand; don't duplicate those, and don't overwrite entries you didn't create.
1. **Post each entry with an `externalId`.** Make the key deterministic from the job and the work item, such as `daily-report:2026-10-20:pc-1`, so that re-running the job for the same day updates the same entries instead of adding new ones.
1. **Confirm with the summary.** `GET /api/summary?from=<day>&to=<day>` gives the day's totals by client and project. A nonzero `overlapMinutes` means two entries cover the same time; decide whether that's intended.

## Example: a typical day

These calls report Tuesday, 2026-10-20, in US Eastern daylight time (UTC−4).

Fetch the prior two weeks (the response is abridged below: the second week's days are elided, and they have the same shape as the first week's):

```bash
curl -s "$SKULD/weeks?count=2"
```

```json
[
  {
    "weekStart": "2026-10-04",
    "weekEnd": "2026-10-10",
    "minutes": 240,
    "hours": 4,
    "entryCount": 2,
    "overlapMinutes": 0,
    "clients": [
      { "client": "PC", "name": "PortCity Logistics", "minutes": 240, "hours": 4, "entryCount": 2 }
    ],
    "days": [
      { "date": "2026-10-04", "minutes": 0, "hours": 0, "entries": [] },
      { "date": "2026-10-05", "minutes": 0, "hours": 0, "entries": [] },
      { "date": "2026-10-06", "minutes": 0, "hours": 0, "entries": [] },
      {
        "date": "2026-10-07",
        "minutes": 240,
        "hours": 4,
        "entries": [
          {
            "id": 1,
            "date": "2026-10-07",
            "startedAt": "2026-10-07T13:00:00.000Z",
            "endedAt": "2026-10-07T13:15:00.000Z",
            "note": "Standup",
            "ticket": "",
            "client": "PC",
            "project": "Dispatch Intelligence Platform II",
            "externalId": null,
            "createdAt": "2026-10-20 15:11:57"
          },
          {
            "id": 2,
            "date": "2026-10-07",
            "startedAt": "2026-10-07T13:15:00.000Z",
            "endedAt": "2026-10-07T17:00:00.000Z",
            "note": "Load board filters",
            "ticket": "RES-1188",
            "client": "PC",
            "project": "Dispatch Intelligence Platform II",
            "externalId": null,
            "createdAt": "2026-10-20 15:11:57"
          }
        ]
      },
      { "date": "2026-10-08", "minutes": 0, "hours": 0, "entries": [] },
      { "date": "2026-10-09", "minutes": 0, "hours": 0, "entries": [] },
      { "date": "2026-10-10", "minutes": 0, "hours": 0, "entries": [] }
    ]
  },
  {
    "weekStart": "2026-10-11",
    "weekEnd": "2026-10-17",
    "minutes": 330,
    "hours": 5.5,
    "entryCount": 3,
    "overlapMinutes": 0,
    "clients": [
      { "client": "PC", "name": "PortCity Logistics", "minutes": 180, "hours": 3, "entryCount": 2 },
      { "client": "WB", "name": "Willow Bridge Properties", "minutes": 150, "hours": 2.5, "entryCount": 1 }
    ],
    "days": [
      { "date": "2026-10-11", "minutes": 0, "hours": 0, "entries": [] },
      "… seven days, 2026-10-11 through 2026-10-17, with three entries on 2026-10-12 …"
    ]
  }
]
```

List the catalog:

```bash
curl -s $SKULD/clients
```

```json
[
  { "id": 1, "code": "PC", "name": "PortCity Logistics", "active": true, "ordinal": 0 },
  { "id": 2, "code": "WB", "name": "Willow Bridge Properties", "active": true, "ordinal": 1 }
]
```

```bash
curl -s $SKULD/projects
```

```json
[
  { "id": 1, "clientId": 1, "client": "PC", "name": "Dispatch Intelligence Platform II", "active": true, "ordinal": 0 }
]
```

List what's already logged for the day (nothing yet):

```bash
curl -s "$SKULD/entries?from=2026-10-20&to=2026-10-20"
```

```json
[]
```

Post an entry with an `externalId`. Local 9:15–11:38 AM is sent as UTC; the end ceils to 11:45 (`15:45Z`):

```bash
curl -s -X POST $SKULD/entries -H 'content-type: application/json' -d '{
  "date": "2026-10-20",
  "startedAt": "2026-10-20T13:15:00.000Z",
  "endedAt": "2026-10-20T15:38:00.000Z",
  "client": "PC",
  "project": "Dispatch Intelligence Platform II",
  "note": "Route optimizer retries",
  "ticket": "RES-1201",
  "externalId": "daily-report:2026-10-20:pc-1"
}'
```

```json
{
  "id": 6,
  "date": "2026-10-20",
  "startedAt": "2026-10-20T13:15:00.000Z",
  "endedAt": "2026-10-20T15:45:00.000Z",
  "note": "Route optimizer retries",
  "ticket": "RES-1201",
  "client": "PC",
  "project": "Dispatch Intelligence Platform II",
  "externalId": "daily-report:2026-10-20:pc-1",
  "createdAt": "2026-10-20 15:11:57"
}
```

Re-post it with the same `externalId` and a revised note and ticket. The same entry (`id` 6, same `createdAt`) is updated; no second row is added:

```bash
curl -s -X POST $SKULD/entries -H 'content-type: application/json' -d '{
  "date": "2026-10-20",
  "startedAt": "2026-10-20T13:15:00.000Z",
  "endedAt": "2026-10-20T15:38:00.000Z",
  "client": "PC",
  "project": "Dispatch Intelligence Platform II",
  "note": "Route optimizer retry backoff",
  "ticket": "RES-1201, RES-1207",
  "externalId": "daily-report:2026-10-20:pc-1"
}'
```

```json
{
  "id": 6,
  "date": "2026-10-20",
  "startedAt": "2026-10-20T13:15:00.000Z",
  "endedAt": "2026-10-20T15:45:00.000Z",
  "note": "Route optimizer retry backoff",
  "ticket": "RES-1201, RES-1207",
  "client": "PC",
  "project": "Dispatch Intelligence Platform II",
  "externalId": "daily-report:2026-10-20:pc-1",
  "createdAt": "2026-10-20 15:11:57"
}
```

Two more entries were then posted the same way: a PC `Standup` from 13:00Z to 13:15Z (`daily-report:2026-10-20:pc-0`), and a WB `Vendor portal review`, ticket `2290`, no project, from 15:30Z to 16:30Z (`daily-report:2026-10-20:wb-1`), which overlaps the end of the PC entry by 15 minutes. Fetch the day's summary:

```bash
curl -s "$SKULD/summary?from=2026-10-20&to=2026-10-20"
```

```json
{
  "from": "2026-10-20",
  "to": "2026-10-20",
  "minutes": 225,
  "hours": 3.75,
  "entryCount": 3,
  "overlapMinutes": 15,
  "clients": [
    { "client": "PC", "name": "PortCity Logistics", "minutes": 165, "hours": 2.75, "entryCount": 2 },
    { "client": "WB", "name": "Willow Bridge Properties", "minutes": 60, "hours": 1, "entryCount": 1 }
  ],
  "days": [
    {
      "date": "2026-10-20",
      "minutes": 225,
      "hours": 3.75,
      "entryCount": 3,
      "overlapMinutes": 15,
      "clients": [
        {
          "client": "PC",
          "name": "PortCity Logistics",
          "minutes": 165,
          "hours": 2.75,
          "entryCount": 2,
          "tickets": ["RES-1201", "RES-1207"],
          "projects": [
            {
              "project": "Dispatch Intelligence Platform II",
              "minutes": 165,
              "hours": 2.75,
              "entryCount": 2,
              "tickets": ["RES-1201", "RES-1207"],
              "notes": ["Standup", "Route optimizer retry backoff"]
            }
          ]
        },
        {
          "client": "WB",
          "name": "Willow Bridge Properties",
          "minutes": 60,
          "hours": 1,
          "entryCount": 1,
          "tickets": ["2290"],
          "projects": [
            {
              "project": "",
              "minutes": 60,
              "hours": 1,
              "entryCount": 1,
              "tickets": ["2290"],
              "notes": ["Vendor portal review"]
            }
          ]
        }
      ]
    }
  ]
}
```

The 225 minutes include the 15 double-booked ones; the entries cover 210 minutes of wall-clock time.

## Writing review notes

A note is a list of tasks separated by `, `. When the user copies a day for the timesheet, two kinds of PR task are each merged across that client's notes for the day: reviewing PRs, and addressing review findings on PRs. A day of scattered reviews exports as a single `Review PRs 871–2, 884, 910–11, 917–25, 927–8, 930` rather than six separate tasks, and its follow-ups as a single `Address review findings on PRs 925–6, 929`. For that to work, write each as a task of its own in exactly one of these forms:

- `Review PR 924` for one PR, `Review PRs 884, 910, 911` for several: reviewing someone else's PR.
- `Address review findings on PR 938`, `Address review findings on PRs 925, 926, 929`: fixing your own PRs after a review.

In both:

- PR numbers in full, ascending, separated by `, `. Don't abbreviate them into ranges; the export does that.
- Nothing else inside the task: no qualifier such as `prettier fix`, `(stack)`, or `second round`. Doing it again for the same PR is just `Review PR 924` again, and the export dedupes it.
- Other work goes in its own task in the same note, before or after: `Dependabot sweep, Review PRs 871, 872`, or `Review PRs 927, 930, Address review findings on PRs 925, 926, 929`.

Other work on your own PRs (`GPS refresh ETL fixes, PRs 925, 926`) is ordinary text and stays as written. A task that doesn't fit its form (`Review PR 924 prettier fix`) isn't lost, but it is listed on its own as typed instead of merging.

The export also reads ranges, which hand-entered notes use (`Review PRs 723–25, 730–31`), and accepts `Reviewed` for `Review`, `Addressed` for `Address`, and `for` for `on`. `GET /api/summary` returns notes exactly as written, unmerged.

## Idempotent writes with externalId

`externalId` lets a job retry a request, or re-run a whole day, without creating duplicates.

- **`POST /api/entries` with an `externalId` no entry has yet** inserts a new entry carrying it.
- **`POST /api/entries` with an `externalId` an entry already has** updates that entry in place and returns it with 200: same `id`, same `createdAt`. The posted body replaces the entry's fields exactly as a new post would set them, so an omitted `note`, `ticket`, or `project` becomes `""`, not the old value. Rounding, validation, and catalog auto-creation apply as on any post; a request that fails validation changes nothing.
- **`POST /api/entries` without an `externalId`** (or with a blank one) always inserts, as it always has.
- The key is matched exactly (case-sensitive) after trimming surrounding whitespace, and is unique across all entries, not per day. The date can change on a repeat post; the entry moves with it.
- Both insert and update answer 200 with the entry. To tell them apart, compare `createdAt` with the request time, or check the day first.
- **`PUT /api/entries/:id`** can set, change, or clear (`null` or `""`) an entry's `externalId`. Giving it a key another entry already holds is a 409, and nothing is changed.

A worked retry: a job posts `daily-report:2026-10-20:pc-1`, and the connection drops before the response arrives, so the job can't tell whether the write landed. It simply sends the identical request again. If the first attempt did land, the second updates that same entry to the same values; if it didn't, the second inserts it. Either way the day ends with exactly one entry for that key. Re-running the whole job for the day later, with a corrected note, sends the same keys again and updates those entries in place.

Look an entry up by its key with the extra `externalId` filter on `GET /api/entries` (the date range is still required):

```bash
curl -s "$SKULD/entries?from=2026-10-20&to=2026-10-20&externalId=daily-report:2026-10-20:pc-1"
```

```json
[
  {
    "id": 6,
    "date": "2026-10-20",
    "startedAt": "2026-10-20T13:15:00.000Z",
    "endedAt": "2026-10-20T15:45:00.000Z",
    "note": "Route optimizer retry backoff",
    "ticket": "RES-1201, RES-1207",
    "client": "PC",
    "project": "Dispatch Intelligence Platform II",
    "externalId": "daily-report:2026-10-20:pc-1",
    "createdAt": "2026-10-20 15:11:57"
  }
]
```

Claiming a key held by another entry:

```bash
curl -s -X PUT $SKULD/entries/7 -H 'content-type: application/json' -d '{"externalId":"daily-report:2026-10-20:pc-1"}'
# 409 {"error":"Another entry already has externalId daily-report:2026-10-20:pc-1"}
```

## Routes

### Entry object

```json
{
  "id": 6,
  "date": "2026-10-20",
  "startedAt": "2026-10-20T13:15:00.000Z",
  "endedAt": "2026-10-20T15:45:00.000Z",
  "note": "Route optimizer retries",
  "ticket": "RES-1201",
  "client": "PC",
  "project": "Dispatch Intelligence Platform II",
  "externalId": "daily-report:2026-10-20:pc-1",
  "createdAt": "2026-10-20 15:11:57"
}
```

`note`, `ticket`, and `project` are always strings (possibly empty); `externalId` is a string or `null`.

### `GET /api/health`

Returns `{ "ok": true, "service": "skuld", "time": "<UTC ISO now>" }`.

```bash
curl -s $SKULD/health
# {"ok":true,"service":"skuld","time":"2026-10-20T15:11:57.797Z"}
```

### `GET /api/routes`

Lists every route the running server registers, read from the server's own route table rather than kept by hand, so it can't fall behind a code change. The response is `{ docs, routes }`: `docs` is this document's URL, and `routes` is in registration order, each `{ method, path }` plus `params`, `query`, and `body` for the parts the route validates, absent when it validates none. Each of those is a map of field name to type label, written like TypeScript: a trailing `?` on a name marks the field optional, `string | null` is either, and `number[]` is an array. A path or body number can also be sent as its string form (`"7"`). Only the request is described; responses and error statuses are documented in this reference.

```bash
curl -s $SKULD/routes
# {"docs":"https://github.com/MickeyMullin/skuld/blob/master/docs/api.md","routes":[
#   {"method":"GET","path":"/api/health"},
#   {"method":"GET","path":"/api/routes"},
#   {"method":"GET","path":"/api/entries","query":{"from":"string","to":"string","externalId?":"string"}},
#   ...
#   {"method":"PUT","path":"/api/entries/:id","params":{"id":"string"},"body":{"date?":"string",...,"externalId?":"string | null"}},
#   ...
#   {"method":"PUT","path":"/api/projects/order","body":{"clientId":"number","ids":"number[]"}},
#   ...
# ]}
```

### `GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD[&externalId=…]`

Returns the entries whose `date` is in the range, both ends inclusive, as an array ordered by `date`, then `startedAt`. `from` and `to` are required (missing either is `400 Invalid request body`); for one day, pass the same date for both. The optional `externalId` narrows the result to the entry carrying that key, giving `[]` or a single entry.

### `POST /api/entries`

Body:

| Field | Required | Notes |
| --- | --- | --- |
| `date` | yes | `YYYY-MM-DD`; otherwise 400 `date must be a YYYY-MM-DD date` |
| `startedAt` | yes | ISO 8601; floored to the quarter hour |
| `endedAt` | yes | ISO 8601; ceiled to the quarter hour; must be after the rounded start |
| `client` | yes | code; auto-created if unknown, and must then be 1–3 letters |
| `project` | no | name under `client`; auto-created if unknown; default `""` |
| `note` | no | default `""` |
| `ticket` | no | default `""`; stored as sent |
| `externalId` | no | see [Idempotent writes](#idempotent-writes-with-externalid) |

Returns the saved entry. Overlaps with other entries are accepted.

### `PUT /api/entries/:id`

Body: any subset of the `POST` fields, with `externalId` also accepting `null`. The fields given replace the entry's; the rest are kept. Rounding and validation are applied to the merged result, so a `PUT` that only changes `endedAt` still has it ceiled. Returns the updated entry; 404 `Entry not found` for an unknown id; 409 for an `externalId` another entry holds.

```bash
curl -s -X PUT $SKULD/entries/8 -H 'content-type: application/json' -d '{"endedAt":"2026-10-20T16:40:00.000Z"}'
# {"id":8,...,"startedAt":"2026-10-20T15:30:00.000Z","endedAt":"2026-10-20T16:45:00.000Z",...}
```

### `DELETE /api/entries/:id`

Deletes the entry permanently and returns `{ "deleted": true }`; 404 `Entry not found` for an unknown id.

### `GET /api/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

Totals over a date range, both ends inclusive, both required (the same semantics as `GET /api/entries`). 400 for a date that isn't a real `YYYY-MM-DD` day (`from must be a YYYY-MM-DD date`) or for `from` after `to` (`from must not be after to`). Response:

- `from`, `to`: the range.
- `minutes`, `hours`, `entryCount`, `overlapMinutes`: totals over the range.
- `clients`: one `{ client, name, minutes, hours, entryCount }` per client with entries in the range. `name` is the catalog's full name, `""` when it has none.
- `days`: only the days that have entries, in date order. Each is `{ date, minutes, hours, entryCount, overlapMinutes, clients }`, where each client is `{ client, name, minutes, hours, entryCount, tickets, projects }` and each project is `{ project, minutes, hours, entryCount, tickets, notes }`.

Clients are listed in their configured catalog order; projects within a client in their configured order, with no-project (`""`) first. `tickets` is the distinct ticket refs of those entries: each `ticket` field split on commas and trimmed, deduped case-insensitively keeping the first-seen casing, sorted alphabetically (case-insensitive). `notes` is the non-blank notes as typed, in start-time order, not deduped. A range with no entries returns zeros and empty `clients` and `days`. See the full example in [Example: a typical day](#example-a-typical-day).

### `GET /api/weeks?count=N&before=YYYY-MM-DD&includeCurrent=true`

Recent whole weeks of entries in one call. Weeks run Sunday through Saturday. All parameters are optional:

- `before` (default: today's date on the server, which is in the user's timezone) picks a week; the response is the `count` complete weeks that end before the week containing that date, so the current, partial week is left out.
- `count` (default 2) is a positive integer; values above 12 are capped to 12. Anything else (`0`, `-1`, `1.5`, `two`, empty) is 400 `count must be a positive integer`.
- `includeCurrent=true` appends the week containing `before` (in progress, when `before` is today) after the others. Only `true` and `false` are accepted.
- A malformed `before` is 400 `before must be a YYYY-MM-DD date`.

The response is an array of weeks, oldest first. Each week is `{ weekStart, weekEnd, minutes, hours, entryCount, overlapMinutes, clients, days }`. `weekStart` is the Sunday and `weekEnd` the Saturday; `clients` is as in the summary. `days` always holds all seven days in order, each `{ date, minutes, hours, entries }`, with `entries` the full entry objects (as `GET /api/entries` returns them) ordered by `startedAt`, and `[]` for a day with none. With `before=2026-10-14` (a Wednesday) and `count=1`, the one week returned is 2026-10-04 through 2026-10-10; with `before=2026-10-11` (a Sunday), it's the same week, since 2026-10-11 starts the next one.

### `GET /api/clients`

Every client, active or not, in configured order: `{ id, code, name, active, ordinal }[]`. `name` is the full name the copy/export output uses (blank falls back to the code); inactive clients are hidden from the web UI's pickers.

### `POST /api/clients`

Body `{ code, name?, active? }`. Appends a client after the others and returns it. 400 `Client code must be 1–3 letters`; 409 `Client PC already exists` for a duplicate code (case-insensitive).

```bash
curl -s -X POST $SKULD/clients -H 'content-type: application/json' -d '{"code":"rs","name":"Resultstack"}'
# {"id":3,"code":"RS","name":"Resultstack","active":true,"ordinal":2}
```

### `PUT /api/clients/:id`

Body: any subset of `{ code, name, active }`. Returns the client. A code change is carried onto every entry filed under the old code. 404 `Client not found`.

### `PUT /api/clients/order`

Body `{ ids }`: every client id in the new order. Returns the reordered client list.

### `GET /api/projects`

Every project, active or not: `{ id, clientId, client, name, active, ordinal }[]`, where `client` is the owning client's code, sorted by client order and then project order. A project belongs to one client; the same name under two clients is two projects.

```json
[
  { "id": 1, "clientId": 1, "client": "PC", "name": "Dispatch Intelligence Platform II", "active": true, "ordinal": 0 }
]
```

### `POST /api/projects`

Body `{ clientId, name, active? }`. Appends a project after the client's others and returns it. 400 `Project name is required`; 404 `Client not found`; 409 for a name the client already has, case-insensitively (`PC already has a project named …`).

### `PUT /api/projects/:id`

Body: any subset of `{ name, active }`. Returns the project. A rename is carried onto that client's entries. 404 `Project not found`.

### `PUT /api/projects/order`

Body `{ clientId, ids }`: that client's project ids in the new order. Returns every project.

### `GET /api/settings`, `PUT /api/settings`

`{ "preferredStartTime": "09:00" }`, an `HH:MM` local time (default `09:00`) where the web UI starts a day's first new entry. `PUT` takes any subset and returns the full settings; a malformed time is 400 `Preferred start time must be HH:MM`.
