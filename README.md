# ☁️ CloudCut — Collaborative Video Editing SaaS

A full-stack **collaborative video editing** platform built for the browser, inspired by CapCut/Canva Video.

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────┐     ┌────────┐
│   React 19   │────▶│   NestJS     │────▶│  BullMQ  │────▶│ Redis  │
│   + shadcn   │◀────│   REST API   │     │  Queues  │     │        │
│   + Zustand  │     └──────┬───────┘     └────┬─────┘     └────────┘
└──────────────┘            │                  │
       │                    ▼                  ▼
       │              ┌──────────┐      ┌─────────────┐
       │              │PostgreSQL│      │ ffmpeg.wasm  │
       │              └──────────┘      │  Workers     │
       │                                └─────────────┘
       │              ┌──────────┐
       └─────────────▶│  Pusher  │  (Real-time collaboration)
                      └──────────┘
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript (strict), Vite, Tailwind CSS, shadcn/ui, Zustand |
| **Backend** | NestJS, TypeScript (strict), Prisma ORM, class-validator |
| **Database** | PostgreSQL 16 |
| **Queue** | BullMQ + Redis 7 |
| **Video Processing** | ffmpeg.wasm |
| **Real-time** | Pusher Channels |
| **Auth** | JWT (access + refresh tokens) |

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20
- PostgreSQL 16
- Redis 7
- npm or yarn

### With Docker Compose (recommended)

```bash
# Copy env files
cp backend/.env.example backend/.env

# Start all services
docker compose up -d

# Run migrations & seed
cd backend
npx prisma migrate dev
npx prisma db seed
```

### Manual Setup

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your database/redis credentials
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# 2. Frontend
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Environment Variables

See `backend/.env.example` and `frontend/.env.example` for required configuration.

## 📁 Project Structure

```
cloudcut/
├── README.md
├── docker-compose.yml
├── backend/                 # NestJS API server
│   ├── prisma/              # Schema, migrations, seed
│   ├── src/
│   │   ├── auth/            # JWT authentication
│   │   ├── users/           # User management
│   │   ├── workspaces/      # Workspace & members
│   │   ├── projects/        # Project CRUD
│   │   ├── assets/          # Asset upload & management
│   │   ├── timeline/        # Tracks, clips, effects, transitions
│   │   ├── exports/         # Export job management
│   │   ├── collaboration/   # Pusher real-time sync
│   │   ├── jobs/            # BullMQ processors (ffmpeg.wasm)
│   │   └── common/          # Shared pipes, filters, guards
│   └── DESIGN.md
├── frontend/                # React 19 editor UI
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── state/           # Zustand stores
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API client
│   │   └── utils/           # Utilities
│   └── DESIGN.md
└── docs/                    # Architecture & API docs
```

## �️ Screenshots & Demo

### Editor Workspace

| View | Description |
|------|-------------|
| **Timeline Editor** | Multi-track timeline with drag-and-drop clips, snap guides, and zoom controls |
| **Video Player** | Real-time preview with CSS filter effects synced to the timeline |
| **Asset Browser** | Upload, browse, and drag assets onto timeline tracks |
| **Inspector Panel** | Edit clip transform (position, scale, opacity) and toggle effects |
| **Collaboration** | Live user cursors, presence list, and Pusher real-time sync |

### Demo Videos

- [Project Walkthrough](docs/demo/walkthrough.mp4) — Create a project, import assets, arrange clips, and export
- [Real-time Collaboration](docs/demo/collaboration.mp4) — Two users editing the same timeline simultaneously

> Place actual screenshots in `docs/screenshots/` and update the table above with image links once they are available.

## �📖 Documentation

- [Architecture Overview](docs/architecture.md)
- [API Specification](docs/api-spec.md)
- [Database Design](docs/database-design.md)
- [Backend Design Decisions](backend/DESIGN.md)
- [Frontend Design Decisions](frontend/DESIGN.md)
