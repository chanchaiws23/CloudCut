# Backend Design Decisions

## Task 1: Database Schema

### 1. Normalize vs Denormalize
- **Normalized** for core entities (User, Workspace, Project, Track, Clip) to avoid update anomalies and ensure data integrity.
- **Denormalized** `durationMs` on Clip (computed from `outPointMs - inPointMs`) for read performance — timeline rendering queries this field heavily. Kept in sync via service layer.
- JSON columns for `transform`, `params`, `settings`, `metadata` — flexible schema for frequently-changing structures without migrations.

### 2. Soft Delete Strategy
- `deletedAt` field on User, Project, Asset, Clip.
- Cascade behavior: Prisma `onDelete: Cascade` handles hard deletes. Soft deletes are handled at the application layer — when a project is soft-deleted, its clips/tracks remain but are filtered by `deletedAt: null` in queries.
- Cleanup processor runs daily to hard-delete records older than 30 days (projects), 7 days (orphaned assets), 90 days (users — GDPR compliance).

### 3. Why `track_position_ms` instead of relative-to-previous-clip?
- **Absolute positioning** is simpler for concurrent editing — two users can move different clips without recalculating chains.
- Relative positioning would require recalculating all subsequent clips on every move/insert, causing O(n) updates and complex conflict resolution.
- Absolute positions make snap-to-grid, overlap detection, and timeline rendering straightforward.

### 4. OperationLog Growth & Archival
- Indexed on `(projectId, createdAt)` and `(projectId, clientSeq)` for efficient queries.
- **Archival strategy:** Move logs older than 30 days to a separate `operation_logs_archive` table or cold storage (S3). Keep only last 1000 operations per project in hot table.
- **Partitioning:** Use PostgreSQL table partitioning by `created_at` (monthly ranges) for projects with heavy collaboration.

### 5. Storage Estimation (1,000 users × 10 projects × 30 clips)
| Table | Rows | Avg Row Size | Total |
|-------|------|-------------|-------|
| users | 1,000 | 500B | 500KB |
| workspaces | ~500 | 300B | 150KB |
| workspace_members | ~2,000 | 200B | 400KB |
| projects | 10,000 | 500B | 5MB |
| tracks | 30,000 | 200B | 6MB |
| clips | 300,000 | 400B | 120MB |
| clip_effects | 600,000 | 300B | 180MB |
| operation_logs | ~3M | 500B | 1.5GB |
| **Total** | | | **~2GB** |

---

## Task 2: NestJS API

### 1. Cursor-based vs Offset-based Pagination
- **Cursor-based** avoids the "skipping rows" performance issue on large datasets. Offset-based with `OFFSET 10000` scans and discards 10K rows.
- Consistent results when data is inserted/deleted during pagination.
- Uses primary key (UUID) as cursor — stable ordering via `createdAt DESC`.

### 2. Presigned Upload Flow
- Client requests presigned URL → API creates Asset record with `uploading` status → Client uploads directly to S3/R2 → Client calls `confirm-upload` → API marks as `processing` → triggers BullMQ pipeline.
- **Why not upload through backend?** Large video files (100MB+) would block API threads, consume memory, and increase latency. Direct-to-storage uploads scale independently.

### 3. Batch Clip Operations — Atomic (Transaction)
- Batch operations use `$transaction` for atomicity — either all succeed or none.
- Prevents inconsistent timeline state (e.g., half the clips moved, half not).
- Trade-off: slightly higher latency for batch ops, but data integrity is critical for collaborative editing.

### 4. API Versioning Strategy
- URL prefix versioning: `/api/v1/`, `/api/v2/`.
- Breaking changes would be deployed as new version while maintaining old endpoints for 6 months.
- Non-breaking additions (new fields, new endpoints) don't require version bump.

---

## Task 3: Queue & fluent-ffmpeg

### 1. Why BullMQ?
- **BullMQ:** Built on Redis, mature Node.js ecosystem, supports job priorities, retry with backoff, progress tracking, dead letter queues, rate limiting, delayed jobs.
- **vs Cloudflare Queues:** Vendor lock-in, limited retry config, no job progress tracking.
- **vs SQS:** External dependency, higher latency, no built-in progress tracking, more complex for job dependencies.

### 2. fluent-ffmpeg on Node.js
- Uses native ffmpeg binary via child process — fast, full codec support, handles large files via disk streaming.
- **ffmpeg-static** ensures the ffmpeg binary is bundled and works across platforms without requiring system installation.
- Suitable for all video processing: metadata extraction, proxy generation, thumbnail extraction, waveform data, export rendering.
- **vs ffmpeg.wasm:** WASM is browser-only and memory-bound. fluent-ffmpeg is the correct choice for server-side Node.js processing.

### 3. Memory for 30-minute video
- 30-min 1080p video ≈ 500MB-2GB raw.
- **Strategy:** Stream processing where possible, process in chunks (segment rendering), limit concurrent jobs per worker (1-2), set Node.js `--max-old-space-size=4096`.
- For very large files, fall back to native ffmpeg or cloud transcoding (AWS MediaConvert).

### 4. Dead Letter Queue
- Jobs that fail after 3 retries move to DLQ.
- Admin dashboard shows DLQ jobs. Options: retry manually, inspect error, discard.
- Alert on DLQ growth (monitoring via Redis keyspace notifications).

### 5. Cost Estimation (1 export, 1080p, 5 min)
- **Compute:** ~30s CPU time on 2-core VM ≈ $0.001 (at $0.05/hr)
- **Storage:** Output ~50MB, stored 7 days ≈ $0.0001
- **Total per export:** ~$0.002

---

## Task 4: Collaboration (Pusher)

### 1. Why Pusher over self-hosted WebSocket?
- No infrastructure to manage — Pusher handles scaling, reconnection, global edge servers.
- Presence channels built-in. Client events for P2P communication (cursors).
- Free tier: 200K messages/day, 100 connections — sufficient for development and small teams.

### 2. Client Events vs Server Events
- **Client events** for cursor movement — high frequency (~10/sec), doesn't need server persistence, reduces API load.
- **Server events** for operations (clip move, add, delete) — must be persisted to DB first, then broadcast.

### 3. Offline Reconnect Sync
- Client stores last received `clientSeq`. On reconnect, calls `GET /collaboration/projects/:id/operations?sinceSeq=N`.
- API returns all operations since that sequence number. Client applies them in order.

### 4. Pusher Rate Limit Optimization
- Throttle cursor events to 100ms intervals (max 10/sec per user).
- Batch multiple property changes into single operation event.
- Use client events for ephemeral data (cursors), server events only for persistent changes.

### 5. Scaling Beyond Pusher
- Migrate to **Ably** (higher limits, same API pattern) or self-hosted **Socket.IO** with Redis adapter.
- Architecture stays the same — service layer abstracts Pusher, only `PusherService` needs replacement.
