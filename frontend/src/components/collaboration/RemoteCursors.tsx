import { usePresence } from '../../hooks/usePresence';
import { msToPx } from '../../utils/timecode';

interface RemoteCursorsProps {
  projectId: string;
  zoomLevel: number;
  scrollPosition: number;
}

export function RemoteCursors({ projectId, zoomLevel, scrollPosition }: RemoteCursorsProps) {
  const { onlineUsers } = usePresence(projectId);

  return (
    <>
      {onlineUsers.map((user) => {
        const left = msToPx(user.currentTimeMs, zoomLevel) - scrollPosition;
        if (left < 0) return null;
        return (
          <div
            key={user.userId}
            className="absolute top-0 bottom-0 pointer-events-none z-30"
            style={{ left }}
          >
            <div className="absolute top-0 -translate-x-1/2 px-1 py-0.5 rounded text-[10px] text-white whitespace-nowrap"
              style={{ backgroundColor: user.color }}>
              {user.name}
            </div>
            <div className="absolute top-5 bottom-0 w-px opacity-50" style={{ backgroundColor: user.color }} />
          </div>
        );
      })}
    </>
  );
}
