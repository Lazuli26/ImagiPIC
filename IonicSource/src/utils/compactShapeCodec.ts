import { CompactShapeType } from "../types/database";

// CompactShapeRow = readonly number[] — flat single-level array (Firestore
// forbids nested arrays like [type, color, [...params]]).
// Layout: [ type, rgbaColor32, paramsLength, ...params ]
export type CompactShapeRow = readonly number[];

type ShapeColor = { r: number; g: number; b: number; a: number };

const SHAPE_TYPE_MAP: Record<string, CompactShapeType> = {
  ROTATED_RECTANGLE: CompactShapeType.ROTATED_RECTANGLE,
  ROTATED_ELLIPSE: CompactShapeType.ROTATED_ELLIPSE,
  TRIANGLE: CompactShapeType.TRIANGLE,
  CIRCLE: CompactShapeType.CIRCLE,
  LINE: CompactShapeType.LINE,
  QUADRATIC_BEZIER: CompactShapeType.QUADRATIC_BEZIER,
  RECTANGLE: CompactShapeType.RECTANGLE,
  // Geometrize upstream also exposes plain ELLIPSE (type id 3). We fold it into
  // our ROTATED_ELLIPSE representation with an angle of 0.
  ELLIPSE: CompactShapeType.ROTATED_ELLIPSE,
};

const GEOMETRIZE_TYPE_ID_MAP: Record<number, CompactShapeType> = {
  0: CompactShapeType.RECTANGLE,
  1: CompactShapeType.ROTATED_RECTANGLE,
  2: CompactShapeType.TRIANGLE,
  3: CompactShapeType.ROTATED_ELLIPSE,
  4: CompactShapeType.ROTATED_ELLIPSE,
  5: CompactShapeType.CIRCLE,
  6: CompactShapeType.LINE,
  7: CompactShapeType.QUADRATIC_BEZIER,
};

function normalizeColor(color: unknown): ShapeColor {
  if (Array.isArray(color) && color.length >= 4) {
    return {
      r: Number(color[0]) || 0,
      g: Number(color[1]) || 0,
      b: Number(color[2]) || 0,
      a: Number(color[3] ?? 255),
    };
  }
  if (color && typeof color === "object") {
    const c = color as Partial<ShapeColor>;
    return {
      r: Number(c.r) || 0,
      g: Number(c.g) || 0,
      b: Number(c.b) || 0,
      a: Number(c.a ?? 255),
    };
  }
  return { r: 0, g: 0, b: 0, a: 255 };
}

function encodeColor(color: unknown): number {
  const normalized = normalizeColor(color);
  const r = Math.round(normalized.r) & 0xff;
  const g = Math.round(normalized.g) & 0xff;
  const b = Math.round(normalized.b) & 0xff;
  const a = Math.round(normalized.a) & 0xff;
  // Match Geometrize's own color packing/order: RRGGBBAA.
  const n = ((r << 24) | (g << 16) | (b << 8) | a) | 0;
  return n;
}

function decodeColorRgba(rgba: number): { r: number; g: number; b: number; a: number } {
  const r = ((rgba >>> 0) >>> 24) & 0xff;
  const g = ((rgba >>> 0) >>> 16) & 0xff;
  const b = ((rgba >>> 0) >>> 8) & 0xff;
  const a = (rgba >>> 0) & 0xff;
  return { r, g, b, a };
}

function svgPaint(rgba: number, kind: 'fill' | 'stroke' = 'fill'): string {
  const { r, g, b, a } = decodeColorRgba(rgba);
  const af = (a / 255).toFixed(3);
  // SVG 1.1 presentation attributes work consistently in mobile WebKit too.
  return `${kind}="rgb(${r}, ${g}, ${b})" ${kind}-opacity="${af}"`;
}

function readData(shapeJson: any): number[] {
  const raw = shapeJson?.data;
  if (Array.isArray(raw)) {
    return raw.map((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    });
  }
  return [];
}

function rectangleBoundsToParams(data: number[]): number[] {
  const x1 = Math.round(data[0] ?? 0);
  const y1 = Math.round(data[1] ?? 0);
  const x2 = Math.round(data[2] ?? x1);
  const y2 = Math.round(data[3] ?? y1);
  return [x1, y1, Math.max(0, x2 - x1), Math.max(0, y2 - y1)];
}

