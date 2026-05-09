# 🖥️ CloudCut — Full-Stack Engineering Challenge

## โจทย์สอบ Full-Stack Engineer: SaaS Video Editor

**ระดับ:** Mid-Senior Full-Stack Engineer
**เวลา:** 3–5 วัน 
**Stack:** NestJS + PostgreSQL + BullMQ + Redis + ffmpeg.wasm + React 19 + shadcn/ui + Pusher


---

## 📋 บทนำ

CloudCut เป็น **collaborative video editing SaaS** ที่ทำงานบน browser — คล้าย CapCut/Canva Video

คุณต้องสร้าง **working prototype** ที่ครอบคลุม 5 ส่วน:

| # | ส่วน | เนื้อหา |
|---|------|---------|
| 1 | Database | Schema design, migrations, seed data |
| 2 | Backend API | NestJS REST API, auth, validation |
| 3 | Queue & Processing | BullMQ + ffmpeg.wasm pipeline จริง |
| 4 | Real-time Collaboration | Pusher-based presence + operational sync |
| 5 | Editor UI | React + shadcn/ui — timeline, player, inspector |

> **ไม่จำเป็นต้องทำครบทุกข้อ** — ระบบคะแนนเป็น dynamic ตามความสมบูรณ์ของแต่ละส่วน (ดูหัวข้อ "เกณฑ์คะแนน" ด้านล่าง)

---

## 🎯 Task 1: Database Schema Design

### 1.1 ออกแบบ PostgreSQL Schema

เขียนเป็น **Prisma schema** หรือ **TypeORM entities** หรือ **raw SQL migrations** — เลือกอันที่ถนัด

#### Core Entities

**Users & Workspaces:**

```
User
├── id, email, name, avatar_url, oauth_provider
├── created_at, updated_at, deleted_at (soft delete)
│
Workspace
├── id, name, slug, plan (free / pro / team)
├── owner_id → User
│
WorkspaceMember
├── workspace_id → Workspace
├── user_id → User
├── role: owner | admin | editor | viewer
│
Invitation
├── workspace_id, email, role
├── status: pending | accepted | expired
├── token (unique), expires_at
```

**Projects & Assets:**

```
Project
├── id, workspace_id, name, description
├── settings: { resolution, fps, aspect_ratio } (JSON)
├── created_by → User
├── created_at, updated_at, deleted_at

Asset
├── id, project_id, uploaded_by → User
├── type: video | audio | image
├── original_url (R2 path)
├── status: uploading | processing | ready | failed
├── metadata: { duration_ms, width, height, codec, file_size_bytes } (JSON)
├── variants: → AssetVariant[]

AssetVariant
├── asset_id → Asset
├── type: proxy | thumbnail_strip | waveform_data
├── url (R2 path)
├── metadata (JSON — เช่น proxy resolution, thumbnail interval)
```

**Timeline Data:**

```
Track
├── id, project_id
├── type: video | audio
├── label (e.g. "V1", "A2")
├── order_index, is_locked, is_muted
├── color

Clip
├── id, track_id → Track, project_id
├── asset_id → Asset
├── track_position_ms     ← ตำแหน่งบน timeline (จุดเริ่ม)
├── in_point_ms           ← จุดเริ่มใน source asset
├── out_point_ms          ← จุดจบใน source asset
├── duration_ms           ← = out_point - in_point (computed / stored)
├── transform: { x, y, scale, rotation, opacity } (JSON)
├── created_at, updated_at, deleted_at

ClipEffect
├── id, clip_id → Clip
├── type: brightness | contrast | saturation | blur | ...
├── order_index
├── params (JSON — e.g. { value: 1.2 })
├── enabled: boolean

Transition
├── id, project_id
├── from_clip_id → Clip
├── to_clip_id → Clip
├── type: dissolve | wipe_left | wipe_right | fade | ...
├── duration_ms
├── params (JSON)

TextOverlay
├── id, project_id
├── track_position_ms, duration_ms
├── content, font_family, font_size, font_color
├── position: { x, y }, alignment
├── background_color, background_opacity
├── animation: fade_in | typewriter | none
```

**Exports & Jobs:**

```
ExportJob
├── id, project_id, requested_by → User
├── format: mp4 | webm
├── resolution: 720p | 1080p | 4k
├── quality: draft | standard | high
├── status: queued | processing | uploading | completed | failed | cancelled
├── progress_percent: 0–100
├── output_url, output_file_size
├── started_at, completed_at, expires_at
├── error_message (nullable)
├── idempotency_key (unique — ป้องกัน duplicate export)
```

**Operation Log (สำหรับ collaboration sync):**

```
OperationLog
├── id (UUID v7 — sortable)
├── project_id
├── user_id
├── operation_type: clip.add | clip.move | clip.trim | clip.delete | effect.update | ...
├── payload (JSON — operation data)
├── created_at
├── client_seq (sequence number จาก client — สำหรับ ordering)
```

### 1.2 สิ่งที่ต้องส่ง

- Schema definition (Prisma / TypeORM / SQL)
- Migration files
- Seed script — อย่างน้อย: 2 users, 1 workspace, 2 projects, 5+ clips, sample effects
- Index definitions พร้อม comment อธิบายแต่ละตัว
- `DESIGN.md` ตอบคำถาม:
  1. ทำไมเลือก normalize / denormalize ในส่วนที่เลือก?
  2. Soft delete strategy — cascade delete ทำงานอย่างไร?
  3. ทำไม clip position เก็บเป็น `track_position_ms` แทน relative-to-previous-clip?
  4. OperationLog จะ grow เร็ว — จะ archive / partition อย่างไร?
  5. ประมาณ storage: 1,000 users × 10 projects × 30 clips → กี่ rows ต่อตาราง?

