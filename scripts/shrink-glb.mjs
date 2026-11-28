// Shrinks the textures inside a GLB to a maximum size and re-encodes them as
// JPEG, then repacks the file. Uses macOS `sips`, so it needs no npm packages.
// Usage: node scripts/shrink-glb.mjs in.glb out.glb [maxSize=1024] [quality=82]
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [src, dst, max = '1024', quality = '82'] = process.argv.slice(2);
const buf = readFileSync(src);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB file');
const jsonLen = buf.readUInt32LE(12), gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8, bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));
const tmp = mkdtempSync(join(tmpdir(), 'glb-'));

// Every buffer view keeps its bytes, except the ones holding images.
const chunks = gltf.bufferViews.map(v => bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
(gltf.images ?? []).forEach((img, i) => {
  if (img.bufferView == null) return;
  const ext = img.mimeType === 'image/png' ? 'png' : 'jpg', a = join(tmp, `${i}.${ext}`), b = join(tmp, `${i}-out.jpg`);
  writeFileSync(a, chunks[img.bufferView]);
  execFileSync('sips', ['-Z', max, '-s', 'format', 'jpeg', '-s', 'formatOptions', quality, a, '--out', b], { stdio: 'ignore' });
  chunks[img.bufferView] = readFileSync(b);
  img.mimeType = 'image/jpeg';
});
let offset = 0;
const parts = [];
gltf.bufferViews.forEach((v, i) => {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { parts.push(Buffer.alloc(pad)); offset += pad; }
  v.byteOffset = offset;
  v.byteLength = chunks[i].length;
  parts.push(chunks[i]);
  offset += chunks[i].length;
});
const tail = (4 - (offset % 4)) % 4;
if (tail) parts.push(Buffer.alloc(tail));
const newBin = Buffer.concat(parts);
gltf.buffers = [{ byteLength: newBin.length }];
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + newBin.length, 8);
jh.writeUInt32LE(json.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
bh.writeUInt32LE(newBin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
writeFileSync(dst, Buffer.concat([head, jh, json, bh, newBin]));
rmSync(tmp, { recursive: true });
console.log(`${src}: ${(buf.length / 1048576).toFixed(2)} MB -> ${dst}: ${((20 + json.length + 8 + newBin.length) / 1048576).toFixed(2)} MB`);
