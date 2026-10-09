// Decode and re-encode uploaded PNGs: actual transparency, bounded decompression,
// tight crop, and no metadata or executable image formats in the public bucket.
const MAGIC = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const encoder = new TextEncoder();
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc(bytes) {
  let n = 0xffffffff;
  for (const byte of bytes) n = table[(n ^ byte) & 255] ^ (n >>> 8);
  return (n ^ 0xffffffff) >>> 0;
}
function join(parts) {
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) { result.set(part, at); at += part.length; }
  return result;
}
function chunk(type, data) {
  const result = new Uint8Array(data.length + 12);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(encoder.encode(type), 4);
  result.set(data, 8);
  view.setUint32(result.length - 4, crc(result.subarray(4, -4)));
  return result;
}
export async function encodePNG(width, height, rgba) {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height);
  header[8] = 8; header[9] = 6;
  const rows = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rows.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const compressed = new Uint8Array(await new Response(new Blob([rows]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  return join([MAGIC, chunk('IHDR', header), chunk('IDAT', compressed), chunk('IEND', new Uint8Array())]);
}
const invalid = (message = 'Choose a transparent PNG exported by the signature editor.') => { throw new Error(message); };
export async function normalizePNG(bytes) {
  if (bytes.length > 2 * 1024 * 1024) invalid('The prepared PNG must be under 2 MB.');
  if (!MAGIC.every((byte, i) => bytes[i] === byte)) invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width, height, ended = false, idatEnded = false;
  const parts = [];
  for (let at = 8; at < bytes.length;) {
    if (at + 12 > bytes.length) invalid();
    const length = view.getUint32(at);
    if (length > bytes.length - at - 12) invalid();
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (crc(bytes.subarray(at + 4, at + 8 + length)) !== view.getUint32(at + 8 + length)) invalid();
    if (at === 8 && type !== 'IHDR') invalid();
    if (type === 'IHDR') {
      if (width || length !== 13) invalid();
      width = view.getUint32(at + 8); height = view.getUint32(at + 12);
      if (!width || !height || width > 1600 || height > 1600 || width * height > 1000000) invalid('The prepared image is too large.');
      if (data[8] !== 8 || data[9] !== 6 || data[10] || data[11] || data[12]) invalid('Use the site’s upload button to prepare this PNG first.');
    } else if (type === 'IDAT') {
      if (idatEnded) invalid();
      parts.push(data);
    } else if (type === 'IEND') {
      if (length || at + 12 !== bytes.length || !parts.length) invalid();
      ended = true;
    } else {
      if (parts.length) idatEnded = true;
      if (type[0] === type[0].toUpperCase()) invalid();
    }
    at += length + 12;
  }
  if (!ended) invalid();
  const stride = width * 4, expected = (stride + 1) * height;
  const reader = new Blob([join(parts)]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  const rows = new Uint8Array(expected);
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (size + value.length > expected) { await reader.cancel(); invalid(); }
      rows.set(value, size); size += value.length;
    }
  } catch { invalid(); }
  if (size !== expected) invalid();
  const rgba = new Uint8Array(width * height * 4);
  let transparent = false, minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    const filter = rows[y * (stride + 1)];
    if (filter > 4) invalid();
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= 4 ? rgba[i - 4] : 0, b = y ? rgba[i - stride] : 0, c = y && x >= 4 ? rgba[i - stride - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predict = filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? pa <= pb && pa <= pc ? a : pb <= pc ? b : c : 0;
      rgba[i] = (rows[y * (stride + 1) + x + 1] + predict) & 255;
      if (x % 4 === 3) {
        if (rgba[i] < 8) transparent = true;
        if (rgba[i] >= 8) { const px = (x - 3) / 4; minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      }
    }
  }
  if (!transparent) invalid('Export with a transparent background, then try again.');
  if (maxX < 0) invalid('This image is blank. Add your name before exporting.');
  minX = Math.max(0, minX - 8); minY = Math.max(0, minY - 8);
  maxX = Math.min(width - 1, maxX + 8); maxY = Math.min(height - 1, maxY + 8);
  const croppedWidth = maxX - minX + 1, croppedHeight = maxY - minY + 1;
  const cropped = new Uint8Array(croppedWidth * croppedHeight * 4);
  for (let y = 0; y < croppedHeight; y++) cropped.set(rgba.subarray(((y + minY) * width + minX) * 4, ((y + minY) * width + maxX + 1) * 4), y * croppedWidth * 4);
  return { bytes: await encodePNG(croppedWidth, croppedHeight, cropped), width: croppedWidth, height: croppedHeight };
}
