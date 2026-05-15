# CloudCut Frontend Design

เอกสารนี้สรุป decision ของ Task 5: React editor UI, timeline, player, inspector, asset browser, state management และ undo/redo

## 1. State Management: Zustand แทน Redux

เลือก Zustand เพราะ lightweight, ใช้กับ TypeScript ง่าย และ boilerplate น้อย เหมาะกับ editor ที่ต้อง update state ถี่ระหว่าง drag/trim บน timeline

แบ่ง store เป็น 3 ส่วนหลัก:

- `projectStore`: project data และ actions เช่น tracks, clips, effects, transitions, text overlays, assets
- `uiStore`: UI state ชั่วคราว เช่น selected clips, zoom, scroll, active tool, snap, hidden tracks
- `playbackStore`: playback state เช่น current time, playing state, speed, volume, mute, duration

Redux ทำได้เหมือนกันแต่เพิ่ม ceremony มากเกินไปสำหรับ prototype นี้

## 2. Timeline Rendering: DOM-Based

เลือก DOM-based timeline แทน Canvas เพราะ:

- debug ง่ายด้วย browser inspector
- selection, hover, cursor และ accessibility ใช้ CSS/DOM ได้ตรง
- React reconciliation update เฉพาะส่วนที่เปลี่ยนได้ดีพอสำหรับ prototype
- ใช้ drag/trim/drop interaction ได้ง่ายกว่า Canvas

Canvas จะเหมาะกว่าเมื่อมี clips จำนวนมากมาก ๆ เช่น 1,000+ clips ต่อ track แต่สำหรับ editor prototype ที่มี clip ระดับหลักสิบถึงหลักร้อย DOM เพียงพอ

## 3. Timeline Interaction Design

timeline รองรับ:

- track rows พร้อม header controls: lock, mute, visibility
- clip block ตามตำแหน่งและ duration จริงจาก milliseconds
- drag clip ภายใน track หรือข้าม track
- trim ซ้าย/ขวาเพื่อเปลี่ยน in/out point
- split ที่ playhead ด้วย shortcut `S`
- select, shift multi-select, background deselect
- delete selected clips
- copy/paste ด้วย `Ctrl+C` และ `Ctrl+V`
- zoom ด้วยปุ่ม, `Ctrl+wheel`, `Ctrl+0`, `Ctrl++`, `Ctrl+-`
- snap ไปยัง clip edges และ playhead
- กด `Alt` ระหว่าง drag/trim เพื่อปิด snap ชั่วคราว
- draggable playhead

ตำแหน่งทั้งหมดเก็บเป็น milliseconds แล้วแปลงเป็น pixels เฉพาะตอน render ด้วย `msToPx(ms, pxPerSecond)` เพื่อลด floating-point drift และ sync กับ `<video>` ได้ง่าย

## 4. Command Pattern สำหรับ Undo/Redo

ทุก local mutating action ที่สำคัญสร้าง `Command` ที่มี:

- `execute()`
- `undo()`
- `description`
- `timestamp`

actions ที่ undoable:

- move clip
- trim clip
- split clip
- delete clips
- add clip จาก asset browser
- add/remove/update effect
- transform change

`CommandManager` จำกัด history ที่ 50 commands เพื่อไม่ให้ memory โตไม่จำกัด และมี subscription ให้ history panel update UI ได้ทันที

remote collaboration operations ไม่เข้า local undo history เพราะเป็น action จากผู้ใช้คนอื่น

## 5. Optimistic Updates

clip mutations ถูก apply ลง Zustand ทันทีเพื่อให้ editor ตอบสนองเร็ว จากนั้นค่อยยิง API แบบ async

แนวคิด:

- local interaction ต้องรู้สึก real-time
- server เป็น authority สุดท้าย
- ถ้า API fail สามารถ rollback ผ่าน undo command หรือ reload project state ได้
- remote operation จาก Pusher ใช้ `applyRemote*` actions เพื่อ bypass command manager