function rotatedRectangleBoundsToParams(data: number[]): number[] {
  const [x, y, w, h] = rectangleBoundsToParams(data);
  const angleThousandths = Math.round((Number(data[4]) || 0) * 1000);
  return [x, y, w, h, angleThousandths];
}

function ellipseParams(data: number[]): number[] {
  const cx = Math.round(data[0] ?? 0);
  const cy = Math.round(data[1] ?? 0);
  const rx = Math.round(data[2] ?? 0);
  const ry = Math.round(data[3] ?? rx);
  const angleThousandths = Math.round((Number(data[4]) || 0) * 1000);
  return [cx, cy, rx, ry, angleThousandths];
}

function circleParams(data: number[]): number[] {
  const cx = Math.round(data[0] ?? 0);
  const cy = Math.round(data[1] ?? 0);
  const r = Math.round(data[2] ?? 0);
  return [cx, cy, r];
}

function lineParams(data: number[]): number[] {
  const x1 = Math.round(data[0] ?? 0);
  const y1 = Math.round(data[1] ?? 0);
  const x2 = Math.round(data[2] ?? 0);
  const y2 = Math.round(data[3] ?? 0);
  const strokeWidth = Math.max(1, Math.round(Number(data[4]) || 1));
  return [x1, y1, x2, y2, strokeWidth];
}

function bezierParams(data: number[]): number[] {
  const strokeWidth = Math.max(1, Math.round(Number(data[6]) || 1));
  return [
    Math.round(data[0] ?? 0),
    Math.round(data[1] ?? 0),
    Math.round(data[2] ?? 0),
    Math.round(data[3] ?? 0),
    Math.round(data[4] ?? 0),
    Math.round(data[5] ?? 0),
    strokeWidth,
  ];
}

function triangleParams(data: number[]): number[] {
  return [
    Math.round(data[0] ?? 0),
    Math.round(data[1] ?? 0),
    Math.round(data[2] ?? 0),
    Math.round(data[3] ?? 0),
    Math.round(data[4] ?? 0),
    Math.round(data[5] ?? 0),
  ];
}

function shapeJsonTypeToCompact(shapeJson: any): CompactShapeType | null {
  const raw: unknown = shapeJson?.type;
  if (raw === null || raw === undefined) return null;
  // 1) Canonical name "ROTATED_RECTANGLE", "TRIANGLE", etc.
  if (typeof raw === "string") {
    const canonical = SHAPE_TYPE_MAP[raw];
    if (canonical !== undefined) return canonical;
    // 2) Geometrize library fallback string "unknown shape type N" — library
    //    string-mapper is missing a case (e.g. TRIANGLE id=2 returns fallback
    //    instead of canonical name). Extract the numeric enum and map directly.
    const m = raw.match(/unknown\s+shape\s+type\s+(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && GEOMETRIZE_TYPE_ID_MAP[n] !== undefined) return GEOMETRIZE_TYPE_ID_MAP[n];
    }
    return null;
  }
  // 3) Raw numeric type id (defensive: future worker version might just send int)
    if (typeof raw === "number" && Number.isFinite(raw) && GEOMETRIZE_TYPE_ID_MAP[raw] !== undefined) {
      return GEOMETRIZE_TYPE_ID_MAP[raw];
  }
  return null;
}

// Create flat row: [type, colorArgb32, paramsLength, ...params]
function buildFlatRow(type: CompactShapeType, colorArgb: number, params: number[]): CompactShapeRow {
  const n = params.length;
  const out: number[] = new Array(3 + n);
  out[0] = type;
  out[1] = colorArgb;
  out[2] = n;
  for (let i = 0; i < n; i++) out[3 + i] = params[i] ?? 0;
  return out;
}

// Read params slice from flat row with bounds+NaN guard
function readParams(row: CompactShapeRow): readonly number[] {
  if (!Array.isArray(row) || row.length < 3) return [];
  const declaredN = Math.max(0, Math.min(32, Math.floor(Number(row[2]) || 0)));
  const available = Math.max(0, row.length - 3);
  const n = Math.min(declaredN, available);
  if (n <= 0) return [];
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const v = Number(row[3 + i]);
    out[i] = Number.isFinite(v) ? v : 0;
  }
  return out;
}

