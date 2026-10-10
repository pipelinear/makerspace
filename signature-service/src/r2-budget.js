export const R2_LIMITS = Object.freeze({
  imageBytes: 512 * 1024,
  storageBytes: 512 * 1024 * 1024,
  images: 1000,
  writes: 2500,
  reads: 100000,
  windowDays: 32
});

export class BudgetError extends Error {
  constructor(message) { super(message); this.status = 503; }
}
const paused = () => new BudgetError('Images are unavailable for now. Please try again later.');
function enabled(env) {
  if (env.R2_ENABLED !== undefined && env.R2_ENABLED !== 'true') throw paused();
}
function limit(env, name, maximum) {
  const value = env[name] === undefined ? maximum : Number(env[name]);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw paused();
  return value;
}
export function usageWindow(now = Date.now()) {
  return {
    today: new Date(now).toISOString().slice(0, 10),
    cutoff: new Date(now - (R2_LIMITS.windowDays - 1) * 86400000).toISOString().slice(0, 10)
  };
}
export async function reserveOperation(env, kind) {
  enabled(env);
  const maximum = kind === 'read' ? limit(env, 'R2_READ_LIMIT', R2_LIMITS.reads) : limit(env, 'R2_WRITE_LIMIT', R2_LIMITS.writes);
  const { today, cutoff } = usageWindow();
  // One atomic SQL statement reserves the operation before touching R2.
  // Failed R2 requests still consume a reservation; restarts do not reset it.
  const reserved = await env.DB.prepare(`INSERT INTO r2_usage(day, kind, count)
    SELECT ?, ?, 1 WHERE (SELECT COALESCE(SUM(count), 0) FROM r2_usage WHERE kind = ? AND day >= ?) < ?
    ON CONFLICT(day, kind) DO UPDATE SET count = count + 1 RETURNING count`)
    .bind(today, kind, kind, cutoff, maximum).first();
  if (!reserved) throw new BudgetError(kind === 'write' ? 'Uploads are paused for now. Please try again later.' : 'Images are unavailable for now. Please try again later.');
}
export async function reserveStorage(env, key, bytes) {
  enabled(env);
  const maximum = limit(env, 'R2_STORAGE_LIMIT', R2_LIMITS.storageBytes);
  const count = limit(env, 'R2_IMAGE_LIMIT', R2_LIMITS.images);
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > R2_LIMITS.imageBytes) throw new BudgetError('Choose a smaller image.');
  const reserved = await env.DB.prepare(`INSERT INTO r2_storage(object_key, byte_count, created_at)
    SELECT ?, ?, ? WHERE (SELECT COALESCE(SUM(byte_count), 0) FROM r2_storage) + ? <= ?
    AND (SELECT COUNT(*) FROM r2_storage) < ? RETURNING object_key`)
    .bind(key, bytes, Date.now(), bytes, maximum, count).first();
  if (!reserved) throw new BudgetError('The image collection is full. Please try again later.');
}
export async function releaseStorage(env, key) {
  await env.DB.prepare('DELETE FROM r2_storage WHERE object_key = ?').bind(key).run();
}
export async function deleteObject(env, key) {
  // Standard R2 deletion is free. Release capacity only after deletion succeeds.
  await env.SIGNATURE_IMAGES.delete(key);
  await releaseStorage(env, key);
}
export async function usage(env) {
  const { cutoff } = usageWindow();
  const storage = await env.DB.prepare('SELECT COUNT(*) AS images, COALESCE(SUM(byte_count), 0) AS bytes FROM r2_storage').first();
  const { results } = await env.DB.prepare('SELECT kind, SUM(count) AS total FROM r2_usage WHERE day >= ? GROUP BY kind').bind(cutoff).all();
  return { storage, operations: Object.fromEntries(results.map(row => [row.kind, row.total])), limits: { ...R2_LIMITS, reads: limit(env, 'R2_READ_LIMIT', R2_LIMITS.reads), writes: limit(env, 'R2_WRITE_LIMIT', R2_LIMITS.writes), storageBytes: limit(env, 'R2_STORAGE_LIMIT', R2_LIMITS.storageBytes), images: limit(env, 'R2_IMAGE_LIMIT', R2_LIMITS.images) }, windowDays: R2_LIMITS.windowDays };
}
