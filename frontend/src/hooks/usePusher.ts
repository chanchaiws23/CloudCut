import { useEffect, useRef } from 'react';
import Pusher from 'pusher-js';

let pusherInstance: Pusher | null = null;

export function getPusher(): Pusher {
  const key = import.meta.env.VITE_PUSHER_KEY || '';
  if (!key) {
    throw new Error('Missing VITE_PUSHER_KEY');
  }
  if (!pusherInstance) {
    pusherInstance = new Pusher(key, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER || 'ap1',
      authEndpoint: `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/collaboration/pusher/auth`,
      auth: {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`,
        },
      },
    });
  }
  return pusherInstance;
}

export function usePusher() {
  return getPusher();
}

export function usePusherChannel(channelName: string, events: Record<string, (data: any) => void>) {
  const handlersRef = useRef(events);
  handlersRef.current = events;

  useEffect(() => {
    if (!channelName) return;
    let pusher: Pusher;
    try {
      pusher = getPusher();
    } catch {
      return;
    }
    const channel = pusher.subscribe(channelName);

    Object.keys(handlersRef.current).forEach((event) => {
      channel.bind(event, (data: any) => handlersRef.current[event]?.(data));
    });

    return () => {
      pusher.unsubscribe(channelName);
    };
  }, [channelName]);
}
