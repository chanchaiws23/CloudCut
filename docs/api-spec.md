# CloudCut API Specification

## Base URL
`http://localhost:3000`

## Authentication
All endpoints (except `/auth/register` and `/auth/login`) require:
```
Authorization: Bearer <accessToken>
```

## Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Register new user |
| POST | /auth/login | Login → JWT tokens |
| POST | /auth/refresh | Refresh access token |
| GET | /auth/me | Current user info |

### Workspaces
| Method | Path | Description |
|--------|------|-------------|
| POST | /workspaces | Create workspace |
| GET | /workspaces | List user's workspaces |
| GET | /workspaces/:id | Workspace + members |
| POST | /workspaces/:id/invite | Invite member by email |
| PATCH | /workspaces/:id/members/:userId | Change member role |
| DELETE | /workspaces/:id/members/:userId | Remove member |

### Projects
| Method | Path | Description |
|--------|------|-------------|
| POST | /projects | Create project |
| GET | /projects?workspaceId=X&cursor=Y | List projects (paginated) |
| GET | /projects/:id | Full project + timeline data |
| PATCH | /projects/:id | Update settings |
| DELETE | /projects/:id | Soft delete |
| POST | /projects/:id/duplicate | Deep copy project |

### Assets
| Method | Path | Description |
|--------|------|-------------|
| POST | /assets/presigned-url | Get upload URL |
| POST | /assets/confirm-upload | Confirm upload → trigger processing |
| GET | /assets?projectId=X | List assets |
| GET | /assets/:id | Asset + variants |
| DELETE | /assets/:id | Soft delete |

### Timeline
| Method | Path | Description |
|--------|------|-------------|
| POST | /projects/:id/tracks | Add track |
| PATCH | /projects/:id/tracks/:trackId | Update track |
| DELETE | /projects/:id/tracks/:trackId | Delete track |
| POST | /projects/:id/clips | Add clip |
| PATCH | /projects/:id/clips/:clipId | Update clip (move/trim) |
| DELETE | /projects/:id/clips/:clipId | Soft delete clip |
| POST | /projects/:id/clips/:clipId/split | Split at timecode |
| POST | /projects/:id/clips/:clipId/effects | Add effect |
| PATCH | /projects/:id/clips/:clipId/effects/:effectId | Update effect |
| DELETE | /projects/:id/clips/:clipId/effects/:effectId | Delete effect |
| POST | /projects/:id/transitions | Add transition |
| PATCH | /projects/:id/transitions/:id | Update transition |
| DELETE | /projects/:id/transitions/:id | Delete transition |
| POST | /projects/:id/text-overlays | Add text overlay |
| PATCH | /projects/:id/text-overlays/:id | Update text overlay |
| DELETE | /projects/:id/text-overlays/:id | Delete text overlay |

### Exports
| Method | Path | Description |
|--------|------|-------------|
| POST | /projects/:id/exports | Create export job |
| GET | /projects/:id/exports | List exports |
| GET | /exports/:id | Export status + download URL |
| DELETE | /exports/:id | Cancel export |

### Collaboration
| Method | Path | Description |
|--------|------|-------------|
| POST | /collaboration/pusher/auth | Authenticate Pusher channel |
| GET | /collaboration/projects/:id/operations?sinceSeq=N | Get operations since seq (reconnect sync) |
| GET | /collaboration/projects/:id/presence | Get online users |

## Error Response Format
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "You don't have editor access to this project",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Swagger UI
Available at `http://localhost:3000/api/docs` when the backend is running.
