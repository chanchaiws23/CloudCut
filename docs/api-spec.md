# CloudCut API Specification

Base URL: `http://localhost:3000`

Swagger UI: `http://localhost:3000/api/docs`

## Authentication

ทุก endpoint ยกเว้น `/auth/register`, `/auth/login`, `/auth/refresh` ต้องส่ง header:

```http
Authorization: Bearer <accessToken>
```

Error response format:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "You don't have editor access to this project",
  "timestamp": "2026-05-12T00:00:00.000Z"
}
```

## Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | register new user |
| POST | `/auth/login` | login and return access/refresh tokens |
| POST | `/auth/refresh` | refresh access token |
| GET | `/auth/me` | current user info |

## Workspaces

| Method | Path | Description |
|---|---|---|
| POST | `/workspaces` | create workspace |
| GET | `/workspaces` | list user's workspaces with cursor pagination |
| GET | `/workspaces/:id` | workspace details and members |
| POST | `/workspaces/:id/invite` | invite member by email |
| PATCH | `/workspaces/:id/members/:userId` | change member role |
| DELETE | `/workspaces/:id/members/:userId` | remove member |

## Projects

| Method | Path | Description |
|---|---|---|
| POST | `/projects` | create project |
| GET | `/projects?workspaceId=X&cursor=Y` | list projects with cursor pagination |
| GET | `/projects/:id` | project details with full timeline |
| PATCH | `/projects/:id` | update project/settings |
| DELETE | `/projects/:id` | soft delete project |
| POST | `/projects/:id/duplicate` | deep copy project |
| GET | `/projects/:id/versions` | list snapshots |
| POST | `/projects/:id/versions` | create snapshot |

## Assets

| Method | Path | Description |
|---|---|---|
| POST | `/assets/presigned-url` | get upload target |
| POST | `/assets/confirm-upload` | confirm upload and trigger processing |
| GET | `/assets?projectId=X&type=video&cursor=Y` | list assets |
| GET | `/assets/:id` | asset details and variants |
| DELETE | `/assets/:id` | soft delete asset |

## Timeline

### Tracks

| Method | Path | Description |
|---|---|---|
| POST | `/projects/:id/tracks` | add track |
| PATCH | `/projects/:id/tracks/:trackId` | update track |
| DELETE | `/projects/:id/tracks/:trackId` | delete track and clips |

### Clips

| Method | Path | Description |
|---|---|---|
| POST | `/projects/:id/clips` | add clip |
| PATCH | `/projects/:id/clips/:clipId` | update clip move/trim/transform |
| DELETE | `/projects/:id/clips/:clipId` | soft delete clip |
| POST | `/projects/:id/clips/:clipId/split` | split clip at timecode |
| POST | `/projects/:id/clips/batch` | atomic batch operations |

### Effects

| Method | Path | Description |
|---|---|---|
| POST | `/projects/:id/clips/:clipId/effects` | add effect |
| PATCH | `/projects/:id/clips/:clipId/effects/:effectId` | update effect |
| DELETE | `/projects/:id/clips/:clipId/effects/:effectId` | delete effect |
| PATCH | `/projects/:id/clips/:clipId/effects/reorder` | reorder effect stack |

### Transitions and Text

| Method | Path | Description |
|---|---|---|
| POST | `/projects/:id/transitions` | add transition |
| PATCH | `/projects/:id/transitions/:id` | update transition |
| DELETE | `/projects/:id/transitions/:id` | delete transition |
| POST | `/projects/:id/text-overlays` | add text overlay |
| PATCH | `/projects/:id/text-overlays/:id` | update text overlay |
| DELETE | `/projects/:id/text-overlays/:id` | delete text overlay |

## Exports

| Method | Path | Description |
|---|---|---|
| POST | `/projects/:id/exports` | create export job |
| GET | `/projects/:id/exports` | list exports |
| GET | `/exports/:id` | export status and download URL |
| DELETE | `/exports/:id` | cancel export |

## Collaboration

| Method | Path | Description |
|---|---|---|
| POST | `/collaboration/pusher/auth` | authenticate Pusher private/presence channel |
| GET | `/collaboration/projects/:projectId/operations?sinceSeq=N` | replay operations after reconnect |
| GET | `/collaboration/projects/:projectId/presence` | get online users tracked by backend |

## Pagination

List endpoints return:

```json
{
  "data": [],
  "nextCursor": "next-id-or-null"
}
```

Use `cursor=<nextCursor>` for the next page.