function readType(row: CompactShapeRow): CompactShapeType | null {
  if (!Array.isArray(row) || row.length < 1) return null;
  const t = Math.floor(Number(row[0]) || 0);
  if (t in CompactShapeType) return t as CompactShapeType;
  return null;
}

function readColor(row: CompactShapeRow): number {
  if (!Array.isArray(row) || row.length < 2) return 0;
  const c = Number(row[1]);
  return Number.isFinite(c) ? (c | 0) : 0;
}

export function encodeFromShapeJson(shapeJson: any): CompactShapeRow | null {
  const type = shapeJsonTypeToCompact(shapeJson);
  if (type === null) return null;

  const color = shapeJson.color ?? { r: 0, g: 0, b: 0, a: 255 };
  const colorArgb = encodeColor(color);
  const data = readData(shapeJson);

  let params: number[] = [];

  switch (type) {
    case CompactShapeType.ROTATED_RECTANGLE: {
      params = rotatedRectangleBoundsToParams(data);
      break;
    }
    case CompactShapeType.ROTATED_ELLIPSE: {
      params = ellipseParams(data);
      break;
    }
    case CompactShapeType.TRIANGLE: {
      params = triangleParams(data);
      break;
    }
    case CompactShapeType.CIRCLE: {
      params = circleParams(data);
      break;
    }
    case CompactShapeType.LINE: {
      params = lineParams(data);
      break;
    }
    case CompactShapeType.QUADRATIC_BEZIER: {
      params = bezierParams(data);
      break;
    }
    case CompactShapeType.RECTANGLE: {
      params = rectangleBoundsToParams(data);
      break;
    }
  }

  return buildFlatRow(type, colorArgb, params);
}

export function decodeToSvgRow(row: CompactShapeRow, w: number, h: number): string | null {
  void w;
  void h;
  const type = readType(row);
  if (type === null) return null;
  const params = readParams(row);
  if (params.length === 0 && type !== CompactShapeType.CIRCLE) {
    // Allow CIRCLE with zero params (still would draw a 0-radius dot); skip others
  }
  const colorRgba = readColor(row);
  const fill = svgPaint(colorRgba);
  const stroke = svgPaint(colorRgba, 'stroke');

  switch (type) {
    case CompactShapeType.ROTATED_RECTANGLE: {
      const [x, y, rw, rh, angleThousandths] = params;
        const angleDeg = (angleThousandths ?? 0) / 1000;
      const cx = (x ?? 0) + (rw ?? 0) / 2;
      const cy = (y ?? 0) + (rh ?? 0) / 2;
      const transform =
        Math.abs(angleDeg) > 1e-6
          ? ` transform="rotate(${angleDeg.toFixed(3)}, ${cx}, ${cy})"`
          : "";
      return `<rect x="${x ?? 0}" y="${y ?? 0}" width="${rw ?? 0}" height="${rh ?? 0}" ${fill} stroke="none"${transform} />`;
    }
    case CompactShapeType.ROTATED_ELLIPSE: {
      const [cx, cy, rx, ry, angleThousandths] = params;
        const angleDeg = (angleThousandths ?? 0) / 1000;
      const transform =
        Math.abs(angleDeg) > 1e-6
          ? ` transform="rotate(${angleDeg.toFixed(3)}, ${cx ?? 0}, ${cy ?? 0})"`
          : "";
      return `<ellipse cx="${cx ?? 0}" cy="${cy ?? 0}" rx="${rx ?? 0}" ry="${ry ?? 0}" ${fill} stroke="none"${transform} />`;
    }
    case CompactShapeType.TRIANGLE: {
      const [x1, y1, x2, y2, x3, y3] = params;
      const pts = `${x1 ?? 0},${y1 ?? 0} ${x2 ?? 0},${y2 ?? 0} ${x3 ?? 0},${y3 ?? 0}`;
      return `<polygon points="${pts}" ${fill} stroke="none" />`;
    }
    case CompactShapeType.CIRCLE: {
      const [cx, cy, r] = params;
      return `<circle cx="${cx ?? 0}" cy="${cy ?? 0}" r="${r ?? 0}" ${fill} stroke="none" />`;
    }
    case CompactShapeType.LINE: {
      const [x1, y1, x2, y2, sw] = params;
      const strokeW = sw ?? 1;
      return `<line x1="${x1 ?? 0}" y1="${y1 ?? 0}" x2="${x2 ?? 0}" y2="${y2 ?? 0}" ${stroke} stroke-width="${strokeW}" stroke-linecap="round" fill="none" />`;
    }
    case CompactShapeType.QUADRATIC_BEZIER: {
      const [sx, sy, cx, cy, ex, ey, sw] = params;
      const strokeW = sw ?? 1;
      return `<path d="M ${sx ?? 0} ${sy ?? 0} Q ${cx ?? 0} ${cy ?? 0} ${ex ?? 0} ${ey ?? 0}" ${stroke} stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" fill="none" />`;
    }
    case CompactShapeType.RECTANGLE: {
      const [x, y, rw, rh] = params;
      return `<rect x="${x ?? 0}" y="${y ?? 0}" width="${rw ?? 0}" height="${rh ?? 0}" ${fill} stroke="none" />`;
    }
  }

  return null;
}

