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

  // === Free Workspace (Alice) ===
  const freeWorkspace = await prisma.workspace.create({
    data: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Alice Free Studio',
      slug: 'alice-free-studio',
      plan: 'free',
      ownerId: alice.id,
    },
  });

  // === Pro Workspace (Bob) ===
  const proWorkspace = await prisma.workspace.create({
    data: {
      id: '00000000-0000-0000-0000-000000000011',
      name: 'Bob Pro Studio',
      slug: 'bob-pro-studio',
      plan: 'pro',
      ownerId: bob.id,
    },
  });

  // === Workspace Members ===
  await prisma.workspaceMember.createMany({
    data: [
      { workspaceId: freeWorkspace.id, userId: alice.id, role: 'owner' },
      { workspaceId: proWorkspace.id, userId: bob.id, role: 'owner' },
    ],
  });

  // === Free Project: Product Demo ===
  const project1 = await prisma.project.create({
    data: {
      id: '00000000-0000-0000-0000-000000000020',
      workspaceId: freeWorkspace.id,
      name: 'Product Demo Video',
      description: 'Q4 product launch demo video (Free plan)',
      settings: { resolution: '1920x1080', fps: 30, aspectRatio: '16:9' },
      createdById: alice.id,
    },
  });

  // === Pro Project: Social Media ===
  const project2 = await prisma.project.create({
    data: {
      id: '00000000-0000-0000-0000-000000000021',
      workspaceId: proWorkspace.id,
      name: 'Social Media Reel',
      description: 'Instagram reel for marketing campaign (Pro plan)',
      settings: { resolution: '1080x1920', fps: 30, aspectRatio: '9:16' },
      createdById: bob.id,
    },
  });

  // === Public sample URLs for demo (CORS-enabled) ===
  const SAMPLE_VIDEO_15S = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
  const SAMPLE_VIDEO_10MIN = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  const SAMPLE_IMAGE = 'https://picsum.photos/400/400';

  // === Assets for Project 1 (Free workspace) ===
  const asset1 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000030',
      projectId: project1.id,
      uploadedById: alice.id,
      type: 'video',
      originalUrl: SAMPLE_VIDEO_15S,
      status: 'ready',
      metadata: { duration_ms: 15000, width: 1280, height: 720, codec: 'h264', file_size_bytes: 2100000 },
    },
  });

  const asset2 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000031',
      projectId: project1.id,
      uploadedById: alice.id,
      type: 'video',
      originalUrl: SAMPLE_VIDEO_10MIN,
      status: 'ready',
      metadata: { duration_ms: 596000, width: 1280, height: 720, codec: 'h264', file_size_bytes: 158008374 },
    },
  });

  const asset3 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000032',
      projectId: project1.id,
      uploadedById: alice.id,
      type: 'audio',
      originalUrl: SAMPLE_VIDEO_10MIN,
      status: 'ready',
      metadata: { duration_ms: 596000, codec: 'aac', file_size_bytes: 158008374 },
    },
  });

  const asset4 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000033',
      projectId: project1.id,
      uploadedById: alice.id,
      type: 'image',
      originalUrl: SAMPLE_IMAGE,
      status: 'ready',
      metadata: { width: 400, height: 400, file_size_bytes: 20000 },
    },
  });

  // === Assets for Project 2 (Pro workspace) ===
  const asset5 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000034',
      projectId: project2.id,
      uploadedById: bob.id,
      type: 'video',
      originalUrl: SAMPLE_VIDEO_15S,
      status: 'ready',
      metadata: { duration_ms: 15000, width: 1280, height: 720, codec: 'h264', file_size_bytes: 2100000 },
    },
  });

  const asset6 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000035',
      projectId: project2.id,
      uploadedById: bob.id,
      type: 'image',
      originalUrl: SAMPLE_IMAGE,
      status: 'ready',
      metadata: { width: 400, height: 400, file_size_bytes: 20000 },
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
  console.log(`   Users: 2 (alice@cloudcut.dev = free, bob@cloudcut.dev = pro)`);
  console.log(`   Workspaces: 2 (Alice Free Studio = free, Bob Pro Studio = pro)`);
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