---

## 🔧 Task 2: NestJS Backend API

### 2.1 Project Setup

```
backend/
├── src/
│   ├── app.module.ts
│   ├── auth/              # JWT auth + guards
│   ├── users/
│   ├── workspaces/
│   ├── projects/
│   ├── assets/
│   ├── timeline/          # tracks, clips, effects, transitions
│   ├── exports/
│   ├── collaboration/     # Pusher integration
│   ├── jobs/              # BullMQ processors
│   ├── common/            # pipes, filters, interceptors, decorators
│   └── config/
├── prisma/ (or migrations/)
├── test/
└── nest-cli.json
```

### 2.2 API Endpoints

#### Auth

```
POST   /auth/register          # email + password
POST   /auth/login             # → JWT access + refresh token
POST   /auth/refresh           # refresh token → new access token
GET    /auth/me                # current user info
```

#### Workspaces

```
POST   /workspaces                          # สร้าง workspace
GET    /workspaces                          # list user's workspaces
GET    /workspaces/:id                      # workspace details + members
POST   /workspaces/:id/invite               # invite by email
PATCH  /workspaces/:id/members/:userId      # change role
DELETE /workspaces/:id/members/:userId      # remove member
```

#### Projects

```
POST   /projects                     # สร้าง project (ภายใน workspace)
GET    /projects?workspaceId=X       # list projects (paginated, cursor-based)
GET    /projects/:id                 # project details + full timeline data
PATCH  /projects/:id                 # update settings
DELETE /projects/:id                 # soft delete
POST   /projects/:id/duplicate       # deep copy project
GET    /projects/:id/versions        # version history (snapshots)
POST   /projects/:id/versions        # create snapshot manually
```

#### Assets

```
POST   /assets/presigned-url         # ขอ presigned URL สำหรับ upload ไป R2/S3
POST   /assets/confirm-upload        # ยืนยัน upload สำเร็จ → trigger processing pipeline
GET    /assets?projectId=X           # list assets (filter by type, status)
GET    /assets/:id                   # asset details + variants
DELETE /assets/:id                   # soft delete
```

#### Timeline (Clips, Tracks, Effects)

```
# Tracks
POST   /projects/:id/tracks                   # เพิ่ม track
PATCH  /projects/:id/tracks/:trackId           # update (reorder, rename, lock, mute)
DELETE /projects/:id/tracks/:trackId           # ลบ track (+ clips ใน track)

# Clips
POST   /projects/:id/clips                    # เพิ่ม clip
PATCH  /projects/:id/clips/:clipId             # update (move, trim, transform)
DELETE /projects/:id/clips/:clipId             # soft delete
POST   /projects/:id/clips/:clipId/split       # split at timecode
POST   /projects/:id/clips/batch               # batch operations

# Effects
POST   /projects/:id/clips/:clipId/effects     # เพิ่ม effect
PATCH  /projects/:id/clips/:clipId/effects/:effectId  # update params
DELETE /projects/:id/clips/:clipId/effects/:effectId  # ลบ
PATCH  /projects/:id/clips/:clipId/effects/reorder    # เปลี่ยนลำดับ

# Transitions
POST   /projects/:id/transitions               # เพิ่ม transition
PATCH  /projects/:id/transitions/:id           # update
DELETE /projects/:id/transitions/:id           # ลบ

# Text Overlays
POST   /projects/:id/text-overlays             # เพิ่ม
PATCH  /projects/:id/text-overlays/:id         # update
DELETE /projects/:id/text-overlays/:id         # ลบ
```

#### Exports

```
POST   /projects/:id/exports          # สร้าง export job
GET    /projects/:id/exports          # list exports
GET    /exports/:id                   # export status + download URL
DELETE /exports/:id                   # cancel export
```

### 2.3 ข้อกำหนด Implementation

**ทุก endpoint ต้องมี:**

- **Input validation** — ใช้ `class-validator` + `class-transformer` หรือ Zod
- **Authentication** — JWT guard (ยกเว้น register/login)
- **Authorization** — ตรวจว่า user มีสิทธิ์กับ resource (workspace role-based)
- **Error handling** — NestJS exception filters, proper HTTP status codes, consistent error body:
  ```json
  { "statusCode": 403, "error": "Forbidden", "message": "You don't have editor access to this project" }
  ```
- **Pagination** — cursor-based สำหรับ list endpoints (ไม่ใช่ offset-based)
- **Rate limiting** — `@nestjs/throttler` หรือ custom guard

**สำหรับ collaboration endpoints:**

- ทุก mutation (clip move, trim, add effect, etc.) ต้อง:
  1. Save to database
  2. Write to OperationLog
  3. Broadcast ผ่าน Pusher channel
- ใช้ `@ApiTags()`, `@ApiOperation()` สำหรับ Swagger docs (nice to have)

### 2.4 ส่งอะไร

