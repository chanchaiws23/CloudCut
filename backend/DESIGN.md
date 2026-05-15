# CloudCut Backend Design

เอกสารนี้สรุป decision ของ Task 1-4: database schema, NestJS API, queue/video processing และ collaboration

## Task 1: Database Schema

### 1. Normalize / Denormalize

ข้อมูลหลักถูก normalize เพื่อให้ lifecycle และสิทธิ์ของแต่ละส่วนแยกจากกันชัดเจน

- `User`, `Workspace`, `WorkspaceMember`, `Invitation` แยกกัน เพราะ owner/member/invite เปลี่ยนสถานะได้คนละจังหวะ
- `Project`, `Asset`, `Track`, `Clip`, `ClipEffect`, `Transition`, `TextOverlay`, `ExportJob`, `OperationLog` แยกกัน เพราะแต่ละ entity มี query pattern และ permission ของตัวเอง
- `AssetVariant` แยกจาก `Asset` เพราะ asset หนึ่งไฟล์สร้าง output ได้หลายแบบ เช่น proxy video, thumbnail strip และ waveform data

ส่วนที่ตั้งใจ denormalize:

- `Clip.durationMs` เก็บซ้ำจาก `outPointMs - inPointMs` เพราะ timeline render อ่าน duration บ่อยมาก ส่วน trim เกิดน้อยกว่า service layer จึงคุมให้ sync กัน
- `TextOverlay.positionX` และ `positionY` เก็บเป็น scalar เพื่อ update/query ง่ายกว่าการฝังทั้งหมดใน JSON
- JSON ใช้กับ `Project.settings`, `Asset.metadata`, `Clip.transform`, `ClipEffect.params`, `Transition.params` เพราะ payload เหล่านี้ evolve บ่อยและมักอ่านเป็นก้อนเดียว

### 2. Soft Delete Strategy

ตารางที่ใช้ soft delete:

- `User.deletedAt`
- `Project.deletedAt`
- `Asset.deletedAt`
- `Clip.deletedAt`

read path ปกติ filter `deletedAt: null` เพื่อซ่อนข้อมูลที่ถูกลบ แต่ยังเปิดทางให้ undo/recovery ได้

hard delete cascade:

- Prisma relation ใช้ `onDelete: Cascade` กับ child records ที่ควรถูกลบเมื่อ parent ถูกลบจริง เช่น workspace ไป project, project ไป tracks/assets/clips/export jobs/operation logs, clip ไป effects, asset ไป variants
- soft delete ไม่ cascade อัตโนมัติ เช่น soft-delete project จะซ่อน project ก่อน แล้ว cleanup job ค่อย hard-delete หลัง retention window

retention:

- Project: hard delete หลัง 30 วัน
- Asset: hard delete orphaned หรือ soft-deleted media หลัง 7 วัน
- User: hard delete หลัง 90 วัน ตามแนวทาง GDPR/account cleanup

### 3. เหตุผลที่ใช้ `track_position_ms`

Clip เก็บตำแหน่งบน timeline แบบ absolute milliseconds

เหตุผล:

- ย้าย clip หนึ่งตัวแล้วไม่ต้อง rewrite clip ถัดไปทั้ง track
- concurrent editing ง่ายกว่า เพราะผู้ใช้สองคนย้ายคนละ clip ได้โดยไม่ต้อง recalculation chain
- render timeline เร็ว เพราะใช้ `trackId + trackPositionMs` เพื่อเรียง clip ตามตำแหน่งได้ตรง ๆ
- snapping, overlap detection, split, trim และ seek เป็น arithmetic ธรรมดา

ถ้าเก็บแบบ relative-to-previous-clip จะทำให้ insert/move เป็น O(n), conflict ง่ายขึ้น และ replay operation ยากกว่า

### 4. OperationLog Growth / Archive / Partition

`OperationLog` โตเร็วที่สุด เพราะทุก collaborative mutation เขียนหนึ่ง row

กลยุทธ์ใน hot table:

- `id` สร้างแบบ UUID-v7-like sortable text ใน application layer
- index `(projectId, createdAt)` ใช้สำหรับ reconnect sync และ historical replay
- unique `(projectId, clientSeq)` ทำให้ operation ordering ของแต่ละ project deterministic

archive strategy:

- เก็บ operation ล่าสุดประมาณ 1,000 รายการต่อ project ใน hot table
- partition `operation_logs` ตาม `created_at` รายเดือน
- ย้าย partition ที่เก่ากว่า 30 วันไป cold storage หรือ `operation_logs_archive`
- สร้าง project snapshot เป็นช่วง ๆ เพื่อไม่ต้อง replay operation เก่าทั้งหมด

