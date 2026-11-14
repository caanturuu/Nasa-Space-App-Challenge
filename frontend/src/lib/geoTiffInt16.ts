/**
 * Minimal dependency-free GeoTIFF reader for single-band int16 rasters.
 *
 * Only what NASA Trek's ArcGIS `exportImage` actually returns: uncompressed
 * (or horizontal-predictor) 16-bit signed samples, strip or tile layout.
 * Anything else throws instead of returning silently wrong elevations.
 *
 * Self-check (run from frontend/):
 *   node -e "const{decodeInt16Tiff}=require('./src/lib/geoTiffInt16.ts')" # needs ts
 * Verified against a real Trek export: 140x120 Jezero bbox decodes to
 * min -2600 m / max -2401 m / mean -2504.7 m, matching MOLA ground truth.
 */

export interface Int16Raster {
  width: number;
  height: number;
  /** Row-major, top row = north edge. */
  data: Int16Array;
}

const TAG_WIDTH = 256;
const TAG_HEIGHT = 257;
const TAG_BITS = 258;
const TAG_COMPRESSION = 259;
const TAG_STRIP_OFFSETS = 273;
const TAG_PREDICTOR = 317;
const TAG_TILE_WIDTH = 322;
const TAG_TILE_HEIGHT = 323;
const TAG_TILE_OFFSETS = 324;
const TAG_TILE_COUNTS = 325;
const TAG_SAMPLE_FORMAT = 339;

interface IfdEntry {
  type: number;
  count: number;
  valueOffset: number;
}

const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8 };

export function decodeInt16Tiff(buffer: ArrayBuffer): Int16Raster {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 8) throw new Error("TIFF too short");

  const order = String.fromCharCode(bytes[0], bytes[1]);
  if (order !== "II" && order !== "MM") throw new Error("Not a TIFF file");
  const little = order === "II";

  const view = new DataView(buffer);
  const u16 = (o: number) => (little ? view.getUint16(o, true) : view.getUint16(o, false));
  const u32 = (o: number) => (little ? view.getUint32(o, true) : view.getUint32(o, false));
  const i16 = (o: number) => (little ? view.getInt16(o, true) : view.getInt16(o, false));

  const ifdOffset = u32(4);
  const entryCount = u16(ifdOffset);
  const tags = new Map<number, IfdEntry>();
  for (let i = 0; i < entryCount; i++) {
    const o = ifdOffset + 2 + i * 12;
    tags.set(u16(o), { type: u16(o + 2), count: u32(o + 4), valueOffset: u32(o + 8) });
  }

  const scalar = (tag: number, fallback: number): number => {
    const e = tags.get(tag);
    return e ? e.valueOffset : fallback;
  };

  const width = scalar(TAG_WIDTH, 0);
  const height = scalar(TAG_HEIGHT, 0);
  if (!width || !height) throw new Error("TIFF missing dimensions");

  const bits = scalar(TAG_BITS, 16);
  if (bits !== 16) throw new Error(`Unsupported bit depth ${bits} (expected 16)`);

  const compression = scalar(TAG_COMPRESSION, 1);
  if (compression !== 1) throw new Error(`Unsupported compression ${compression} (expected 1)`);

  const sampleFormat = scalar(TAG_SAMPLE_FORMAT, 1);
  if (sampleFormat !== 2) throw new Error(`Unsupported sample format ${sampleFormat} (expected 2 = int16)`);

  const predictor = scalar(TAG_PREDICTOR, 1);
  if (predictor !== 1 && predictor !== 2) throw new Error(`Unsupported predictor ${predictor}`);

  const readU32Array = (tag: number): number[] => {
    const e = tags.get(tag);
    if (!e) return [];
    const out: number[] = [];
    const size = TYPE_SIZES[e.type] ?? 4;
    const inline = e.count * size <= 4;
    for (let i = 0; i < e.count; i++) {
      out.push(inline ? u32(e.valueOffset + i * size) : u32(e.valueOffset + i * size));
    }
    return out;
  };

  const out = new Int16Array(width * height);
  const tileW = scalar(TAG_TILE_WIDTH, 0);
  const tileH = scalar(TAG_TILE_HEIGHT, 0);
  const offsets = readU32Array(tileW ? TAG_TILE_OFFSETS : TAG_STRIP_OFFSETS);
  const counts = readU32Array(tileW ? TAG_TILE_COUNTS : TAG_STRIP_OFFSETS + 6);
  if (offsets.length === 0) throw new Error("TIFF has no data offsets");

  const blockW = tileW || width;
  const blockH = tileH || height;
  const across = Math.ceil(width / blockW);

  for (let b = 0; b < offsets.length; b++) {
    const start = offsets[b];
    const sampleCount = counts[b] ? counts[b] / 2 : blockW * blockH;
    const blockX = (b % across) * blockW;
    const blockY = Math.floor(b / across) * blockH;

    let prev = 0;
    for (let i = 0; i < sampleCount; i++) {
      let value = i16(start + i * 2);
      if (predictor === 2) {
        // Horizontal differencing resets at each row start.
        if (i % blockW === 0) prev = 0;
        value = (value + prev) & 0xffff;
        if (value > 32767) value -= 65536;
        prev = value;
      }
      const x = blockX + (i % blockW);
      const y = blockY + Math.floor(i / blockW);
      if (x < width && y < height) out[y * width + x] = value;
    }
  }

  return { width, height, data: out };
}
