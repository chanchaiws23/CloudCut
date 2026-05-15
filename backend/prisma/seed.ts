import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const prisma = new PrismaClient();
const ffmpegPath = process.env.FFMPEG_PATH || (require('ffmpeg-static') as string | null);

function uuidV7Like(offsetMs = 0): string {
  const ts = BigInt(Date.now() + offsetMs).toString(16).padStart(12, '0').slice(-12);
  const suffix = `7000${Math.abs(offsetMs).toString(16).padStart(16, '0')}`.slice(0, 19);
  return `${ts.slice(0, 8)}-${ts.slice(8, 12)}-7${suffix.slice(0, 3)}-8${suffix.slice(3, 6)}-${suffix.slice(6, 18)}`;
}

function ensureSeedMedia() {
  const demoDir = path.join(process.cwd(), 'uploads', 'demo');
  fs.mkdirSync(demoDir, { recursive: true });

  const media = {
    aliceHero: path.join(demoDir, 'alice-product-hero.mp4'),
    aliceBroll: path.join(demoDir, 'alice-editor-broll.mp4'),
    aliceAudio: path.join(demoDir, 'alice-music-bed.m4a'),
    bobVideo: path.join(demoDir, 'bob-social-reel.mp4'),
    bobAudio: path.join(demoDir, 'bob-reel-audio.m4a'),
    alicePoster: path.join(demoDir, 'alice-product-poster.jpg'),
    bobPoster: path.join(demoDir, 'bob-reel-poster.jpg'),
    waveform: path.join(demoDir, 'seed-waveform.json'),
  };

  if (!ffmpegPath) {
    console.warn('ffmpeg-static was not found; existing seed media files will be reused if present.');
    return;
  }

  const runFfmpeg = (args: string[]) => execFileSync(ffmpegPath, ['-y', ...args], { stdio: 'ignore' });

  runFfmpeg([
    '-f', 'lavfi',
    '-i', 'color=c=0x0f172a:s=1280x720:r=30',
    '-f', 'lavfi',
    '-i', 'sine=frequency=392:sample_rate=48000',
    '-t', '18',
    '-vf',
    [
      "drawbox=x=80:y=132:w=520:h=350:color=0x2563eb@0.88:t=fill",
      "drawbox=x=760:y=110:w=360:h=430:color=0x14b8a6@0.70:t=fill",
      "drawbox=x=1010:y=72:w=120:h=120:color=0xfacc15@0.92:t=fill",
      "drawtext=text='CloudCut Launch Cut':fontcolor=white:fontsize=54:x=110:y=176",
      "drawtext=text='Hero shot  B roll  End card':fontcolor=0xcbd5e1:fontsize=28:x=110:y=258",
      "drawtext=text='Edited timeline preview':fontcolor=0x0f172a:fontsize=30:x=810:y=305",
      "fade=t=in:st=0:d=0.4,fade=t=out:st=17.4:d=0.6",
    ].join(','),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    media.aliceHero,
  ]);

  runFfmpeg([
    '-f', 'lavfi',
    '-i', 'color=c=0x111827:s=1280x720:r=30',
    '-f', 'lavfi',
    '-i', 'sine=frequency=523:sample_rate=48000',
    '-t', '10',
    '-vf',
    [
      "drawbox=x=86:y=80:w=1100:h=560:color=0x1e293b@0.95:t=fill",
      "drawbox=x=140:y=150:w=760:h=330:color=0x334155@1:t=fill",
      "drawbox=x=170:y=185:w=700:h=36:color=0x3b82f6@0.95:t=fill",
      "drawbox=x=170:y=245:w=310:h=170:color=0x22c55e@0.85:t=fill",
      "drawbox=x=520:y=245:w=310:h=170:color=0xf97316@0.85:t=fill",
      "drawtext=text='Asset browser  Preview  Inspector':fontcolor=white:fontsize=34:x=150:y=102",
      "drawtext=text='Timeline editing pass':fontcolor=0xdbeafe:fontsize=42:x=170:y=515",
      "fade=t=in:st=0:d=0.25,fade=t=out:st=9.5:d=0.5",
    ].join(','),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    media.aliceBroll,
  ]);

  runFfmpeg([
    '-f', 'lavfi',
    '-i', 'sine=frequency=196:sample_rate=48000',
    '-f', 'lavfi',
    '-i', 'sine=frequency=392:sample_rate=48000',
    '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=shortest,volume=0.45',
    '-t', '23',
    '-vn',
    '-c:a', 'aac',
    media.aliceAudio,
  ]);

  runFfmpeg([
    '-f', 'lavfi',
    '-i', 'color=c=0x020617:s=720x1280:r=30',
    '-f', 'lavfi',
    '-i', 'sine=frequency=660:sample_rate=48000',
    '-t', '16',
    '-vf',
    [
      "drawbox=x=72:y=120:w=576:h=740:color=0xec4899@0.78:t=fill",
      "drawbox=x=118:y=220:w=484:h=420:color=0x111827@0.72:t=fill",
      "drawbox=x=86:y=920:w=548:h=170:color=0x38bdf8@0.82:t=fill",
      "drawtext=text='SOCIAL REEL':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=270",
      "drawtext=text='Vertical edit with overlays':fontcolor=0xfdf2f8:fontsize=34:x=(w-text_w)/2:y=362",
      "drawtext=text='Ready for export':fontcolor=0x020617:fontsize=40:x=(w-text_w)/2:y=980",
      "fade=t=in:st=0:d=0.25,fade=t=out:st=15.4:d=0.6",
    ].join(','),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    media.bobVideo,
  ]);

  runFfmpeg([
    '-f', 'lavfi',
    '-i', 'sine=frequency=330:sample_rate=48000',
    '-f', 'lavfi',
    '-i', 'sine=frequency=660:sample_rate=48000',
    '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=shortest,volume=0.42',
    '-t', '16',
    '-vn',
    '-c:a', 'aac',
    media.bobAudio,
  ]);

  runFfmpeg([
    '-i', media.aliceHero,
    '-frames:v', '1',
    '-q:v', '3',
    media.alicePoster,
  ]);

  runFfmpeg([
    '-i', media.bobVideo,
    '-frames:v', '1',
    '-q:v', '3',
    media.bobPoster,
  ]);

  const peaks = Array.from({ length: 160 }, (_, index) => {
    const value = Math.sin(index / 5) * 0.55 + Math.sin(index / 13) * 0.25;
    return { min: Number((-Math.abs(value)).toFixed(3)), max: Number(Math.abs(value).toFixed(3)) };
  });
  fs.writeFileSync(media.waveform, JSON.stringify({ sampleRate: 48000, samplesPerPeak: 2048, peaks }, null, 2));

  for (const staleFile of ['_drawtext_test.mp4', 'alice-product-demo.mp4']) {
    const stalePath = path.join(demoDir, staleFile);
    if (fs.existsSync(stalePath)) fs.unlinkSync(stalePath);
  }
}

