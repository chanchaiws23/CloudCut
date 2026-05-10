import { create } from 'zustand';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

interface YjsState {
  doc: Y.Doc | null;
  provider: WebrtcProvider | null;
  awareness: any;
  isConnected: boolean;

  init: (projectId: string) => void;
  destroy: () => void;
}

export const useYjsStore = create<YjsState>((set, get) => ({
  doc: null,
  provider: null,
  awareness: null,
  isConnected: false,

  init: (projectId: string) => {
    const existing = get();
    if (existing.doc) return;

    const doc = new Y.Doc();
    const provider = new WebrtcProvider(`cloudcut-${projectId}`, doc, {
      signaling: ['wss://signaling.yjs.dev'],
    });

    provider.on('status', (event: { connected: boolean }) => {
      set({ isConnected: event.connected });
    });

    set({
      doc,
      provider,
      awareness: provider.awareness,
      isConnected: false,
    });
  },

  destroy: () => {
    const { provider, doc } = get();
    provider?.destroy();
    doc?.destroy();
    set({ doc: null, provider: null, awareness: null, isConnected: false });
  },
}));
