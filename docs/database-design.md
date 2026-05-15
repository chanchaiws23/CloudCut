# CloudCut Database Design

รายละเอียดเชิงลึกอยู่ใน `backend/DESIGN.md` ส่วนนี้เป็น summary ของ schema และ deliverables

## Entity Overview

```text
User
  owns Workspace
  belongs to Workspace through WorkspaceMember

Workspace
  has Invitation
  has Project

Project
  has Asset -> AssetVariant
  has Track -> Clip -> ClipEffect
  has Transition
  has TextOverlay
  has ExportJob
  has OperationLog
```

## Deliverables

- Prisma schema: `backend/prisma/schema.prisma`
- Migrations: `backend/prisma/migrations`
- Seed script: `backend/prisma/seed.ts`
- Design decisions: `backend/DESIGN.md`

## Seed Data

seed script สร้างข้อมูลตัวอย่าง:

- 2 users: Alice และ Bob
- 2 workspaces: free และ pro
- workspace memberships และ pending invitation
- 2 projects
- assets พร้อม variants
- tracks, clips, sample effects
- transition และ text overlay
- export job
- operation log rows

## Index Summary

schema มี indexes สำหรับ:

- workspace ownership และ membership checks
- invitation token และ pending invitation lookup
- project listing พร้อม soft-delete filters
- asset filtering ตาม status/type
- timeline rendering ตาม track position
- effect stack ordering
- export cleanup/history
- collaboration reconnect sync ด้วย operation timestamps และ per-project sequence numbers