### 5. Storage Estimate

สมมติ 1,000 users, user ละ 10 projects, project ละ 30 clips, โดยเฉลี่ย 1 workspace ต่อ 2 users, 3 tracks/project, 2 effects/clip และ 10 operation logs/clip

| Table | Estimated Rows | Notes |
|---|---:|---|
| users | 1,000 | account users |
| workspaces | 500 | workspace เฉลี่ย 2 users |
| workspace_members | 2,000 | owners + collaborators |
| invitations | 500 | pending/recent invites |
| projects | 10,000 | 1,000 users x 10 projects |
| assets | 100,000 | ประมาณ 10 assets/project |
| asset_variants | 300,000 | proxy, thumbnail strip, waveform |
| tracks | 30,000 | 3 tracks/project |
| clips | 300,000 | 10,000 projects x 30 clips |
| clip_effects | 600,000 | 2 effects/clip |
| transitions | 100,000 | ประมาณ 10/project |
| text_overlays | 50,000 | ประมาณ 5/project |
| export_jobs | 50,000 | ประมาณ 5 exports/project |
| operation_logs | 3,000,000 | ประมาณ 10 operations/clip |

ขนาดโดยประมาณ:

- relational rows หลัก: 500 MB - 1 GB
- operation logs: ประมาณ 1.5 GB ถ้า payload เฉลี่ย 500 bytes
- รวม relational storage: ประมาณ 2 GB ก่อนนับ indexes และ TOAST overhead
- media files ไม่เก็บใน PostgreSQL เก็บเฉพาะ path/metadata ไป R2/S3 หรือ local storage

### 6. Index Catalog

| Table | Index | Purpose |
|---|---|---|
| workspaces | `owner_id` | lookup workspace ตาม owner |
| workspace_members | `workspace_id, user_id` unique | กันสมาชิกซ้ำและใช้ authorization |
| workspace_members | `user_id` | list workspaces ของ user |
| invitations | `token` unique | accept invite |
| invitations | `email, status` | หา pending invite |
| projects | `workspace_id, deleted_at` | list project โดยไม่รวมที่ถูกลบ |
| projects | `created_by_id` | project ที่ user สร้าง |
| assets | `project_id, status` | filter media bin ตาม status |
| assets | `project_id, type` | filter media bin ตาม type |
| asset_variants | `asset_id, type` | lookup proxy/thumbnail/waveform |
| tracks | `project_id, order_index` | เรียง track ใน timeline |
| clips | `track_id, track_position_ms` | render timeline/range query |
| clips | `project_id, deleted_at` | load full timeline |
| clip_effects | `clip_id, order_index` | effect stack order |
| transitions | `project_id` | load transitions |
| text_overlays | `project_id` | load overlays |
| export_jobs | `project_id, status` | export history/status |
| export_jobs | `requested_by_id` | export history ของ user |
| export_jobs | `status, expires_at` | cleanup expired exports |
| operation_logs | `project_id, created_at` | reconnect sync |
| operation_logs | `project_id, client_seq` unique | deterministic operation ordering |

## Task 2: NestJS Backend API

### 1. ทำไมใช้ Cursor-Based Pagination

ใช้ cursor pagination กับ list endpoints เช่น `GET /projects`, `GET /assets`, `GET /projects/:id/exports`, `GET /workspaces`

เหตุผล:

- offset pagination ช้าลงเมื่อ `OFFSET` สูง เพราะ database ต้อง scan แล้ว discard row ก่อนหน้า
- cursor pagination เสถียรกว่าเมื่อมีการสร้าง/ลบ records ระหว่าง paging ลดโอกาส duplicate/skipped rows
- response คืน `{ data, nextCursor }` โดย `nextCursor` คือ id ของ item สุดท้ายใน page
- `take` validate และ cap ที่ 100 เพื่อกัน query หนักเกิน

### 2. Presigned Upload Flow

flow:

1. Client เรียก `POST /assets/presigned-url` พร้อม `projectId`, `fileName`, `type`, `contentType`
2. API ตรวจ editor access
3. API สร้าง `Asset` status `uploading`
4. ถ้ามี R2/S3 config จะคืน short-lived PUT URL ถ้าไม่มีจะคืน local multipart fallback
5. Client upload file ไป storage โดยตรง
6. Client เรียก `POST /assets/confirm-upload`
7. API mark image เป็น `ready`; video/audio เป็น `processing` และ trigger job pipeline

ทำไมไม่ upload file ใหญ่ผ่าน backend:

- NestJS worker ไม่ควรถูกผูกด้วย large upload stream และ memory
- direct-to-storage scale แยกจาก API traffic
- R2/S3 รองรับ retry/large object/bandwidth ได้ดีกว่า app server
- backend ยังเป็นเจ้าของ metadata, authorization, status และ processing orchestration

### 3. Batch Clip Operation

`POST /projects/:id/clips/batch` ทำแบบ atomic transaction

เหตุผล:

- timeline state ไม่ควร update ครึ่งเดียว
- service validate clips/tracks ทุกตัวว่าอยู่ project เดียวกันก่อน write
- Prisma `$transaction` rollback ทั้ง batch ถ้าขั้นใดขั้นหนึ่ง fail
- หลัง commit ค่อยเขียน operation log และ broadcast collaboration event

### 4. API Versioning

prototype ตอนนี้ใช้ route แบบ unversioned เพื่อความง่าย ถ้าขึ้น production แล้วมี breaking change จะใช้แนวทาง:

- เพิ่ม URI versioning เช่น `/api/v1/...`, `/api/v2/...`
- run v1/v2 ควบคู่ระหว่าง migration window
- เพิ่ม field แบบ backward-compatible ก่อนเมื่อทำได้
- breaking response shape ให้เปิด version ใหม่และ document migration ใน Swagger/OpenAPI
- deprecate version เก่าด้วย response headers และวัน removal ที่ชัดเจน

### 5. Implementation Notes

- Global `ValidationPipe` เปิด whitelist, transform และ forbid-non-whitelisted
- JWT guard ป้องกัน resource endpoints ยกเว้น register/login/refresh
- Workspace role checks ใช้ owner/admin/editor/viewer ตาม resource
- Global exception filter คืน error JSON consistent
- `@nestjs/throttler` ใช้ผ่าน `APP_GUARD`
- Swagger docs เปิดที่ `/api/docs`

## Task 3: Queue and Video Processing

### 1. ทำไมเลือก BullMQ

BullMQ เหมาะกับ prototype นี้เพราะเป็น Redis-backed queue ที่ mature และ integrate กับ NestJS ผ่าน `@nestjs/bullmq` ได้ตรง

เทียบกับทางเลือก:

- Cloudflare Queues เหมาะกับ edge-native workloads แต่ local dev/control/progress visibility น้อยกว่า
- SQS durable และ scale ดี แต่ต้องสร้าง infrastructure เพิ่มสำหรับ progress, delayed retries, worker orchestration และ local dev
- BullMQ ให้ retry/backoff, delayed jobs, named queues, job ids สำหรับ idempotency, failed-job retention และ Redis-backed inspection โดยเขียน code ไม่มาก

### 2. ffmpeg.wasm บน Node.js

worker พยายามใช้ `@ffmpeg/ffmpeg` ก่อนสำหรับ metadata, proxy generation และ thumbnail extraction แล้วใช้ `ffmpeg-static` เป็น fallback เพื่อให้ local demo เสถียรเมื่อ wasm initialize ไม่ผ่าน

ข้อจำกัด:

- wasm ต้อง load media เข้า memory จึงเสี่ยงกับวิดีโอยาวหรือความละเอียดสูง
- startup ช้ากว่า native ffmpeg เพราะต้องโหลด wasm runtime
- codec/performance อาจต่างจาก native ffmpeg
- production-scale export ควร chunk video หรือย้ายไป dedicated transcoding worker/service

### 3. วิดีโอ 30 นาที memory พอไหม

วิดีโอ 30 นาทีที่ 1080p อาจใหญ่หลายร้อย MB ถึงหลาย GB การ load source หลายไฟล์พร้อมกันเสี่ยงมาก

แนวทางจัดการ:

- process เป็น segment สั้น ๆ ต่อ clip แทนการโหลดทั้ง project ใน command เดียว
- จำกัด heavy worker concurrency
- สร้าง 720p proxy สำหรับ preview/editing
- concat intermediate segment outputs หลัง trim
- ใช้ native ffmpeg หรือ managed transcoding สำหรับไฟล์ใหญ่มากถ้า wasm memory ไม่พอ

### 4. Dead Letter Queue

ทุก processing job retry 3 ครั้งด้วย exponential backoff หาก fail ถาวรจะ copy เข้า `dead-letter` queue พร้อมข้อมูล:

- source queue
- source job id
- original payload
- failure reason
- attempts made
- failure timestamp

วิธีจัดการ DLQ:

- inspect error/payload
- retry manual หลังแก้ config/input
- discard หาก asset/export นั้น obsolete
- alert เมื่อ DLQ โตเร็วหรือ error ซ้ำ pattern เดิม