- Working NestJS app (`npm run start:dev` ต้อง run ได้)
- `.env.example` พร้อม environment variables ที่ต้องใช้
- Swagger/OpenAPI spec (ถ้ามี)
- `DESIGN.md` ตอบ:
  1. ทำไม cursor-based pagination แทน offset-based?
  2. Presigned upload flow ทำงานอย่างไร? ทำไมไม่ upload ผ่าน backend ตรง?
  3. Batch clip operation — ทำ atomic (transaction) หรือ partial? เหตุผล?
  4. ถ้า API ต้อง breaking change จะจัดการ versioning อย่างไร?

---

## 🔄 Task 3: Queue & Video Processing (ffmpeg.wasm)

### 3.1 Architecture

```
┌─────────┐     ┌───────────┐     ┌──────────────┐     ┌──────┐
│  Client  │────▶│  NestJS   │────▶│   BullMQ     │────▶│Redis │
│          │     │  API      │     │   Queue      │     │      │
└─────────┘     └─────┬─────┘     └──────┬───────┘     └──────┘
                      │                   │
                      │           ┌───────▼────────┐
                      │           │  Worker Process │
                      │           │  (ffmpeg.wasm)  │
                      │           └───────┬────────┘
                      │                   │
                      ▼                   ▼
                 ┌──────────┐      ┌──────────┐
                 │ Database │      │ R2 / S3  │
                 └──────────┘      └──────────┘
```

### 3.2 Pipeline 1: Asset Upload & Processing

เมื่อ user upload video → `POST /assets/confirm-upload` → trigger pipeline:

```
┌─────────────────────────────────────────────────────────┐
│                Asset Processing Pipeline                 │
│                                                          │
│   confirm-upload                                         │
│        │                                                 │
│        ▼                                                 │
│   ┌──────────────────┐                                   │
│   │ extract-metadata │  ← ffmpeg.wasm: probe file        │
│   │ (duration, res,  │    output: metadata JSON           │
│   │  codec, tracks)  │                                   │
│   └────────┬─────────┘                                   │
│            │                                             │
│     ┌──────┼───────┐    (parallel — ทั้ง 3 รอ metadata)  │
│     ▼      ▼       ▼                                     │
│  ┌──────┐┌──────┐┌──────────┐                            │
│  │proxy ││thumb-││waveform  │                            │
│  │720p  ││nails ││extract   │                            │
│  │encode││strip ││(audio    │                            │
│  └──┬───┘└──┬───┘│peaks)    │                            │
│     │       │    └────┬─────┘                            │
│     ▼       ▼         ▼                                  │
│   ┌────────────────────────┐                             │
│   │ mark asset as "ready"  │                             │
│   │ update DB + notify     │                             │
│   └────────────────────────┘                             │
└─────────────────────────────────────────────────────────┘
```

**ต้อง implement จริงด้วย ffmpeg.wasm:**

```typescript
// Job: extract-metadata
// ใช้ ffmpeg.wasm (หรือ ffprobe equivalent) อ่าน file metadata
// Output: { duration_ms, width, height, codec, audio_codec, audio_channels, file_size }

// Job: generate-proxy
// ใช้ ffmpeg.wasm transcode → 720p, lower bitrate
// Command แนว: -i input.mp4 -vf scale=-2:720 -c:v libx264 -preset fast -crf 28 output.mp4

// Job: generate-thumbnails
// ใช้ ffmpeg.wasm extract frames → JPEG images → รวมเป็น sprite sheet
// Command แนว: -i input.mp4 -vf "fps=1/5,scale=160:-1" -q:v 5 thumb_%03d.jpg
// (1 frame ทุก 5 วินาที, resize เป็น width 160px)

// Job: extract-waveform
// ใช้ ffmpeg.wasm export audio peaks data
// Command แนว: -i input.mp4 -ac 1 -filter:a "aformat=sample_fmts=s16" -f s16le pipe:
// แล้ว downsample เป็น peaks array (min/max per chunk)
```

### 3.3 Pipeline 2: Project Export

เมื่อ user กด export → `POST /projects/:id/exports`:

```
┌─────────────────────────────────────────────────────┐
│                 Export Pipeline                       │
│                                                      │
│   ┌──────────┐                                       │
│   │ validate │ ← ตรวจ project มี clips, assets ready  │
│   └────┬─────┘                                       │
│        ▼                                             │
│   ┌───────────────────┐                              │
│   │ render-segments   │ ← ffmpeg.wasm:               │
│   │ (chunk timeline   │   ตัด + apply effects ต่อ     │
│   │  เป็น segments)    │   segment                    │
│   └────────┬──────────┘                              │
│            ▼                                         │
│   ┌───────────────────┐                              │
│   │ concatenate +     │ ← ffmpeg.wasm:               │
│   │ final encode      │   concat segments + encode    │
│   └────────┬──────────┘                              │
│            ▼                                         │
│   ┌───────────────────┐                              │
│   │ upload to R2 +    │                              │
│   │ generate signed   │                              │
│   │ URL (7 day expiry)│                              │
│   └────────┬──────────┘                              │
│            ▼                                         │
│   ┌───────────────────┐                              │
│   │ notify user       │ ← Pusher event +             │
│   │                   │   (optional) email            │
│   └───────────────────┘                              │
└─────────────────────────────────────────────────────┘
```

**ต้อง implement จริง (อย่างน้อย basic export):**

```typescript
// Minimum viable export:
// 1. ดึง timeline data จาก DB
// 2. สำหรับแต่ละ clip: trim source video ตาม in/out point
// 3. Concatenate ทุก clip ตามลำดับ (single video track ก็พอ)
// 4. Apply basic effects ถ้าทำได้ (brightness, etc. ผ่าน ffmpeg filters)
// 5. Output → MP4 file
// 6. Upload → storage + return URL

// Advanced (nice to have):
// - Multi-track compositing (overlay videos)
// - Transition rendering (dissolve, wipe)
// - Text overlay burning
// - Audio mixing from multiple audio tracks
```