## 6. Video Player

player ใช้ native `<video>` element เพราะเพียงพอสำหรับ prototype และไม่ต้องพึ่ง WebCodecs

รองรับ:

- proxy variant ถ้ามี
- play/pause และ seek สองทางกับ timeline playhead
- current time / total duration
- volume slider และ mute
- playback speed 0.5x, 1x, 1.5x, 2x
- fullscreen
- CSS filter preview สำหรับ brightness, contrast, saturation, blur
- เลือก clip ที่ active ตาม playhead position

CSS filter ไม่ pixel-perfect เท่าการ render frame จริง แต่เร็วและเหมาะกับ preview layer

## 7. Inspector Panel

เมื่อเลือก clip เดียว inspector แสดง:

- Clip info: duration, position, in/out point
- Transform editor: x, y, scale, rotation, opacity ผ่าน input/slider
- Effect editor: add/toggle/delete และปรับ parameter ผ่าน slider

การเปลี่ยนค่า transform/effect ถูกส่งไป API และผูกกับ undo command เพื่อให้ workflow editor ใช้งานจริงได้

## 8. Asset Browser

asset browser รองรับ:

- list/grid view
- filter all/video/audio/image
- search
- status badges: uploading, processing, ready, failed
- upload flow: presigned/local fallback -> upload -> confirm -> reload assets
- preview asset
- delete asset
- storage usage display
- drag asset ไป drop บน timeline เพื่อสร้าง clip

การ add clip จาก asset browser ทำเป็น undoable action หลัง API สร้าง clip สำเร็จ

## 9. API Coverage ใน UI

UI ไม่ได้มีแค่ editor workflow หลัก แต่มี action panel สำหรับเรียก endpoint สำคัญให้ครบจากหน้าเว็บ:

- workspace: create, list, get, invite, update member role, remove member
- project: create, list, get, update, delete, duplicate, versions, create snapshot
- asset: presigned upload, upload/confirm, list with type filter, get details, delete
- timeline: create/update/delete tracks, create/update/delete/split/batch clips, add/update/delete/reorder effects, create/update/delete transitions, create/update/delete text overlays
- export: create, list, get detail, cancel
- collaboration: Pusher auth ผ่าน hook, operation replay และ backend presence fetch

เป้าหมายคือ reviewer สามารถกดจาก UI แล้วเห็นว่า REST API ทุกกลุ่มมี workflow จริง ไม่ใช่มีแค่ service client ที่ไม่ได้ถูกใช้

## 10. shadcn/ui Approach

ใช้ shadcn-style components เป็นหลัก โดยสร้าง wrapper ใน `src/components/ui` สำหรับ:

- `Button`
- `Input`
- `Slider`
- `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`

components เหล่านี้ใช้ Radix primitives/Tailwind ตามแนวทาง shadcn และไม่เพิ่ม UI library อื่นเช่น Material UI หรือ Ant Design

## 11. Collaboration UI

frontend subscribe:

- `presence-project-{projectId}` สำหรับ collaborator list และ remote cursors
- `private-project-{projectId}` สำหรับ operation sync

remote cursor แสดงเป็นเส้นบน timeline พร้อมชื่อ/สี user และ clip ที่ผู้ใช้อื่นกำลัง interact จะแสดง indicator บน clip

cursor movement ส่งเป็น Pusher client event ที่ throttle ประมาณ 100 ms เพื่อลด message volume

## 12. ข้อจำกัดที่ตั้งใจรับได้ใน Prototype

- thumbnail strip/waveform บน timeline clip ยังเป็น nice-to-have
- virtual scrolling ยังไม่จำเป็นจนกว่า clip count สูงมาก
- marquee select ยังไม่ทำ
- drag reorder effects ยังไม่ทำ
- CRDT เต็มรูปแบบยังไม่ใช้งานจริงใน flow หลัก แม้มี Yjs store scaffold

ข้อจำกัดเหล่านี้ไม่กระทบ required workflow หลักของ editor prototype