### 5. Cost Estimate

export 1080p ความยาว 5 นาที:

- Compute: ประมาณ 30-90 วินาทีบน worker 2-core ขนาดเล็ก ถ้าคิด $0.05/hour จะอยู่ประมาณ $0.0004-$0.0013
- Storage: MP4 50-150 MB เก็บ 7 วันใน R2/S3 มักต่ำกว่า $0.001
- รวมคร่าว ๆ: $0.001-$0.003 ต่อ export ยังไม่รวม bandwidth

### 6. Reliability Notes

- Asset pipeline: `confirm-upload -> metadata -> proxy + thumbnails + waveform -> ready`
- Export pipeline: validate clips, trim/concat timeline segments, apply effects/text overlays, write output URL/size และ notify progress
- Progress push ผ่าน Pusher และ persist ใน DB fields/metadata
- Confirm upload รับ idempotency key เพื่อกัน duplicate processing
- Export ใช้ `ExportJob.idempotencyKey`
- Upload rate limit: free 5 uploads/hour, pro/team 50 uploads/hour
- Concurrent export limit: free 2 active exports, pro/team 10 active exports
- Cancel support mark DB job cancelled, remove waiting BullMQ jobs และ active workers เช็ค cancellation ระหว่าง stage
- Cleanup job รายวันลบ stale soft-deleted projects, expired exports, orphaned assets และ old soft-deleted users

## Task 4: Real-Time Collaboration

### 1. ทำไมเลือก Pusher แทน self-hosted WebSocket

Pusher ลดภาระ operation ของ WebSocket infrastructure ใน prototype stage

ข้อดี:

- จัดการ connection fan-out, TLS, reconnect, private channel auth และ presence membership ให้
- backend publish ผ่าน `pusher` package ได้ง่าย
- frontend subscribe ผ่าน `pusher-js` ได้ง่าย
- ตรงกับ requirement และเพียงพอกับ demo/free-plan traffic

self-hosted WebSocket ให้ control และ cost ที่ดีกว่าใน scale สูง แต่ต้องดูแล load balancing, connection lifecycle, fan-out, retry, monitoring และ deployment เอง

### 2. Client Events vs Server Events

server events ใช้กับ state change ที่ authoritative เช่น timeline mutations:

- save ลง PostgreSQL
- write `OperationLog`
- broadcast บน `private-project-{projectId}` เป็น generic `operation`
- broadcast typed events เช่น `clip-updated`, `clip-added`, `clip-deleted`, `track-updated`, `effect-updated`

client events ใช้กับ ephemeral presence เท่านั้น เช่น cursor movement เพราะเปลี่ยนบ่อย ไม่ต้อง durable storage และ drop ได้โดยไม่ทำให้ timeline state เสีย

client ส่ง `client-cursor-move` บน `presence-project-{projectId}` พร้อม `{ userId, currentTimeMs, activeTrackId, activeClipId }`

### 3. Offline / Reconnect Sync

ทุก persisted mutation ได้ `clientSeq` ภายใน project จาก `OperationLog` เมื่อ subscribe สำเร็จ frontend เรียก:

`GET /collaboration/projects/:projectId/operations?sinceSeq=N`

แล้ว replay missed operations

server เป็น authority:

- ถ้า optimistic update ของ client ตรงกับ server event ให้ ignore event ของตัวเอง
- ถ้าคนอื่นแก้ property เดียวกัน ใช้ last-write-wins ตาม sequence ล่าสุดจาก server
- ถ้าแก้คนละ property ใช้ partial `changes` merge ได้โดยไม่ conflict

### 4. Pusher Rate Limit

แนวทางลด message:

- throttle cursor ประมาณ 100 ms
- cursor ใช้ client event และไม่เขียน DB
- durable mutations batch เมื่อเหมาะสม เช่น `clip.batch`
- frontend deduplicate generic/typed events ด้วย `seq`

ถ้า traffic โตขึ้น สามารถลด cursor frequency, pause hidden-tab updates และ coalesce noisy operations ก่อน broadcast

### 5. Scale Beyond Pusher

ถ้าเกิน limit ของ Pusher จะย้ายไป realtime gateway เฉพาะ:

- Socket.IO หรือ uWebSockets.js สำหรับ browser connections
- Redis Pub/Sub หรือ NATS สำหรับ cross-node fan-out
- PostgreSQL `OperationLog` ยังเป็น source of truth สำหรับ reconnect replay
- Presence ย้ายไป Redis พร้อม TTL heartbeat

contract ฝั่ง client ยังใกล้เดิม: subscribe project/user channels และ replay missed operations ผ่าน REST endpoint
