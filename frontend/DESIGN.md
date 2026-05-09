# Frontend Design Decisions

## Task 5: Editor UI

### 1. State Management: Zustand over Redux

Zustand is lightweight, TypeScript-friendly, and requires minimal boilerplate. It supports synchronous updates which is critical for smooth drag operations on the timeline. Redux would add unnecessary complexity for this use case.

Three stores maintain clear separation:
- `projectStore` — project data + actions (clips, tracks, effects)
- `uiStore` — ephemeral UI state (selection, zoom, scroll)
- `playbackStore` — playback state (currentTime, isPlaying, volume)

### 2. Timeline Rendering: DOM-based over Canvas

DOM approach chosen because:
- Easier debugging (inspect element works)
- Clip selection, hover, and cursor CSS handled natively
- React's reconciliation handles incremental updates efficiently
- Canvas would be better for 1000+ clips, but DOM is sufficient for typical projects (< 100 clips per track)

### 3. Command Pattern for Undo/Redo

Every mutating action (move, trim, split, delete, add effect) creates a `Command` with `execute()` and `undo()`. Keeps undo logic co-located with the action.

Max 50 commands in history to avoid unbounded memory growth.

### 4. Optimistic Updates

Clip mutations are applied immediately to local Zustand state, then API calls fire async. On failure, the store would need to rollback (not yet implemented — could use the undo command).

For collaboration, remote operations come in via Pusher and are applied via `applyRemoteClipUpdate` which bypasses the CommandManager (remote changes should not appear in local undo history).

### 5. Timecode Utilities

All timeline positions are stored and computed in **milliseconds** as integers. Conversion to/from pixels happens only at render time using `msToPx(ms, pxPerSecond)`. This prevents floating-point drift and simplifies sync with audio/video elements.

### 6. Pusher Client Events for Cursors

Cursor movement is sent as Pusher **client events** (no server round-trip) at ~100ms throttle. This reduces API load significantly and provides near-real-time cursor sync.

### 7. CSS Filter Preview for Effects

Rather than re-rendering video frames, effects are previewed using CSS `filter` property on the `<video>` element. This is not pixel-perfect but is fast and covers brightness, contrast, saturation, and blur.

### 8. Why `react-resizable-panels`

Provides accessible, keyboard-navigable resizable panels without custom drag logic. Works well with Tailwind for styling. shadcn/ui uses it internally for their `ResizablePanelGroup`.
