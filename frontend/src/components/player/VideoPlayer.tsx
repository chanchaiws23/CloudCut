import { useRef, useEffect, useCallback, useState } from 'react';
import { usePlaybackStore } from '../../state/playbackStore';
import { useProjectStore } from '../../state/projectStore';
import { PlayerControls } from './PlayerControls';
import { msToTimecode } from '../../utils/timecode';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const DEMO_MEDIA_FALLBACKS: Record<string, string> = {
  ForBiggerBlazes: '/uploads/demo/ForBiggerBlazes.mp4',
  BigBuckBunny: '/uploads/demo/BigBuckBunny.mp4',
};

function toAbsoluteUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const fallback = Object.entries(DEMO_MEDIA_FALLBACKS)
    .find(([key]) => url.includes(key))?.[1];
  if (fallback) return `${BASE_URL}${fallback}`;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

function usableVariantUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('/uploads/')) return url;
  return undefined;
}

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const clockRef = useRef<number | null>(null);

  const { currentTimeMs, isPlaying, playbackSpeed, volume, isMuted, durationMs, pause, seek, setDuration } = usePlaybackStore();
  const { clips, assets } = useProjectStore();
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    const timelineDurationMs = clips.reduce(
      (max, clip) => Math.max(max, clip.trackPositionMs + clip.durationMs),
      0,
    );
    setDuration(timelineDurationMs);
  }, [clips, setDuration]);

  const currentClip = clips
    .filter((c) => c.trackPositionMs <= currentTimeMs && currentTimeMs < c.trackPositionMs + c.durationMs)
    .sort((a, b) => {
      const aAsset = a.asset ?? assets.find((asset) => asset.id === a.assetId);
      const bAsset = b.asset ?? assets.find((asset) => asset.id === b.assetId);
      const aIsVisual = aAsset?.type === 'video' || aAsset?.type === 'image';
      const bIsVisual = bAsset?.type === 'video' || bAsset?.type === 'image';
      if (aIsVisual && !bIsVisual) return -1;
      if (!aIsVisual && bIsVisual) return 1;
      return b.trackPositionMs - a.trackPositionMs;
    })[0];

  const currentAsset = currentClip?.assetId
    ? assets.find((a) => a.id === currentClip.assetId) ?? currentClip.asset
    : currentClip?.asset;

  const mediaUrl = toAbsoluteUrl(
    usableVariantUrl(currentAsset?.variants?.find((v) => v.type === 'proxy')?.url)
    ?? currentAsset?.originalUrl,
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaUrl || currentAsset?.type !== 'video') return;
    const inVideoTime = currentClip
      ? (currentTimeMs - currentClip.trackPositionMs + currentClip.inPointMs) / 1000
      : 0;
    if (Math.abs(video.currentTime - inVideoTime) > 0.1) {
      video.currentTime = inVideoTime;
    }
  }, [currentTimeMs, currentClip, mediaUrl, currentAsset?.type]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || currentAsset?.type !== 'video') return;
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, currentAsset?.type, mediaUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      const video = videoRef.current;
      if (!video || !currentClip || currentAsset?.type !== 'video') return;
      const inVideoTimeMs = video.currentTime * 1000;
      const timelineMs = currentClip.trackPositionMs + (inVideoTimeMs - currentClip.inPointMs);
      seek(timelineMs);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, currentClip, currentAsset?.type, seek]);

  useEffect(() => {
    if (!isPlaying || currentAsset?.type === 'video') {
      clockRef.current = null;
      return;
    }

    const tick = (now: number) => {
      const previous = clockRef.current ?? now;
      clockRef.current = now;
      const nextTime = currentTimeMs + (now - previous) * playbackSpeed;
      if (durationMs > 0 && nextTime >= durationMs) {
        seek(durationMs);
        pause();
        return;
      }
      seek(nextTime);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, currentAsset?.type, currentTimeMs, durationMs, playbackSpeed, pause, seek]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setVideoError(null);
  }, []);

  useEffect(() => {
    setVideoError(null);
  }, [mediaUrl]);

  const currentEffects = currentClip
    ? (useProjectStore.getState().effects[currentClip.id] || []).filter((e) => e.enabled)
    : [];

  const cssFilter = currentEffects
    .map((e) => {
      switch (e.type) {
        case 'brightness': return `brightness(${1 + (e.params.value || 0) / 100})`;
        case 'contrast': return `contrast(${e.params.value || 1})`;
        case 'saturation': return `saturate(${e.params.value || 1})`;
        case 'blur': return `blur(${e.params.value || 0}px)`;
        default: return '';
      }
    })
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-muted/30 dark:bg-black">
        {mediaUrl && currentAsset?.type === 'image' ? (
          <img
            src={mediaUrl}
            className="max-w-full max-h-full object-contain"
            style={{ filter: cssFilter || undefined }}
            onError={() => setVideoError('Image failed to load')}
            alt=""
          />
        ) : mediaUrl ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            crossOrigin="anonymous"
            className="max-w-full max-h-full object-contain"
            style={{ filter: cssFilter || undefined }}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => pause()}
            onError={(e) => {
              const err = (e.target as HTMLVideoElement).error;
              const msg = err ? `Video error ${err.code}: ${err.message}` : 'Unknown video error';
              setVideoError(msg);
              console.warn('[VideoPlayer] failed to load:', mediaUrl, msg);
            }}
          />
        ) : (
          <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <span className="text-2xl">CC</span>
            </div>
            <span>No clip at playhead</span>
            <span className="text-xs opacity-60">
              clips: {clips.length}, assets: {assets.length}
            </span>
          </div>
        )}

        {videoError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 dark:bg-black/80 z-10">
            <div className="text-red-400 text-sm text-center max-w-md px-4">
              <p className="font-medium mb-1">Video failed to load</p>
              <p className="text-xs opacity-80 mb-2">{videoError}</p>
              <p className="text-xs opacity-60 break-all">{mediaUrl}</p>
              <p className="text-xs opacity-60 mt-1">
                asset: {currentAsset?.type || 'unknown'} | id: {currentAsset?.id?.slice(0, 8) || 'none'}
              </p>
            </div>
          </div>
        )}

        <div className="absolute top-2 right-2 text-xs font-mono text-foreground bg-card/80 border border-border px-2 py-1 rounded backdrop-blur">
          {msToTimecode(currentTimeMs)} / {msToTimecode(durationMs)}
        </div>
      </div>

      <PlayerControls />
    </div>
  );
}