async function main() {
  ensureSeedMedia();

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
      { workspaceId: freeWorkspace.id, userId: bob.id, role: 'editor' },
      { workspaceId: proWorkspace.id, userId: bob.id, role: 'owner' },
    ],
  });

  await prisma.invitation.create({
    data: {
      id: '00000000-0000-0000-0000-000000000012',
      workspaceId: freeWorkspace.id,
      email: 'reviewer@cloudcut.dev',
      role: 'viewer',
      status: 'pending',
      token: 'seed-reviewer-invite-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
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

  // === Local generated media served by NestJS static assets (/uploads/demo/*) ===
  const ALICE_HERO_VIDEO = '/uploads/demo/alice-product-hero.mp4';
  const ALICE_BROLL_VIDEO = '/uploads/demo/alice-editor-broll.mp4';
  const ALICE_AUDIO = '/uploads/demo/alice-music-bed.m4a';
  const BOB_VIDEO = '/uploads/demo/bob-social-reel.mp4';
  const BOB_AUDIO = '/uploads/demo/bob-reel-audio.m4a';
  const ALICE_POSTER = '/uploads/demo/alice-product-poster.jpg';
  const BOB_POSTER = '/uploads/demo/bob-reel-poster.jpg';
  const WAVEFORM_JSON = '/uploads/demo/seed-waveform.json';

  // === Assets for Project 1 (Free workspace) ===
  const asset1 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000030',
      projectId: project1.id,
      uploadedById: alice.id,
      type: 'video',
      originalUrl: ALICE_HERO_VIDEO,
      status: 'ready',
      metadata: { duration_ms: 18000, width: 1280, height: 720, codec: 'h264', audio_codec: 'aac', audio_channels: 1, file_size_bytes: 7200000 },
    },
  });

  const asset2 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000031',
      projectId: project1.id,
      uploadedById: alice.id,
      type: 'video',
      originalUrl: ALICE_BROLL_VIDEO,
      status: 'ready',
      metadata: { duration_ms: 10000, width: 1280, height: 720, codec: 'h264', audio_codec: 'aac', audio_channels: 1, file_size_bytes: 3800000 },
    },
  });

  const asset3 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000032',
      projectId: project1.id,
      uploadedById: alice.id,
      type: 'audio',
      originalUrl: ALICE_AUDIO,
      status: 'ready',
      metadata: { duration_ms: 23000, codec: 'aac', audio_channels: 1, file_size_bytes: 420000 },
    },
  });

  const asset4 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000033',
      projectId: project1.id,
      uploadedById: alice.id,
      type: 'image',
      originalUrl: ALICE_POSTER,
      status: 'ready',
      metadata: { width: 1280, height: 720, file_size_bytes: 120000 },
    },
  });

  // === Assets for Project 2 (Pro workspace) ===
  const asset5 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000034',
      projectId: project2.id,
      uploadedById: bob.id,
      type: 'video',
      originalUrl: BOB_VIDEO,
      status: 'ready',
      metadata: { duration_ms: 16000, width: 720, height: 1280, codec: 'h264', audio_codec: 'aac', audio_channels: 1, file_size_bytes: 850000 },
    },
  });

  const asset6 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000035',
      projectId: project2.id,
      uploadedById: bob.id,
      type: 'image',
      originalUrl: BOB_POSTER,
      status: 'ready',
      metadata: { width: 720, height: 1280, file_size_bytes: 110000 },
    },
  });

  const asset7 = await prisma.asset.create({
    data: {
      id: '00000000-0000-0000-0000-000000000036',
      projectId: project2.id,
      uploadedById: bob.id,
      type: 'audio',
      originalUrl: BOB_AUDIO,
      status: 'ready',
      metadata: { duration_ms: 16000, codec: 'aac', audio_channels: 1, file_size_bytes: 310000 },
    },
  });

  // === Asset Variants ===
  await prisma.assetVariant.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000100',
        assetId: asset1.id,
        type: 'proxy',
        url: ALICE_HERO_VIDEO,
        metadata: { resolution: '1280x720', bitrate: 1400 },
      },
      {
        id: '00000000-0000-0000-0000-000000000101',
        assetId: asset1.id,
        type: 'thumbnail_strip',
        url: ALICE_POSTER,
        metadata: { interval_ms: 1000, count: 18 },
      },
      {
        id: '00000000-0000-0000-0000-000000000102',
        assetId: asset3.id,
        type: 'waveform_data',
        url: WAVEFORM_JSON,
        metadata: { samples: 120, channels: 1 },
      },
      {
        id: '00000000-0000-0000-0000-000000000106',
        assetId: asset2.id,
        type: 'proxy',
        url: ALICE_BROLL_VIDEO,
        metadata: { resolution: '1280x720', bitrate: 1200 },
      },
      {
        id: '00000000-0000-0000-0000-000000000103',
        assetId: asset5.id,
        type: 'proxy',
        url: BOB_VIDEO,
        metadata: { resolution: '720x1280', bitrate: 850 },
      },
      {
        id: '00000000-0000-0000-0000-000000000104',
        assetId: asset5.id,
        type: 'thumbnail_strip',
        url: BOB_POSTER,
        metadata: { interval_ms: 1000, count: 16 },
      },
      {
        id: '00000000-0000-0000-0000-000000000105',
        assetId: asset7.id,
        type: 'waveform_data',
        url: WAVEFORM_JSON,
        metadata: { samples: 120, channels: 1 },
      },
    ],
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

  // === Tracks for Project 2 ===
  const bobVideoTrack = await prisma.track.create({
    data: {
      id: '00000000-0000-0000-0000-000000000043',
      projectId: project2.id,
      type: 'video',
      label: 'V1',
      orderIndex: 0,
      color: '#3b82f6',
    },
  });

  const bobOverlayTrack = await prisma.track.create({
    data: {
      id: '00000000-0000-0000-0000-000000000044',
      projectId: project2.id,
      type: 'video',
      label: 'V2',
      orderIndex: 1,
      color: '#f97316',
    },
  });

  const bobAudioTrack = await prisma.track.create({
    data: {
      id: '00000000-0000-0000-0000-000000000045',
      projectId: project2.id,
      type: 'audio',
      label: 'A1',
      orderIndex: 2,
      color: '#22c55e',
    },
  });

  // === Clips (8 clips across both seeded projects) ===
  const clip1 = await prisma.clip.create({
    data: {
      id: '00000000-0000-0000-0000-000000000050',
      trackId: videoTrack1.id,
      projectId: project1.id,
      assetId: asset1.id,
      trackPositionMs: 0,
      inPointMs: 0,
      outPointMs: 8000,
      durationMs: 8000,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    },
  });

  const clip2 = await prisma.clip.create({
    data: {
      id: '00000000-0000-0000-0000-000000000051',
      trackId: videoTrack1.id,
      projectId: project1.id,
      assetId: asset2.id,
      trackPositionMs: 8000,
      inPointMs: 0,
      outPointMs: 10000,
      durationMs: 10000,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    },
  });

  const clip3 = await prisma.clip.create({
    data: {
      id: '00000000-0000-0000-0000-000000000052',
      trackId: videoTrack1.id,
      projectId: project1.id,
      assetId: asset1.id,
      trackPositionMs: 18000,
      inPointMs: 13000,
      outPointMs: 18000,
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
      trackPositionMs: 2000,
      inPointMs: 0,
      outPointMs: 8000,
      durationMs: 8000,
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
      outPointMs: 18000,
      durationMs: 18000,
    },
  });

  const clip6 = await prisma.clip.create({
    data: {
      id: '00000000-0000-0000-0000-000000000055',
      trackId: bobVideoTrack.id,
      projectId: project2.id,
      assetId: asset5.id,
      trackPositionMs: 0,
      inPointMs: 0,
      outPointMs: 7000,
      durationMs: 7000,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
    },
  });

  const clip7 = await prisma.clip.create({
    data: {
      id: '00000000-0000-0000-0000-000000000056',
      trackId: bobVideoTrack.id,
      projectId: project2.id,
      assetId: asset5.id,
      trackPositionMs: 7000,
      inPointMs: 7000,
      outPointMs: 16000,
      durationMs: 9000,
      transform: { x: 0, y: 0, scale: 1.05, rotation: 0, opacity: 1 },
    },
  });

  const clip8 = await prisma.clip.create({
    data: {
      id: '00000000-0000-0000-0000-000000000057',
      trackId: bobOverlayTrack.id,
      projectId: project2.id,
      assetId: asset6.id,
      trackPositionMs: 1200,
      inPointMs: 0,
      outPointMs: 5000,
      durationMs: 5000,
      transform: { x: 0.68, y: -0.25, scale: 0.28, rotation: -4, opacity: 0.9 },
    },
  });

  const clip9 = await prisma.clip.create({
    data: {
      id: '00000000-0000-0000-0000-000000000058',
      trackId: bobAudioTrack.id,
      projectId: project2.id,
      assetId: asset7.id,
      trackPositionMs: 0,
      inPointMs: 0,
      outPointMs: 16000,
      durationMs: 16000,
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
      {
        id: '00000000-0000-0000-0000-000000000064',
        clipId: clip6.id,
        type: 'contrast',
        orderIndex: 0,
        params: { value: 1.15 },
        enabled: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000065',
        clipId: clip7.id,
        type: 'saturation',
        orderIndex: 0,
        params: { value: 1.25 },
        enabled: true,
      },
    ],
  });

  // === Transitions ===
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

  await prisma.transition.create({
    data: {
      id: '00000000-0000-0000-0000-000000000071',
      projectId: project2.id,
      fromClipId: clip6.id,
      toClipId: clip7.id,
      type: 'fade',
      durationMs: 400,
      params: { curve: 'ease-in-out' },
    },
  });

  // === Text Overlays ===
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

  await prisma.textOverlay.create({
    data: {
      id: '00000000-0000-0000-0000-000000000081',
      projectId: project2.id,
      trackPositionMs: 500,
      durationMs: 4500,
      content: 'Weekend Drop',
      fontFamily: 'Inter',
      fontSize: 52,
      fontColor: '#ffffff',
      positionX: 0.5,
      positionY: 0.18,
      alignment: 'center',
      backgroundColor: '#111827',
      backgroundOpacity: 0.35,
      animation: 'typewriter',
    },
  });

  await prisma.exportJob.create({
    data: {
      id: '00000000-0000-0000-0000-000000000090',
      projectId: project1.id,
      requestedById: alice.id,
      format: 'mp4',
      resolution: '1080p',
      quality: 'standard',
      status: 'completed',
      progressPercent: 100,
      outputUrl: 'uploads/demo/alice-product-hero.mp4',
      outputFileSize: BigInt(7200000),
      startedAt: new Date(Date.now() - 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 55 * 60 * 1000),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      idempotencyKey: 'seed-export-product-demo-1080p',
    },
  });

  await prisma.exportJob.create({
    data: {
      id: '00000000-0000-0000-0000-000000000091',
      projectId: project2.id,
      requestedById: bob.id,
      format: 'mp4',
      resolution: '1080p',
      quality: 'draft',
      status: 'completed',
      progressPercent: 100,
      outputUrl: 'uploads/demo/bob-social-reel.mp4',
      outputFileSize: BigInt(850000),
      startedAt: new Date(Date.now() - 30 * 60 * 1000),
      completedAt: new Date(Date.now() - 25 * 60 * 1000),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      idempotencyKey: 'seed-export-social-reel-1080p',
    },
  });

  await prisma.operationLog.createMany({
    data: [
      {
        id: uuidV7Like(1),
        projectId: project1.id,
        userId: alice.id,
        operationType: 'clip.add',
        payload: { clipId: clip1.id, trackId: videoTrack1.id, trackPositionMs: 0 },
        clientSeq: 1,
      },
      {
        id: uuidV7Like(2),
        projectId: project1.id,
        userId: bob.id,
        operationType: 'effect.update',
        payload: { clipId: clip1.id, effectType: 'brightness', params: { value: 1.1 } },
        clientSeq: 2,
      },
      {
        id: uuidV7Like(3),
        projectId: project2.id,
        userId: bob.id,
        operationType: 'clip.add',
        payload: { clipId: clip6.id, trackId: bobVideoTrack.id, trackPositionMs: 0 },
        clientSeq: 1,
      },
      {
        id: uuidV7Like(4),
        projectId: project2.id,
        userId: bob.id,
        operationType: 'clip.move',
        payload: { clipId: clip7.id, trackPositionMs: 7000 },
        clientSeq: 2,
      },
    ],
  });

  console.log('Seed data created successfully');
  console.log(`   Users: 2 (alice@cloudcut.dev = free, bob@cloudcut.dev = pro)`);
  console.log(`   Workspaces: 2 (Alice Free Studio = free, Bob Pro Studio = pro)`);
  console.log(`   Invitations: 1`);
  console.log(`   Projects: 2`);
  console.log(`   Assets: 7`);
  console.log(`   Asset Variants: 7`);
  console.log(`   Tracks: 6`);
  console.log(`   Clips: 9`);
  console.log(`   Effects: 6`);
  console.log(`   Transitions: 2`);
  console.log(`   Text Overlays: 2`);
  console.log(`   Export Jobs: 2`);
  console.log(`   Operation Logs: 4`);
  console.log(`   Local media: uploads/demo/alice-product-hero.mp4, uploads/demo/alice-editor-broll.mp4, uploads/demo/bob-social-reel.mp4`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
