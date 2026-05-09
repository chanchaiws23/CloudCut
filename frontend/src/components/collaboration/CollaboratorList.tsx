import { usePresence } from '../../hooks/usePresence';
import { msToTimecode } from '../../utils/timecode';

interface CollaboratorListProps {
  projectId: string;
}

export function CollaboratorList({ projectId }: CollaboratorListProps) {
  const { onlineUsers } = usePresence(projectId);

  if (onlineUsers.length === 0) return null;

  return (
    <div className="px-3 py-2">
      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Online ({onlineUsers.length})
      </h4>
      <div className="space-y-1.5">
        {onlineUsers.map((user) => (
          <div key={user.userId} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: user.color }}
            />
            <span className="text-xs text-foreground truncate flex-1">{user.name}</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {msToTimecode(user.currentTimeMs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
