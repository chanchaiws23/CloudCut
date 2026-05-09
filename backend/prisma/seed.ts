import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.operationLog.deleteMany();
  await prisma.exportJob.deleteMany();
  await prisma.clipEffect.deleteMany();
  await prisma.transition.deleteMany();
  await prisma.textOverlay.deleteMany();
  await prisma.clip.deleteMany();
  await prisma.track.deleteMany();
  await prisma.assetVariant.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // === Users ===
  const alice = await prisma.user.create({
    data: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'alice@cloudcut.dev',
      name: 'Alice Johnson',
      passwordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    },
  });

  const bob = await prisma.user.create({
    data: {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'bob@cloudcut.dev',
      name: 'Bob Smith',
      passwordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
    },
  });

  // === Workspace ===
  const workspace = await prisma.workspace.create({
    data: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Creative Studio',
      slug: 'creative-studio',
      plan: 'pro',
      ownerId: alice.id,
    },
  });

  // === Workspace Members ===
  await prisma.workspaceMember.createMany({
    data: [
      { workspaceId: workspace.id, userId: alice.id, role: 'owner' },
      { workspaceId: workspace.id, userId: bob.id, role: 'editor' },
    ],
  });

  // === Project 1: Product Demo ===
  const project1 = await prisma.project.create({
    data: {
      id: '00000000-0000-0000-0000-000000000020',
      workspaceId: workspace.id,
      name: 'Product Demo Video',
      description: 'Q4 product launch demo video',
      settings: { resolution: '1920x1080', fps: 30, aspectRatio: '16:9' },
      createdById: alice.id,
    },
  });

  // === Project 2: Social Media ===
  const project2 = await prisma.project.create({
    data: {
      id: '00000000-0000-0000-0000-000000000021',
      workspaceId: workspace.id,
      name: 'Social Media Reel',
      description: 'Instagram reel for marketing campaign',
      settings: { resolution: '1080x1920', fps: 30, aspectRatio: '9:16' },
      createdById: bob.id,
    },
  });

  // === Assets for Project 1 ===
  const asset1 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000030',
      projectId: project1.id,
      uploadedById: alice.id,
      type: 'video',
      originalUrl: '/assets/intro-clip.mp4',
      status: 'ready',
      metadata: { duration_ms: 15000, width: 1920, height: 1080, codec: 'h264', file_size_bytes: 5242880 },
    },
  });

  const asset2 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000031',
      projectId: project1.id,
      uploadedById: alice.id,
      type: 'video',
      originalUrl: '/assets/product-shot.mp4',
      status: 'ready',
      metadata: { duration_ms: 30000, width: 1920, height: 1080, codec: 'h264', file_size_bytes: 10485760 },
    },
  });

  const asset3 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000032',
      projectId: project1.id,
      uploadedById: bob.id,
      type: 'audio',
      originalUrl: '/assets/background-music.mp3',
      status: 'ready',
      metadata: { duration_ms: 120000, codec: 'mp3', file_size_bytes: 3145728 },
    },
  });

  const asset4 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000033',
      projectId: project1.id,
      uploadedById: alice.id,
      type: 'image',
      originalUrl: '/assets/logo-overlay.png',
      status: 'ready',
      metadata: { width: 400, height: 400, file_size_bytes: 51200 },
    },
  });

  // === Tracks for Project 1 ===
  const videoTrack1 = await prisma.track.create({
    data: {
      id: '00000000-0000-0000-0000-000000000040',
      projectId: project1.id,
      type: 'video',
      label: 'V1',
      orderIndex: 0,
      color: '#3b82f6',
    },
  });

  const videoTrack2 = await prisma.track.create({
    data: {
      id: '00000000-0000-0000-0000-000000000041',
      projectId: project1.id,
      type: 'video',
      label: 'V2',
      orderIndex: 1,
      color: '#8b5cf6',
    },
  });

  const audioTrack = await prisma.track.create({
    data: {
      id: '00000000-0000-0000-0000-000000000042',
      projectId: project1.id,
      type: 'audio',
      label: 'A1',
      orderIndex: 2,
      color: '#22c55e',
    },
  });

  // === Clips (5+ clips) ===
  const clip1 = await prisma.clip.create({
    data: {
      id: '00000000-0000-0000-0000-000000000050',
      trackId: videoTrack1.id,
      projectId: project1.id,
      assetId: asset1.id,
      trackPositionMs: 0,
      inPointMs: 0,
      outPointMs: 10000,
      durationMs: 10000,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    },
  });

  const clip2 = await prisma.clip.create({
    data: {
      id: '00000000-0000-0000-0000-000000000051',
      trackId: videoTrack1.id,
      projectId: project1.id,
      assetId: asset2.id,
      trackPositionMs: 10000,
      inPointMs: 5000,
      outPointMs: 25000,
      durationMs: 20000,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    },
  });

  const clip3 = await prisma.clip.create({
    data: {
      id: '00000000-0000-0000-0000-000000000052',
      trackId: videoTrack1.id,
      projectId: project1.id,
      assetId: asset1.id,
      trackPositionMs: 30000,
      inPointMs: 10000,
      outPointMs: 15000,
      durationMs: 5000,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    },
  });

  const clip4 = await prisma.clip.create({
    data: {
      id: '00000000-0000-0000-0000-000000000053',
      trackId: videoTrack2.id,
      projectId: project1.id,
      assetId: asset4.id,
      trackPositionMs: 0,
      inPointMs: 0,
      outPointMs: 35000,
      durationMs: 35000,
      transform: { x: 0.8, y: 0.1, scale: 0.2, rotation: 0, opacity: 0.8 },
    },
  });

  const clip5 = await prisma.clip.create({
    data: {
      id: '00000000-0000-0000-0000-000000000054',
      trackId: audioTrack.id,
      projectId: project1.id,
      assetId: asset3.id,
      trackPositionMs: 0,
      inPointMs: 0,
      outPointMs: 35000,
      durationMs: 35000,
    },
  });

  // === Clip Effects ===
  await prisma.clipEffect.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000060',
        clipId: clip1.id,
        type: 'brightness',
        orderIndex: 0,
        params: { value: 1.1 },
        enabled: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000061',
        clipId: clip1.id,
        type: 'contrast',
        orderIndex: 1,
        params: { value: 1.05 },
        enabled: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000062',
        clipId: clip2.id,
        type: 'saturation',
        orderIndex: 0,
        params: { value: 1.3 },
        enabled: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000063',
        clipId: clip2.id,
        type: 'blur',
        orderIndex: 1,
        params: { value: 0 },
        enabled: false,
      },
    ],
  });

  // === Transition between clip1 → clip2 ===
  await prisma.transition.create({
    data: {
      id: '00000000-0000-0000-0000-000000000070',
      projectId: project1.id,
      fromClipId: clip1.id,
      toClipId: clip2.id,
      type: 'dissolve',
      durationMs: 500,
      params: {},
    },
  });

  // === Text Overlay ===
  await prisma.textOverlay.create({
    data: {
      id: '00000000-0000-0000-0000-000000000080',
      projectId: project1.id,
      trackPositionMs: 0,
      durationMs: 5000,
      content: 'Product Launch 2024',
      fontFamily: 'Inter',
      fontSize: 48,
      fontColor: '#ffffff',
      positionX: 0.5,
      positionY: 0.3,
      alignment: 'center',
      backgroundColor: '#000000',
      backgroundOpacity: 0.5,
      animation: 'fade_in',
    },
  });

  console.log('✅ Seed data created successfully');
  console.log(`   Users: 2 (alice, bob)`);
  console.log(`   Workspace: 1 (Creative Studio)`);
  console.log(`   Projects: 2`);
  console.log(`   Assets: 4`);
  console.log(`   Tracks: 3`);
  console.log(`   Clips: 5`);
  console.log(`   Effects: 4`);
  console.log(`   Transitions: 1`);
  console.log(`   Text Overlays: 1`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
