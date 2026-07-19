export async function saveBatchAtomically<T, P>(
  items: T[],
  save: (item: T) => Promise<P>,
  cleanup: (saved: P[]) => Promise<void>,
): Promise<P[]> {
  const saved: P[] = [];
  try {
    for (const item of items) saved.push(await save(item));
    return saved;
  } catch (error) {
    await cleanup(saved);
    throw error;
  }
}
