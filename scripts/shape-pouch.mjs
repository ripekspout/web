/* Reshapes assets/stand_up_pouch_original.glb into assets/stand_up_pouch.glb.

   The source model is boxier than the reference silhouette we're matching: a
   real filled stand-up pouch is widest at the gusset and draws in toward the
   top seal. So the film gets a height-dependent X taper, and the spout/cap
   assembly is translated inward by the same amount at its weld height — it is
   a separate rigid mesh, so tapering it directly would squash the round cap
   into an ellipse.

   The shipped asset is then Meshopt-compressed (3.8MB -> ~0.6MB), which is
   why compression runs here rather than as a separate step someone can forget
   — re-tapering without recompressing would silently ship the 3.8MB file.
   If the compressor is unavailable the uncompressed model is shipped instead
   and this says so loudly; GLTFLoader reads either.

   Run: node scripts/shape-pouch.mjs
*/
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const SRC = path.join(root, 'assets', 'stand_up_pouch_original.glb');
const OUT = path.join(root, 'assets', 'stand_up_pouch.glb');
const STAGED = path.join(os.tmpdir(), 'pouch-tapered-' + process.pid + '.glb');

const TAPER_BOTTOM = 0.98; // X scale at the gusset
const TAPER_TOP = 0.83;    // X scale at the top seal
const BODY_MESH = 0;
const SPOUT_MESHES = [1, 2, 3, 4];

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a glb');
  let off = 12, json = null, bin = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
    if (type === 0x004e4942) bin = Buffer.from(data);
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
  if (!json || !bin) throw new Error('missing chunk');
  return { json, bin };
}

function writeGlb(file, json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const jsonLen = jsonBuf.length + jsonPad;
  const binLen = bin.length + binPad;
  const total = 12 + 8 + jsonLen + 8 + binLen;

  const out = Buffer.alloc(total);
  let o = 0;
  out.writeUInt32LE(0x46546c67, o); o += 4;
  out.writeUInt32LE(2, o); o += 4;
  out.writeUInt32LE(total, o); o += 4;
  out.writeUInt32LE(jsonLen, o); o += 4;
  out.writeUInt32LE(0x4e4f534a, o); o += 4;
  jsonBuf.copy(out, o); o += jsonBuf.length;
  out.fill(0x20, o, o + jsonPad); o += jsonPad;
  out.writeUInt32LE(binLen, o); o += 4;
  out.writeUInt32LE(0x004e4942, o); o += 4;
  bin.copy(out, o); o += bin.length;
  out.fill(0, o, o + binPad);
  fs.writeFileSync(file, out);
}

const { json, bin } = readGlb(SRC);

// Where a given accessor's vec3 elements live in the BIN chunk.
function vec3Layout(accessorIndex) {
  const acc = json.accessors[accessorIndex];
  if (acc.type !== 'VEC3' || acc.componentType !== 5126) {
    throw new Error('expected float VEC3 accessor, got ' + acc.type + '/' + acc.componentType);
  }
  const view = json.bufferViews[acc.bufferView];
  const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = view.byteStride || 12;
  return { base, stride, count: acc.count, acc };
}

function eachVec3(accessorIndex, fn) {
  const { base, stride, count } = vec3Layout(accessorIndex);
  for (let i = 0; i < count; i++) {
    const p = base + i * stride;
    const x = bin.readFloatLE(p);
    const y = bin.readFloatLE(p + 4);
    const z = bin.readFloatLE(p + 8);
    const out = fn(x, y, z);
    if (out) {
      bin.writeFloatLE(out[0], p);
      bin.writeFloatLE(out[1], p + 4);
      bin.writeFloatLE(out[2], p + 8);
    }
  }
}

function refreshBounds(accessorIndex) {
  const { acc } = vec3Layout(accessorIndex);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  eachVec3(accessorIndex, (x, y, z) => {
    const v = [x, y, z];
    for (let k = 0; k < 3; k++) {
      if (v[k] < min[k]) min[k] = v[k];
      if (v[k] > max[k]) max[k] = v[k];
    }
  });
  acc.min = min;
  acc.max = max;
}

