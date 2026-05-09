import { useRef, useEffect, useCallback } from 'react';
import { usePlaybackStore } from '../../state/playbackStore';
import { useProjectStore } from '../../state/projectStore';
import { PlayerControls } from './PlayerControls';
import { msToTimecode } from '../../utils/timecode';

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);

  const { currentTimeMs, isPlaying, playbackSpeed, volume, isMuted, durationMs, pause, seek, setDuration } = usePlaybackStore();
  const { clips, assets } = useProjectStore();

  const currentClip = clips
    .filter((c) => c.trackPositionMs <= currentTimeMs && currentTimeMs < c.trackPositionMs + c.durationMs)
    .sort((a, b) => b.trackPositionMs - a.trackPositionMs)[0];

  const currentAsset = currentClip?.assetId
    ? assets.find((a) => a.id === currentClip.assetId)
    : undefined;

  const proxyUrl = currentAsset?.variants?.find((v) => v.type === 'proxy')?.url
    || currentAsset?.originalUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !proxyUrl) return;
    const inVideoTime = currentClip
      ? (currentTimeMs - currentClip.trackPositionMs + currentClip.inPointMs) / 1000
      : 0;
    if (Math.abs(video.currentTime - inVideoTime) > 0.1) {
      video.currentTime = inVideoTime;
    }
  }, [currentTimeMs, currentClip, proxyUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying]);

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
      if (!video || !currentClip) return;
      const inVideoTimeMs = video.currentTime * 1000;
      const timelineMs = currentClip.trackPositionMs + (inVideoTimeMs - currentClip.inPointMs);
      seek(timelineMs);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, currentClip, seek]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration * 1000);
  }, [setDuration]);

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
    <div className="flex flex-col h-full bg-black">
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {proxyUrl ? (
          <video
            ref={videoRef}
            src={proxyUrl}
            className="max-w-full max-h-full object-contain"
            style={{ filter: cssFilter || undefined }}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => pause()}
          />
        ) : (
          <div className="text-muted-foreground text-sm flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <span className="text-2xl">🎬</span>
            </div>
            <span>No clip at playhead</span>
          </div>
        )}

        <div className="absolute top-2 right-2 text-xs font-mono text-white/60 bg-black/40 px-2 py-1 rounded">
          {msToTimecode(currentTimeMs)} / {msToTimecode(durationMs)}
        </div>
      </div>

      <PlayerControls />
    </div>
  );
}