export function encodeAllFromShapeJsonList(shapes: any[]): CompactShapeRow[] {
  const out: CompactShapeRow[] = [];
  for (const s of shapes ?? []) {
    const row = encodeFromShapeJson(s);
    if (row !== null) out.push(row);
  }
  return out;
}

// Flatten rows (each row = [type, color, N, ...params]) into ONE top-level number[].
// Firestore only allows a single-level array of primitives — no array-of-arrays.
export function flattenShapes(rows: readonly CompactShapeRow[]): number[] {
  let total = 0;
  for (const r of rows ?? []) if (Array.isArray(r)) total += r.length;
  const out = new Array<number>(total);
  let cursor = 0;
  for (const r of rows ?? []) {
    if (!Array.isArray(r)) continue;
    for (let i = 0; i < r.length; i++) {
      const v = Number(r[i]);
      out[cursor++] = Number.isFinite(v) ? v : 0;
    }
  }
  if (cursor !== out.length) out.length = cursor;
  return out;
}

// Split a single flat number[] back into per-shape CompactShapeRow[].
// Handles: (a) current flat layout, (b) legacy nested array (any element is an
// array itself → row directly, back-compat for OLD format written before fix),
// (c) empty / corrupt by skipping.
export function unflattenShapes(flat: unknown): CompactShapeRow[] {
  const out: CompactShapeRow[] = [];
  if (flat == null) return out;

  // Case B: legacy array-of-arrays
  if (Array.isArray(flat) && flat.some((x) => Array.isArray(x))) {
    for (const r of flat) {
      if (Array.isArray(r)) {
        // Try legacy nested [T,C,[p0..pN]] row: use normalizeShapesCompact helper
        const norm = normalizeShapesCompact([r]);
        for (const nr of norm) out.push(nr);
      }
    }
    return out;
  }

  // Case A: flat number[] with per-shape [T,C,N,...params] headers
  if (!Array.isArray(flat)) return out;
  const arr = flat as unknown[];
  let i = 0;
  while (i < arr.length) {
    const a0 = arr[i];
    const a1 = arr[i + 1];
    const a2 = arr[i + 2];
    if (
      typeof a0 !== "number" ||
      typeof a1 !== "number" ||
      typeof a2 !== "number" ||
      !Number.isFinite(a0) ||
      !Number.isFinite(a1) ||
      !Number.isFinite(a2) ||
      !(a0 in CompactShapeType)
    ) {
      // Move past this invalid entry to avoid infinite loop
      i += 1;
      continue;
    }
    const type = a0 as CompactShapeType;
    void type;
    const declaredN = Math.max(0, Math.min(32, Math.floor(a2)));
    const available = arr.length - (i + 3);
    const n = Math.min(declaredN, available);
    if (n < 0) {
      i += 1;
      continue;
    }
    const rowLen = 3 + n;
    const row = new Array<number>(rowLen);
    row[0] = a0;
    row[1] = a1;
    row[2] = declaredN;
    for (let k = 0; k < n; k++) {
      const v = Number(arr[i + 3 + k]);
      row[3 + k] = Number.isFinite(v) ? v : 0;
    }
    out.push(row);
    i += rowLen;
  }
  return out;
}

