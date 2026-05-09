# CloudCut — System Architecture

## Overview

CloudCut is a browser-based collaborative video editing SaaS. The architecture follows a client-server model with real-time collaboration powered by Pusher Channels.

## Component Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Client)                   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  React 19 + Vite SPA                          │   │
│  │                                               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │   │
│  │  │ Timeline  │  │ Player   │  │Inspector │   │   │
│  │  │ (DOM)     │  │ (<video>)│  │ Panel    │   │   │
│  │  └──────────┘  └──────────┘  └──────────┘   │   │
│  │                                               │   │
│  │  ┌──────────────────────────────────────┐    │   │
│  │  │         Zustand Stores               │    │   │
│  │  │  projectStore / uiStore / playback   │    │   │
│  │  └──────────────────────────────────────┘    │   │
│  │                                               │   │
│  │  ┌─────────────┐  ┌──────────────────────┐  │   │
│  │  │ pusher-js   │  │ CommandManager        │  │   │
│  │  │ (WS client) │  │ (undo/redo)           │  │   │
│  │  └─────────────┘  └──────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         │ REST API                    │ WS (Pusher)
         ▼                             ▼
┌────────────────────┐    ┌─────────────────────────┐
│   NestJS API       │    │   Pusher Channels        │
│                    │    │                          │
│  • Auth (JWT)      │───▶│  presence-project-{id}   │
│  • CRUD endpoints  │    │  private-project-{id}    │
│  • BullMQ jobs     │    │  private-user-{id}       │
└────────────────────┘    └─────────────────────────┘
         │                          
         ▼                         
┌────────────────────┐    ┌──────────────────────┐
│   PostgreSQL       │    │   Redis              │
│                    │    │                      │
│  • Users           │    │  • BullMQ queues     │
│  • Workspaces      │    │  • Rate limiters     │
│  • Projects        │    │  • Session data      │
│  • Timeline data   │    └──────────────────────┘
│  • Export jobs     │              │
│  • Operation logs  │              ▼
└────────────────────┘    ┌──────────────────────┐
                          │   ffmpeg.wasm Workers │
                          │                      │
                          │  • Metadata extract  │
                          │  • Proxy generation  │
                          │  • Thumbnails        │
                          │  • Waveform          │
                          │  • Export render     │
                          └──────────────────────┘
```

## Data Flow

### Upload Flow
1. Client requests presigned URL → API creates Asset (status: `uploading`)
2. Client uploads file directly to R2/S3
3. Client calls `confirm-upload` → API marks as `processing`
4. BullMQ job: `extract-metadata` → parallel: `proxy`, `thumbnails`, `waveform`
5. When all 3 variants complete → Asset marked `ready` → Pusher event to client

### Collaboration Flow
1. User A moves clip → optimistic update in local store
2. PATCH /clips/:id → API saves to DB + writes OperationLog
3. API triggers Pusher broadcast on `private-project-{id}`
4. User B receives `operation` event → applies to local Zustand store
5. If conflict (same clip, same property) → server version wins (LWW)

### Export Flow
1. Client POSTs to `/exports` with idempotency key
2. API creates ExportJob (status: `queued`)
3. BullMQ `export-render` job: trim clips → concat → apply effects → encode
4. Upload output to R2 → update ExportJob with `outputUrl`
5. Pusher event to client: `export-completed` with download URL