### 3.4 Pipeline 3: Scheduled Cleanup

```typescript
// Cron job ทำงานทุกวัน (ใช้ @nestjs/schedule):
// 1. ลบ soft-deleted projects เกิน 30 วัน → cascade ลบ clips, effects, etc.
// 2. ลบ export files ที่ expires_at < now
// 3. ลบ orphaned assets (ไม่ถูกใช้ใน project ใดเลย เกิน 7 วัน)
// 4. ลบ accounts ที่ deleted_at > 90 วัน (GDPR)
// 5. Log summary: { deleted_projects, deleted_assets, freed_bytes }
```

### 3.5 ข้อกำหนด

**Error handling & reliability:**
- ทุก job: retry 3 ครั้ง, exponential backoff (1s → 4s → 16s)
- Dead letter queue สำหรับ jobs ที่ fail ถาวร
- Job progress: report % completion → update DB → push ผ่าน Pusher
- Cancel support: user สามารถ cancel export ที่กำลัง process

**Idempotency:**
- Upload confirm + export request ต้องมี idempotency key
- ถ้า process ซ้ำ (duplicate delivery) → ต้องไม่สร้าง duplicate output

**Rate limiting:**
- Free plan: 5 uploads/hour, 2 concurrent exports
- Pro plan: 50 uploads/hour, 10 concurrent exports
- ใช้ Redis counter หรือ BullMQ rate limiter

### 3.6 ส่งอะไร

```
backend/src/jobs/
├── queues.module.ts                # BullMQ queue registration
├── processors/
│   ├── asset-metadata.processor.ts
│   ├── proxy-generation.processor.ts
│   ├── thumbnail-generation.processor.ts
│   ├── waveform-extraction.processor.ts
│   ├── export-render.processor.ts
│   └── cleanup.processor.ts
├── orchestrator.service.ts         # Job dependency management
├── progress.service.ts             # Progress tracking → Pusher
├── ffmpeg.service.ts               # ffmpeg.wasm wrapper
└── __tests__/
    ├── asset-pipeline.spec.ts
    ├── export-pipeline.spec.ts
    ├── retry-logic.spec.ts
    └── idempotency.spec.ts
```

`DESIGN.md` ตอบ:
1. ทำไมเลือก BullMQ? เปรียบเทียบกับ Cloudflare Queues / SQS
2. ffmpeg.wasm ทำงานบน Node.js ได้ดีแค่ไหน? ข้อจำกัด?
3. ถ้า video ยาว 30 นาที memory จะพอไหม? จัดการอย่างไร?
4. Dead letter queue — ทำอะไรกับ jobs ที่อยู่ใน DLQ?
5. Cost estimation: 1 export job (1080p, 5 นาที) ใช้ compute + storage เท่าไหร่?

---

## 🔗 Task 4: Real-time Collaboration (Pusher)

### 4.1 Architecture

```
┌──────────┐                ┌──────────┐                ┌──────────┐
│ Client A │───mutations───▶│  NestJS  │───broadcast───▶│ Pusher   │
│          │◀──events───────│  API     │                │ Channels │
└──────────┘                └──────────┘                └────┬─────┘
                                                             │
┌──────────┐                                                 │
│ Client B │◀────────────events──────────────────────────────┘
│          │
└──────────┘
```

**ใช้ Pusher Channels (ไม่ต้อง self-host):**

