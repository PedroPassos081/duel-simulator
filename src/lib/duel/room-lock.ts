// The OCGCore sessions live in this server process. Serialize requests for a
// session so a poll cannot declare a timeout while an accepted action is saved.
const rooms = new Map<string, Promise<void>>();

export async function withRoomLock<T>(id: string, work: () => Promise<T>): Promise<T> {
  const previous = rooms.get(id) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  rooms.set(id, next);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (rooms.get(id) === next) rooms.delete(id);
  }
}
