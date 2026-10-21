import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { sanitizeSvg } from "../scripts/sanitize-svg.mjs";
import { readPngMetadata } from "../scripts/validate.mjs";

const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle id="dot" cx="5" cy="5" r="4" fill="#111827"/></svg>';
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pngFixture = path.join(PACKAGE_ROOT, "demo/assets/raster/sample.png");

test("sanitizer accepts the supported SVG subset", () => {
  assert.equal(sanitizeSvg(safeSvg), safeSvg);
});

for (const [label, payload] of [
  ["script", '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>'],
  ["event handler", '<svg viewBox="0 0 10 10" onload="alert(1)"><path d="M0 0"/></svg>'],
  ["javascript URL", '<svg viewBox="0 0 10 10"><use href="javascript:alert(1)"/></svg>'],
  ["foreign object", '<svg viewBox="0 0 10 10"><foreignObject><div>bad</div></foreignObject></svg>']
]) {
test("sanitizer rejects " + label, () => {
    assert.throws(() => sanitizeSvg(payload), /SVG_UNSAFE/);
  });
}

test("PNG parser returns dimensions and alpha metadata", () => {
  const metadata = readPngMetadata(pngFixture);
  assert.equal(metadata.format, "png");
  assert.ok(metadata.width > 0);
  assert.ok(metadata.height > 0);
  assert.equal(metadata.hasAlpha, true);
});

test("PNG parser rejects a non-PNG payload", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shadow-movie-png-invalid-"));
  const file = path.join(temporaryRoot, "invalid.png");
  try {
    fs.writeFileSync(file, "not a png", "utf8");
    assert.throws(() => readPngMetadata(file), /PNG_INVALID/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
