import fs from "node:fs";

const ALLOWED_TAGS = new Set([
  "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
  "defs", "linearGradient", "radialGradient", "stop", "use", "title", "desc"
]);

const SAFE_ATTRIBUTES = new Set([
  "xmlns", "xmlns:xlink", "viewBox", "width", "height", "fill", "fill-opacity", "stroke",
  "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-opacity", "opacity", "d",
  "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "points", "transform",
  "id", "class", "style", "offset", "stop-color", "stop-opacity", "gradientUnits",
  "gradientTransform", "preserveAspectRatio", "href", "xlink:href", "data-joint",
  "data-pivot-x", "data-pivot-y"
]);

const EVENT_ATTRIBUTE = /^on[a-z]+$/i;
const DISALLOWED_MARKUP = /<!doctype|<!entity|<\?xml|<!--[\s\S]*?-->|<\s*(?:script|iframe|foreignObject|object|embed|image|style)\b/i;
const DANGEROUS_VALUE = /(?:javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|url\s*\(\s*(['"]?)(?!#))/i;

function unsafe(source, detail) {
  throw new Error(`SVG_UNSAFE ${source}: ${detail}`);
}

function validateAttribute(name, value, source) {
  if (EVENT_ATTRIBUTE.test(name)) unsafe(source, `event attribute ${name}`);
  if (!SAFE_ATTRIBUTES.has(name)) unsafe(source, `attribute ${name} is not allowlisted`);
  if (DANGEROUS_VALUE.test(value)) unsafe(source, `dangerous value in ${name}`);
  if ((name === "href" || name === "xlink:href") && !/^#[A-Za-z_][\w:.-]*$/.test(value)) {
    unsafe(source, `${name} must reference an internal fragment`);
  }
  if (name === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) unsafe(source, "invalid id");
  if (name === "class" && !/^[A-Za-z0-9 _-]*$/.test(value)) unsafe(source, "invalid class");
  if (name.startsWith("data-") && !/^[A-Za-z0-9 _:.-]*$/.test(value)) unsafe(source, `invalid ${name}`);
  if (name === "style" && /(?:expression|@import|behavior|url\s*\()/i.test(value)) {
    unsafe(source, "unsafe inline style");
  }
}

function validateTagAttributes(rawAttributes, source) {
  const attributes = rawAttributes.replace(/\/\s*$/, "").trim();
  if (!attributes) return;
  const attributePattern = /([A-Za-z_:][A-Za-z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let cursor = 0;
  let match;
  while ((match = attributePattern.exec(attributes))) {
    if (attributes.slice(cursor, match.index).trim()) unsafe(source, "malformed attribute list");
    const name = match[1];
    const value = match[2] ?? match[3] ?? match[4];
    if (value === undefined) unsafe(source, `attribute ${name} must have a value`);
    validateAttribute(name, value, source);
    cursor = attributePattern.lastIndex;
  }
  if (attributes.slice(cursor).trim()) unsafe(source, "malformed attribute list");
}

export function sanitizeSvg(svg, source = "<inline>") {
  if (typeof svg !== "string" || !svg.trim()) unsafe(source, "empty SVG");
  if (svg.length > 2_000_000) unsafe(source, "SVG exceeds 2 MB limit");
  if (/[&][a-zA-Z#][^;\s<]{0,40};/.test(svg)) unsafe(source, "entity references are not allowed");
  if (DISALLOWED_MARKUP.test(svg)) unsafe(source, "disallowed markup");

  const tagPattern = /<\s*(\/?)\s*([A-Za-z][A-Za-z0-9:_-]*)([^>]*)>/g;
  const stack = [];
  let cursor = 0;
  let sawRoot = false;
  let rootClosed = false;
  let match;

  while ((match = tagPattern.exec(svg))) {
    const textBefore = svg.slice(cursor, match.index);
    if (/[<&]/.test(textBefore.replace(/\s+/g, ""))) unsafe(source, "raw markup or entity text");
    cursor = tagPattern.lastIndex;
    const closing = Boolean(match[1]);
    const name = match[2];
    const attributes = match[3] ?? "";
    if (!ALLOWED_TAGS.has(name)) unsafe(source, `tag ${name} is not allowlisted`);

    if (closing) {
      if (attributes.replace(/\s+/g, "")) unsafe(source, `closing tag ${name} has attributes`);
      if (stack.pop() !== name) unsafe(source, `unbalanced closing tag ${name}`);
      if (!stack.length) rootClosed = true;
      continue;
    }

    if (rootClosed) unsafe(source, "content appears after root element");
    if (!sawRoot && name !== "svg") unsafe(source, "root element must be svg");
    if (sawRoot && !stack.length) unsafe(source, "multiple root elements");
    validateTagAttributes(attributes, source);
    if (!sawRoot) {
      sawRoot = true;
      if (!/\bviewBox\s*=/.test(attributes)) unsafe(source, "root svg requires viewBox");
    }
    const selfClosing = /\/\s*$/.test(attributes);
    if (!selfClosing) stack.push(name);
    else if (!stack.length && name === "svg") rootClosed = true;
  }

  const trailing = svg.slice(cursor);
  if (/[<&]/.test(trailing.replace(/\s+/g, ""))) unsafe(source, "raw markup or entity text");
  if (!sawRoot || stack.length || !rootClosed) unsafe(source, "SVG must contain one closed root element");
  return svg;
}

export function sanitizeSvgFile(filePath) {
  return sanitizeSvg(fs.readFileSync(filePath, "utf8"), filePath);
}