function accessorsOf(meshIndex, attr) {
  const set = new Set();
  for (const prim of json.meshes[meshIndex].primitives) {
    if (prim.attributes[attr] != null) set.add(prim.attributes[attr]);
  }
  return [...set];
}

// --- body height, needed before any edit ---
const bodyPos = accessorsOf(BODY_MESH, 'POSITION');
let maxY = 0;
for (const a of bodyPos) maxY = Math.max(maxY, json.accessors[a].max[1]);

const scaleAt = (y) => {
  const t = Math.min(1, Math.max(0, y / maxY));
  return TAPER_BOTTOM + (TAPER_TOP - TAPER_BOTTOM) * t;
};

// --- taper the film ---
for (const a of bodyPos) eachVec3(a, (x, y, z) => [x * scaleAt(y), y, z]);
for (const a of bodyPos) refreshBounds(a);

/* Normals under a non-uniform scale need the inverse transpose, which here is
   just the reciprocal X scale — but it has to be the scale at *that vertex's*
   height, not one constant, or the correction is wrong everywhere except the
   top seal. Y is untouched by the taper, so the already-written positions
   still carry the height each normal belongs to. */
const normalAccessors = accessorsOf(BODY_MESH, 'NORMAL');
for (let n = 0; n < normalAccessors.length; n++) {
  const posLayout = vec3Layout(bodyPos[n] != null ? bodyPos[n] : bodyPos[0]);
  let i = 0;
  eachVec3(normalAccessors[n], (nx, ny, nz) => {
    const p = posLayout.base + i * posLayout.stride;
    const y = bin.readFloatLE(p + 4);
    i++;
    const x = nx / scaleAt(y);
    const len = Math.hypot(x, ny, nz) || 1;
    return [x / len, ny / len, nz / len];
  });
  refreshBounds(normalAccessors[n]);
}

// --- keep the spout welded to the now-narrower shoulder ---
const flange = json.accessors[accessorsOf(1, 'POSITION')[0]];
const weldX = (flange.min[0] + flange.max[0]) / 2;
const weldY = (flange.min[1] + flange.max[1]) / 2;
const shiftX = weldX * (scaleAt(weldY) - 1);

for (const mesh of SPOUT_MESHES) {
  for (const a of accessorsOf(mesh, 'POSITION')) {
    eachVec3(a, (x, y, z) => [x + shiftX, y, z]);
    refreshBounds(a);
  }
}

json.asset = json.asset || {};
json.asset.generator = 'Procedural stand-up pouch model — tapered for Repack';

writeGlb(STAGED, json, bin);

console.log(`taper ${TAPER_BOTTOM} -> ${TAPER_TOP} over height ${maxY.toFixed(4)}m`);
console.log(`spout shifted ${(shiftX * 1000).toFixed(2)}mm inward (weld at y=${weldY.toFixed(3)})`);

const mb = (file) => (fs.statSync(file).size / 1e6).toFixed(2) + 'MB';
const tapered = mb(STAGED);

try {
  /* Shell form on purpose: npx is a .cmd on Windows, which Node refuses to
     spawn directly. Both paths are program-generated (tmpdir and this repo),
     so quoting them is enough to survive spaces. */
  execSync(`npx --yes @gltf-transform/cli@4 meshopt "${STAGED}" "${OUT}"`, { stdio: 'pipe' });
  console.log(`meshopt: ${tapered} -> ${mb(OUT)}`);
} catch (err) {
  fs.copyFileSync(STAGED, OUT);
  console.warn('WARNING: meshopt compression failed, shipping uncompressed ' + tapered);
  console.warn('  ' + (err.message || err));
}

fs.rmSync(STAGED, { force: true });
console.log(`wrote ${path.relative(root, OUT)}`);