// Convenience: decode rows directly from flat array
export function decodeAllFromFlatToSvgRows(
  flat: unknown,
  w: number,
  h: number
): string[] {
  const rows = unflattenShapes(flat);
  return decodeAllToSvgRows(rows, w, h);
}

export function decodeAllToSvgRows(
  rows: readonly CompactShapeRow[],
  w: number,
  h: number
): string[] {
  const out: string[] = [];
  for (const r of rows ?? []) {
    const svg = decodeToSvgRow(r, w, h);
    if (typeof svg === "string" && svg.length > 0) out.push(svg);
  }
  return out;
}

// normalizeShapesCompact takes any input (legacy array-of-nested-rows,
// flat rows, mixed) and returns ONLY flat rows (still array-of-arrays —
// caller must flattenShapes() if writing to Firestore).
export function normalizeShapesCompact(rows: unknown[]): CompactShapeRow[] {
  const out: CompactShapeRow[] = [];
  for (const rawRow of rows ?? []) {
    if (!Array.isArray(rawRow) || rawRow.length < 2) continue;

    // Flat layout candidate: element[2] is numeric length header
    const maybeHeader = rawRow[2];
    if (
      typeof maybeHeader === "number" &&
      Number.isFinite(maybeHeader) &&
      Number.isInteger(maybeHeader) &&
      maybeHeader >= 0 &&
      maybeHeader <= 32 &&
      rawRow.length >= 3 + maybeHeader
    ) {
      const typeCheck = typeof rawRow[0] === "number" && rawRow[0] in CompactShapeType;
      if (typeCheck) {
        out.push((rawRow as number[]).slice(0, 3 + maybeHeader));
        continue;
      }
    }
    // Legacy nested layout: [type, colorArgb, [p0..pN]]
    const maybeParams = rawRow[2];
    if (
      Array.isArray(maybeParams) &&
      typeof rawRow[0] === "number" &&
      rawRow[0] in CompactShapeType
    ) {
      const type = rawRow[0] as CompactShapeType;
      const colorArgb = Number.isFinite(rawRow[1]) ? (Number(rawRow[1]) | 0) : 0;
      const params: number[] = [];
      for (const v of maybeParams) {
        const n = Number(v);
        params.push(Number.isFinite(n) ? n : 0);
      }
      out.push(buildFlatRow(type, colorArgb, params));
      continue;
    }
  }
  return out;
}

// Convenience for Firestore writes: take anything (rows array, flat array,
// mixed, legacy nested) → output ONE flat number[] suitable for writing
// into shapesCompact / shapesCompactCopy without nested-array errors.
export function normalizeAndFlattenShapes(input: unknown): number[] {
  if (input == null) return [];
  // Already a flat number[]? Use it as-is (don't re-process). Valid if empty
  // or first element is a shape-type number with valid header.
  if (Array.isArray(input)) {
    const allNumeric = input.every((x) => typeof x === "number");
    if (allNumeric) {
      // All numbers. If length === 0 or layout seems valid (chunk header
      // parses to end without errors) → return it. Otherwise fall through
      // to normalize+flatten.
      if (input.length === 0) return [] as number[];
      // Heuristic: if any element is NaN/Non-finite → cast + return
      const out = new Array<number>(input.length);
      let allFinite = true;
      for (let i = 0; i < input.length; i++) {
        const v = Number(input[i]);
        if (!Number.isFinite(v)) allFinite = false;
        out[i] = Number.isFinite(v) ? v : 0;
      }
      if (allFinite) return out;
      // At least one non-finite: we cleaned it up, return cast version
      return out;
    }
    // Mixed array (some non-numeric / some arrays) → normalize → flatten
    const rows = normalizeShapesCompact(input as unknown[]);
    return flattenShapes(rows);
  }
  return [];
}
