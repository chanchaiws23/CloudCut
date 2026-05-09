# CloudCut — Database Design

## Entity Relationship Overview

```
User ──< WorkspaceMember >── Workspace ──< Project
                                              │
                          ┌───────────────────┤
                          │                   │
                         Asset              Track
                          │                   │
                     AssetVariant           Clip ──< ClipEffect
                                             │
                                         Transition
                                         TextOverlay
                                         ExportJob
                                         OperationLog
```

## Key Design Decisions

### Absolute Timeline Positions
Clips use `track_position_ms` (absolute ms from timeline start) rather than relative-to-previous. This allows:
- O(1) position queries
- Independent concurrent editing of different clips
- Simple overlap detection

### Soft Delete Strategy
`deleted_at` nullable timestamp on: User, Project, Asset, Clip.
- App filters `WHERE deleted_at IS NULL` for normal reads
- Hard delete runs via cleanup cron after grace period
- Cascade: `onDelete: Cascade` in Prisma handles relational cleanup on hard delete

### JSON Fields
`transform`, `params`, `settings`, `metadata` stored as JSON:
- Avoids schema migrations for new effect types / transform properties
- Queried rarely (only on clip load, not in list queries)
- Validated at application layer via class-validator

### Indexes
| Table | Index | Purpose |
|-------|-------|---------|
| clips | (trackId, trackPositionMs) | Timeline rendering — fetch clips on track ordered by position |
| clips | (projectId, deletedAt) | Full project load |
| assets | (projectId, status) | Filter ready assets for project |
| operation_logs | (projectId, createdAt) | Reconnect sync — get ops since timestamp |
| export_jobs | (status, expiresAt) | Cleanup cron — find expired exports |

### OperationLog Partitioning Plan
For projects with heavy collaboration, `operation_logs` can grow large. Planned strategy:
1. PostgreSQL range partitioning by `created_at` (monthly)
2. Archive partitions older than 30 days to cold storage
3. Keep only last N operations in hot table per project