- ใช้ [Pusher Channels](https://pusher.com/channels) (free plan รองรับ 200k messages/day)
- Backend: `pusher` npm package
- Frontend: `pusher-js` npm package

### 4.2 Channel Design

```
# Presence channel — ใครกำลัง online ใน project
presence-project-{projectId}
  → member_added: { userId, name, avatar, color }
  → member_removed: { userId }
  → client-cursor-move: { userId, timeMs, trackId }  ← client event

# Private channel — project operations (ใช้ server broadcast)
private-project-{projectId}
  → operation: { type, payload, userId, seq }
  → clip-updated: { clipId, changes }
  → clip-added: { clip }
  → clip-deleted: { clipId }
  → track-updated: { trackId, changes }
  → effect-updated: { clipId, effectId, changes }

# Private channel — job progress
private-user-{userId}
  → job-progress: { jobId, type, progress, status }
  → export-completed: { exportId, downloadUrl }
  → asset-ready: { assetId }
```

### 4.3 Operation Sync Flow

```
Client A ทำ action (เช่น move clip):
  1. Apply locally ทันที (optimistic update)
  2. Send to API: PATCH /clips/:id { track_position_ms: 5000 }
  3. API:
     a. Validate + save to DB
     b. Write OperationLog
     c. Pusher trigger → private-project-{id}, event: "clip-updated"
  4. Client B receives event → apply update to local state
  5. Client A receives event → ถ้า payload ตรงกับ local → ignore (ไม่ต้อง apply ซ้ำ)
                              → ถ้าไม่ตรง (server modified) → reconcile
```

**Conflict resolution (simple strategy):**

```
- Last-write-wins (LWW) สำหรับ property-level changes
- ถ้า 2 users แก้ clip เดียวกันพร้อมกัน แต่คนละ property (เช่น A แก้ position, B แก้ brightness)
  → ไม่ conflict — ทั้งคู่ apply ได้
- ถ้าแก้ property เดียวกัน → server version wins (client ที่แพ้จะถูก overwrite)
- แสดง toast notification: "คนอื่นแก้ไข clip นี้ — ค่าถูก sync แล้ว"
```

> **Note:** ไม่จำเป็นต้อง implement full CRDT algorithm — LWW + per-property merge + server authority เพียงพอสำหรับโจทย์นี้ ถ้าอยากทำ CRDT จริง (เช่นใช้ Yjs) จะได้ bonus points

### 4.4 Presence (ใครอยู่ไหน)

**ต้อง implement:**

```typescript
// ทุก client ส่ง cursor position ทุก ~100ms (throttled):
// Pusher client event: "client-cursor-move"
// { userId, currentTimeMs, activeTrackId, activeClipId }

// Frontend แสดง:
// - Remote user cursor บน timeline (เส้นแนวตั้งพร้อมชื่อ + สีของ user)
// - Collaborator list: avatar + ชื่อ + กำลังอยู่ที่ timecode ไหน
// - "กำลังแก้ไข..." indicator บน clip ที่ remote user กำลัง interact
```

### 4.5 ส่งอะไร

**Backend:**
```
backend/src/collaboration/
├── collaboration.module.ts
├── collaboration.gateway.ts    # (ถ้าใช้ WebSocket ร่วมกับ Pusher)
├── pusher.service.ts           # Pusher server-side wrapper
├── presence.service.ts         # Track who's online in project
├── operation-log.service.ts    # Write + read operation log
└── sync.service.ts             # Broadcast operations to channel
```

**Frontend:**
```
frontend/src/collaboration/
├── usePusher.ts               # Pusher client setup + channel subscription
├── usePresence.ts             # Presence channel — online users + cursors
├── useOperationSync.ts        # Listen for remote operations → apply to local state
├── RemoteCursors.tsx          # Render remote user cursors on timeline
└── CollaboratorList.tsx       # Online collaborators panel
```

`DESIGN.md` ตอบ:
1. ทำไมเลือก Pusher แทน self-hosted WebSocket?
2. Client events vs server events — ใช้ client event สำหรับอะไร? ทำไม cursor ถึงเหมาะกับ client event?
3. ถ้า client offline แล้ว reconnect — จะ sync state ที่พลาดอย่างไร?
4. Rate limit ของ Pusher free plan — จะ optimize message frequency อย่างไร?
5. ถ้าต้อง scale เกิน Pusher limit → จะ migrate ไปอะไร?

---

## 🎨 Task 5: Editor UI (React + shadcn/ui)

### 5.1 Tech Stack

- **React 19** + TypeScript (strict)
- **shadcn/ui** — ใช้สำหรับ UI components ทั้งหมด (buttons, dialogs, dropdowns, sliders, tooltips, etc.)
- **Tailwind CSS** — styling
- **Zustand** — state management
- **Vite** — build tool

> **เน้น functional completeness มากกว่า visual polish** — ใช้ shadcn defaults ได้เลย ไม่ต้อง custom theme

### 5.2 Layout (shadcn ResizablePanelGroup)

```tsx
// ใช้ shadcn ResizablePanelGroup สำหรับ layout
<ResizablePanelGroup direction="vertical">
  {/* Top section */}
  <ResizablePanel>
    <ResizablePanelGroup direction="horizontal">
      {/* Left: Asset Browser */}
      <ResizablePanel defaultSize={20}>
        <AssetBrowser />
      </ResizablePanel>
      <ResizableHandle />
      {/* Center: Video Preview */}
      <ResizablePanel defaultSize={55}>
        <VideoPlayer />
      </ResizablePanel>
      <ResizableHandle />
      {/* Right: Inspector */}
      <ResizablePanel defaultSize={25}>
        <InspectorPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  </ResizablePanel>
  <ResizableHandle />
  {/* Bottom: Timeline */}
  <ResizablePanel defaultSize={40}>
    <Timeline />
  </ResizablePanel>
</ResizablePanelGroup>
```

### 5.3 Timeline Editor

**Rendering approach:** ใช้ **Canvas 2D** หรือ **DOM-based** (เลือกอะไรก็ได้ — ไม่บังคับ WebGPU)

#### ต้องทำ (Required)

**Tracks & Clips:**
- แสดง tracks เป็นแถว (V1, V2, A1, A2 ...)
- แสดง clips เป็น block บน track ตำแหน่ง + ความยาวตาม timecode
- แต่ละ clip แสดง: ชื่อ, duration, สีตาม track type (video = ฟ้า, audio = เขียว)
- Track header: ชื่อ, ปุ่ม lock / mute / visibility

**Clip Interactions:**
- **Drag** — ย้าย clip ไปตำแหน่งใหม่ (same track หรือ different track)
- **Trim** — drag ขอบซ้าย/ขวาเพื่อเปลี่ยน in/out point
- **Split** — กด `S` เพื่อ split clip ที่ playhead
- **Select** — click = select, Shift+click = multi-select, click background = deselect
- **Delete** — `Delete` key ลบ selected clips
- **Copy/Paste** — Ctrl+C/V

**Playhead:**
- เส้นแนวตั้งสีแดงที่ drag ได้
- Current timecode display (MM:SS:FF)
- Play → playhead เคลื่อนที่ smooth ตาม `requestAnimationFrame`

**Zoom & Scroll:**
- +/- ปุ่ม zoom
- Ctrl + mouse wheel = zoom
- Horizontal scroll = pan timeline
- Zoom to fit (`Ctrl+0`)

**Snap:**
- Drag clip ใกล้ขอบ clip อื่น → snap เข้าที่ (magnetic)
- Snap to playhead position
- Visual indicator: เส้น snap guide สีเหลือง
- กด `Alt` ระหว่าง drag = ปิด snap ชั่วคราว

**Timecode Ruler:**
- แสดง tick marks ตาม zoom level
- Major ticks: ทุก 1 / 5 / 10 / 30 วินาที (ตาม zoom)
- แสดง timecode labels

#### ควรทำ (Nice to have)

- Thumbnail strip preview บน video clips
- Waveform display บน audio clips (ใช้ data จาก waveform extraction job)
- Transition zone ระหว่าง clips
- Marquee select (drag rectangle)
- Virtual scrolling (render เฉพาะ visible clips)
- Keyboard shortcuts: J/K/L, I/O, Home/End, Shift+arrows
- Track add/remove/reorder

### 5.4 Video Player

**ใช้ `<video>` element ได้ — ไม่ต้อง WebCodecs:**

#### ต้องทำ

- แสดง video preview (โหลด proxy variant ถ้ามี)
- Play / Pause (Space bar)
- Seek bar — sync สองทางกับ timeline playhead
- Current time + total duration display
- Volume slider + mute toggle

#### ควรทำ

- Variable speed: 0.5x, 1x, 1.5x, 2x (shadcn Select component)
- Fullscreen toggle
- CSS filter preview เมื่อ clip มี effects (brightness, contrast, saturation, blur)
  ```css
  /* ตัวอย่าง: apply effects ด้วย CSS filters */
  filter: brightness(1.2) contrast(1.1) saturate(0.8) blur(2px);
  ```
- Switch ระหว่าง clips ที่อยู่ใน track ตาม playhead position

### 5.5 Inspector Panel (shadcn components)

เมื่อ select clip → inspector แสดง:

#### ต้องทำ

- **Clip Info** — ชื่อ, source asset, duration, in/out points (อ่านอย่างเดียว)
- **Transform** — input fields สำหรับ: X, Y, Scale, Rotation, Opacity
  - ใช้ shadcn `Input` (number) หรือ `Slider`
  - เปลี่ยนค่า → save (debounced PATCH to API + undo command)
- **Effects** — list ของ effects ที่ clip มี
  - ปุ่ม "Add Effect" → shadcn `DropdownMenu` เลือก type
  - แต่ละ effect: name + toggle enabled + ปุ่ม delete
  - Parameters: `Slider` components (เช่น brightness: -100 to 100)
  - เปลี่ยน parameter → save (debounced)

#### ควรทำ

- Drag to reorder effects
- Effect presets: save / load
- Text overlay editor: content textarea, font select, color picker, position
- Transition editor: type select, duration slider

### 5.6 Asset Browser

#### ต้องทำ

- List view ของ assets (shadcn `Card` — thumbnail + name + duration + status badge)
- Filter tabs: All / Video / Audio / Image (shadcn `Tabs`)
- Upload button → file picker → upload flow:
  1. ได้ presigned URL จาก API
  2. Upload ตรงไป R2/S3
  3. Confirm upload → แสดง processing status
  4. เมื่อ ready → แสดง thumbnail
- Status badges: uploading (สีเหลือง), processing (สีน้ำเงิน), ready (สีเขียว), failed (สีแดง)
- **Drag asset → drop บน timeline** เพื่อสร้าง clip ใหม่

#### ควรทำ

- Grid view toggle
- Search / filter
- Delete asset (with confirmation dialog)
- Preview asset (click to play in mini player)
- Storage usage display (used / limit)

### 5.7 State Management (Zustand)

```typescript
// Store 1: Project Store
interface ProjectState {
  project: Project | null;
  tracks: Track[];
  clips: Clip[];
  effects: Record<string, ClipEffect[]>;  // clipId → effects
  transitions: Transition[];
  textOverlays: TextOverlay[];
  // actions
  loadProject(id: string): Promise<void>;
  addClip(clip: NewClip): void;
  moveClip(clipId: string, position: number, trackId?: string): void;
  trimClip(clipId: string, inPoint: number, outPoint: number): void;
  splitClip(clipId: string, atTime: number): void;
  deleteClips(clipIds: string[]): void;
  addEffect(clipId: string, effect: NewEffect): void;
  updateEffect(clipId: string, effectId: string, params: any): void;
  // ... etc
}

// Store 2: UI Store
interface UIState {
  selectedClipIds: string[];
  zoomLevel: number;           // pixels per second
  scrollPosition: number;      // horizontal scroll offset
  activeTool: 'select' | 'blade' | 'hand';
  panelSizes: { left: number; center: number; right: number; bottom: number };
  snapEnabled: boolean;
  // actions
  selectClip(id: string, additive?: boolean): void;
  setZoom(level: number): void;
  // ...
}

// Store 3: Playback Store
interface PlaybackState {
  currentTimeMs: number;
  isPlaying: boolean;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
  // actions
  play(): void;
  pause(): void;
  seek(timeMs: number): void;
  setSpeed(speed: number): void;
}
```

### 5.8 Undo/Redo (Command Pattern)

**ต้อง implement:**

```typescript
interface Command {
  id: string;
  type: string;
  description: string;       // e.g. "Move Clip A to 00:05:00"
  timestamp: number;
  execute(): void;            // apply change
  undo(): void;               // reverse change
}

class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory = 50;

  execute(command: Command): void;
  undo(): void;
  redo(): void;
  getHistory(): Command[];   // สำหรับ UndoHistoryPanel
  canUndo(): boolean;
  canRedo(): boolean;
}
```

**Actions ที่ต้อง undoable:**
- Move clip
- Trim clip
- Split clip
- Delete clip(s)
- Add / remove effect
- Change effect parameters
- Change transform values
- Add / remove clip (via drag from asset browser)

**UI:**
- `Ctrl+Z` → undo, `Ctrl+Shift+Z` → redo
- Undo history panel (shadcn `ScrollArea` + list) แสดง: action name + timestamp
- Click entry ใน history เพื่อ undo ถึงจุดนั้น

### 5.9 ส่งอะไร

```
frontend/
├── package.json
├── tsconfig.json            # strict: true
├── vite.config.ts
├── tailwind.config.ts
├── components.json          # shadcn config
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   └── EditorLayout.tsx
│   │   ├── topbar/
│   │   │   └── TopBar.tsx          # logo, menu, export button, user
│   │   ├── timeline/
│   │   │   ├── Timeline.tsx
│   │   │   ├── TimelineTrack.tsx
│   │   │   ├── TimelineClip.tsx
│   │   │   ├── TimelineRuler.tsx
│   │   │   ├── Playhead.tsx
│   │   │   └── SnapGuide.tsx
│   │   ├── player/
│   │   │   ├── VideoPlayer.tsx
│   │   │   └── PlayerControls.tsx
│   │   ├── inspector/
│   │   │   ├── InspectorPanel.tsx
│   │   │   ├── ClipInfo.tsx
│   │   │   ├── TransformEditor.tsx
│   │   │   └── EffectEditor.tsx
│   │   ├── assets/
│   │   │   ├── AssetBrowser.tsx
│   │   │   └── AssetUpload.tsx
│   │   ├── collaboration/
│   │   │   ├── RemoteCursors.tsx
│   │   │   └── CollaboratorList.tsx
│   │   └── shared/
│   │       └── UndoHistory.tsx
│   ├── state/
│   │   ├── projectStore.ts
│   │   ├── uiStore.ts
│   │   ├── playbackStore.ts
│   │   └── commands/
│   │       └── CommandManager.ts
│   ├── hooks/
│   │   ├── useDragClip.ts
│   │   ├── useTrimClip.ts
│   │   ├── useZoom.ts
│   │   ├── useSnap.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── usePusher.ts
│   │   └── usePresence.ts
│   ├── services/
│   │   └── api.ts              # API client (fetch / axios wrapper)
│   ├── utils/
│   │   ├── timecode.ts
│   │   └── geometry.ts
│   └── types/
│       └── index.ts
└── tests/
    ├── timecode.test.ts
    ├── commands.test.ts
    └── snap.test.ts
```

---

## 📊 เกณฑ์คะแนน — Dynamic Scoring

### หลักการ

> **คะแนนเป็น dynamic** — ไม่ได้ตัดจากสิ่งที่ไม่ได้ทำ แต่ให้จากความสมบูรณ์ของสิ่งที่ทำ
>
> เช่น ถ้า implement ffmpeg.wasm pipeline ได้สมบูรณ์มาก (processing จริง, retry, progress, idempotency)
> แต่ collaboration ทำได้แค่ basic (presence อย่างเดียว ไม่มี operation sync)
> — ก็ยังได้คะแนนเต็มในส่วน queue/processing และได้บางส่วนใน collaboration

### คะแนนแต่ละส่วน

**แต่ละ task มี weight ต่างกัน — แต่คะแนนที่ได้ขึ้นกับความสมบูรณ์:**

| Task | Weight | ระดับที่ให้คะแนน |
|------|--------|-----------------|
| Database Schema | 15% | ดูด้านล่าง |
| NestJS API | 20% | ดูด้านล่าง |
| Queue & ffmpeg.wasm | 25% | ดูด้านล่าง |
| Collaboration (Pusher) | 15% | ดูด้านล่าง |
| Editor UI | 25% | ดูด้านล่าง |

---

#### Database Schema (15%)

| ระดับ | สัดส่วนของ 15% | เกณฑ์ |
|-------|---------------|-------|
| Basic | 40% | มี schema ครบ entities, relationships ถูก, migration run ได้ |
| Good | 70% | + indexes อธิบายได้, seed data ครบ, soft delete strategy ชัดเจน |
| Excellent | 100% | + DESIGN.md ลึก, storage estimation, partition strategy, concurrent editing design |

#### NestJS API (20%)

| ระดับ | สัดส่วนของ 20% | เกณฑ์ |
|-------|---------------|-------|
| Basic | 40% | CRUD projects + clips ทำงาน, auth guard, validation, app start ได้ |
| Good | 70% | + asset upload flow, export trigger, authorization, error handling consistent, pagination |
| Excellent | 100% | + Swagger docs, comprehensive tests, rate limiting, batch operations, DESIGN.md ชัดเจน |

#### Queue & ffmpeg.wasm (25%)

| ระดับ | สัดส่วนของ 25% | เกณฑ์ |
|-------|---------------|-------|
| Basic | 40% | BullMQ setup ทำงาน, อย่างน้อย 1 job ทำ ffmpeg จริง (เช่น metadata extract), progress tracking |
| Good | 70% | + pipeline ครบ (metadata → proxy → thumbnails), retry logic, export ทำได้ basic (trim + concat) |
| Excellent | 100% | + export ใช้ effects, idempotency, cancel support, cleanup jobs, tests ครบ, DESIGN.md ลึก |

#### Collaboration / Pusher (15%)

| ระดับ | สัดส่วนของ 15% | เกณฑ์ |
|-------|---------------|-------|
| Basic | 40% | Pusher connected, presence channel ทำงาน (เห็นว่าใครอยู่ online) |
| Good | 70% | + remote cursors บน timeline, operation broadcast (clip updates reflect), collaborator list |
| Excellent | 100% | + conflict handling (LWW), offline reconnect sync, optimistic updates, DESIGN.md ตอบได้ลึก |

#### Editor UI (25%)

| ระดับ | สัดส่วนของ 25% | เกณฑ์ |
|-------|---------------|-------|
| Basic | 40% | Timeline แสดง tracks + clips, drag clip ได้, play/pause, playhead, select/delete |
| Good | 70% | + trim, split, zoom, snap, inspector panel (transform + effects), asset browser + drag to timeline, undo/redo |
| Excellent | 100% | + thumbnails/waveform on clips, keyboard shortcuts ครบ, CSS filter preview, virtual scroll, state management clean |

---

### Bonus Points (ไม่มี cap — เพิ่มจากคะแนนปกติ)

| Bonus | คะแนนเพิ่ม | เกณฑ์ |
|-------|-----------|-------|
| Full CRDT | +5% | ใช้ Yjs หรือ Automerge แทน LWW — demo conflict resolution จริง |
| Multi-track export | +5% | ffmpeg.wasm composite หลาย video tracks + audio mixing |
| Text overlay rendering | +3% | Burn text overlay ลง export video |
| Docker Compose | +3% | `docker compose up` แล้ว run ทั้ง stack ได้ |
| CI/CD | +2% | GitHub Actions: lint + test + build |
| E2E test | +3% | Playwright test: upload → add to timeline → export → download |
| Dark mode | +1% | shadcn dark mode toggle |
| Mobile responsive | +2% | Timeline ใช้งานได้บน tablet |

---

### ตัวอย่างการคิดคะแนน

**ตัวอย่าง A:** Focus queue + API, UI พอใช้, ไม่ทำ collab

| Task | Weight | Level | Score |
|------|--------|-------|-------|
| Database | 15% | Good (70%) | 10.5% |
| API | 20% | Excellent (100%) | 20% |
| Queue/ffmpeg | 25% | Excellent (100%) | 25% |
| Collaboration | 15% | ไม่ทำ (0%) | 0% |
| UI | 25% | Basic (40%) | 10% |
| **Total** | | | **65.5%** |

**ตัวอย่าง B:** ทำทุกอย่าง level Good

| Task | Weight | Level | Score |
|------|--------|-------|-------|
| Database | 15% | Good (70%) | 10.5% |
| API | 20% | Good (70%) | 14% |
| Queue/ffmpeg | 25% | Good (70%) | 17.5% |
| Collaboration | 15% | Good (70%) | 10.5% |
| UI | 25% | Good (70%) | 17.5% |
| **Total** | | | **70%** |

**ตัวอย่าง C:** ทุกอย่าง Excellent + bonus

| Task | Weight | Level | Score |
|------|--------|-------|-------|
| Database | 15% | Excellent | 15% |
| API | 20% | Excellent | 20% |
| Queue/ffmpeg | 25% | Excellent | 25% |
| Collaboration | 15% | Excellent | 15% |
| UI | 25% | Excellent | 25% |
| Bonus | | Docker + E2E | +6% |
| **Total** | | | **106%** |

---

## ⚠️ กฎสำคัญ

1. **TypeScript strict** — ทุก project: `strict: true`
2. **NestJS best practices** — modules, providers, guards, pipes, interceptors
3. **ffmpeg.wasm ต้อง process จริง** — ไม่ใช่แค่ mock/sleep
4. **shadcn/ui เป็นหลัก** — ห้าม install UI library อื่น (Material UI, Ant Design, etc.) ยกเว้น utility (react-dnd, framer-motion)
5. **Tests ต้องมี** — อย่างน้อย: timecode utils, command pattern, 1 API endpoint, 1 job processor
6. **DESIGN.md ทุก task** — ไม่ต้องยาว แต่ต้องชัดเจน
7. **README.md** — ที่ root ต้องมี: setup instructions, tech stack, architecture diagram, demo video/screenshots

---

## 📁 โครงสร้าง Repo

```
cloudcut/
├── README.md                    # Setup, architecture, screenshots
├── docker-compose.yml           # (bonus) PostgreSQL + Redis + app
│
├── backend/
│   ├── package.json
│   ├── nest-cli.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── auth/
│   │   ├── users/
│   │   ├── workspaces/
│   │   ├── projects/
│   │   ├── assets/
│   │   ├── timeline/
│   │   ├── exports/
│   │   ├── collaboration/
│   │   ├── jobs/
│   │   └── common/
│   ├── test/
│   └── DESIGN.md
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── components.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── state/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── utils/
│   │   └── types/
│   ├── tests/
│   └── DESIGN.md
│
└── docs/
    ├── architecture.md          # System architecture diagram
    ├── api-spec.md              # API documentation
    └── database-design.md       # Schema + design decisions
```

---

