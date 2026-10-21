#!/usr/bin/env node
// scan-public.mjs — fail-closed forbidden-pattern scanner (zero dependencies, Node ESM).
//
// Usage (from anywhere inside the workspace; `npm run scan:public` runs the default):
//   node harness/tools/scan-public.mjs [--root <dir>] [--patterns <forbidden.json>] [--scope all|brain]
//                                      [--gitignore <file>|--no-gitignore] [--allow <exceptions.json>|--no-allow]
//   node harness/tools/scan-public.mjs --self-test [--patterns <forbidden.json>]
//
// Defaults (workspace root = nearest ancestor of this script that has harness/config/local-harness.json,
// or HARNESS_ROOT when set):
//   --root      <workspace root>
//   --patterns  <workspace root>/private/scan/forbidden-strings.local.json   (required; private, gitignored)
//   --allow     <workspace root>/private/scan/scan-allow.json                (optional; missing => no exceptions)
//   --gitignore <workspace root>/.gitignore                                  (optional; missing => scan everything)
// A public clone has no private/ folder: create your own patterns file from
// harness/tools/forbidden-strings.example.json (copy it to private/scan/forbidden-strings.local.json and
// replace the fake values with your real private strings).
//
// Design notes:
// - Sensitive literals live ONLY in the patterns JSON. This source file contains none;
//   self-test canaries are synthesized at runtime from the loaded regexes.
// - Both file content and the root-relative path are scanned, after NFKC normalization.
// - Output never prints the matched text: only file, line, column, length, rule id and a
//   masked context (letters/digits/CJK replaced with '*').
// - Exit codes: 0 = no hits, 1 = hits (or unreadable input), 2 = self-test failure / usage error.
// - .gitignore rules and exception globs are matched against the path relative to the .gitignore's
//   folder (the workspace root) whenever the scan root lies inside it, so `--root brain` honours the
//   same rules as a full scan.
// - Fail-closed copy check: any scanned (non-ignored) file whose bytes equal the patterns file or the
//   exceptions file is reported as rule=private-file-copy and cannot be suppressed by exceptions.
//
// Patterns JSON shape:
//   { "scope_all": [{id, re, flags?, allow?: [domain,...]}],
//     "scope_brain_only": [...], "warn_only": [...] }
// Exceptions JSON (optional, --allow) shape:
//   { "exceptions": [{ "path": "<relative path or glob>", "rules": ["<rule id>", ...], "reason": "..." }] }

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MARKER = path.join('harness', 'config', 'local-harness.json');
const DEFAULT_PATTERNS = path.join('private', 'scan', 'forbidden-strings.local.json');
const DEFAULT_ALLOW = path.join('private', 'scan', 'scan-allow.json');
const EXAMPLE_PATTERNS = path.join('harness', 'tools', 'forbidden-strings.example.json');

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.tif', '.tiff', '.heic', '.avif',
  '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls', '.odt', '.odp', '.ods',
  '.zip', '.7z', '.gz', '.tgz', '.rar', '.tar', '.jar', '.exe', '.dll', '.so', '.dylib',
  '.mp3', '.mp4', '.wav', '.ogg', '.webm', '.mov', '.avi', '.m4a', '.flac',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.glb', '.gltf.bin', '.bin', '.wasm', '.sqlite', '.db',
]);

function die(msg, code = 2) {
  process.stderr.write(`scan-public: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { scope: 'all' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) die(`missing value for ${a}`);
      return argv[++i];
    };
    if (a === '--root') out.root = next();
    else if (a === '--patterns') out.patterns = next();
    else if (a === '--scope') out.scope = next();
    else if (a === '--gitignore') out.gitignore = next();
    else if (a === '--no-gitignore') out.noGitignore = true;
    else if (a === '--allow') out.allow = next();
    else if (a === '--no-allow') out.noAllow = true;
    else if (a === '--self-test') out.selfTest = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else die(`unknown argument: ${a}`);
  }
  if (!['all', 'brain'].includes(out.scope)) die(`--scope must be all|brain`);
  if (out.gitignore && out.noGitignore) die('--gitignore and --no-gitignore are mutually exclusive');
  if (out.allow && out.noAllow) die('--allow and --no-allow are mutually exclusive');
  return out;
}

// Workspace root: HARNESS_ROOT (must contain the marker) or the nearest ancestor of this script with it.
function findWorkspaceRoot() {
  const explicit = process.env.HARNESS_ROOT;
  if (explicit) {
    const r = path.resolve(explicit);
    if (!fs.existsSync(path.join(r, MARKER))) die(`HARNESS_ROOT has no ${MARKER.replace(/\\/g, '/')}`);
    return r;
  }
  let cur = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    if (fs.existsSync(path.join(cur, MARKER))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) die(`workspace root not found (no ${MARKER.replace(/\\/g, '/')} above this script); set HARNESS_ROOT`);
    cur = parent;
  }
}

function missingPatternsHelp(file, ws) {
  const rel = path.relative(ws, file).replace(/\\/g, '/');
  const looksDefault = rel === DEFAULT_PATTERNS.replace(/\\/g, '/');
  return [
    `forbidden-patterns file not found: ${looksDefault ? rel : '<given --patterns path>'}`,
    '  The scan is fail-closed and refuses to run without it.',
    '  A public clone ships no private/ folder. Create your own:',
    `    1. copy ${EXAMPLE_PATTERNS.replace(/\\/g, '/')} to ${DEFAULT_PATTERNS.replace(/\\/g, '/')}`,
    '    2. replace the fake example values with your real private strings (paths, accounts, codenames...)',
    '    3. keep private/ in .gitignore; never commit that file',
    `  To check the example file itself: node harness/tools/scan-public.mjs --self-test --patterns ${EXAMPLE_PATTERNS.replace(/\\/g, '/')}`,
  ].join('\n');
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// Resolve defaults. Explicit relative paths resolve against the current directory (normal CLI behaviour).
function resolveOptions(opts) {
  const ws = findWorkspaceRoot();
  const r = { ...opts, workspace: ws, notices: [] };
  r.root = opts.root ? path.resolve(opts.root) : ws;
  r.patterns = opts.patterns ? path.resolve(opts.patterns) : path.join(ws, DEFAULT_PATTERNS);
  if (!fs.existsSync(r.patterns)) die(missingPatternsHelp(r.patterns, ws));
  if (opts.noAllow) r.allow = undefined;
  else if (opts.allow) {
    r.allow = path.resolve(opts.allow);
    if (!fs.existsSync(r.allow)) die('exceptions file given with --allow not found');
  } else {
    const def = path.join(ws, DEFAULT_ALLOW);
    if (fs.existsSync(def)) r.allow = def;
    else r.notices.push('no exceptions file (private/scan/scan-allow.json) — scanning with zero exceptions');
  }
  if (opts.noGitignore) r.gitignore = undefined;
  else if (opts.gitignore) {
    r.gitignore = path.resolve(opts.gitignore);
    if (!fs.existsSync(r.gitignore)) die('gitignore file given with --gitignore not found');
  } else {
    const def = path.join(ws, '.gitignore');
    if (fs.existsSync(def)) r.gitignore = def;
    else r.notices.push('no .gitignore at workspace root — every file is in scope');
  }
  return r;
}

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    die(`cannot read JSON ${file}: ${e.message}`);
  }
}

function compileRules(list, kind) {
  if (!Array.isArray(list)) return [];
  return list.map((r) => {
    if (!r || typeof r.id !== 'string' || typeof r.re !== 'string') die(`malformed rule in ${kind}`);
    const flags = (r.flags || '').replace(/[gy]/g, '');
    let re;
    try {
      re = new RegExp(r.re, flags + 'g');
    } catch (e) {
      die(`rule ${r.id} has invalid regex: ${e.message}`);
    }
    return {
      id: r.id,
      source: r.re,
      flags,
      re,
      allow: Array.isArray(r.allow) ? r.allow.map((d) => String(d).toLowerCase()) : [],
      kind,
    };
  });
}

function loadRules(patternsFile, scope) {
  const j = loadJson(patternsFile);
  const fail = compileRules(j.scope_all, 'scope_all');
  if (scope === 'brain') fail.push(...compileRules(j.scope_brain_only, 'scope_brain_only'));
  const warn = compileRules(j.warn_only, 'warn_only');
  if (fail.length === 0) die('no fail rules loaded (fail-closed)');
  return { fail, warn, all: [...compileRules(j.scope_all, 'scope_all'), ...compileRules(j.scope_brain_only, 'scope_brain_only')] };
}

// Email allow-list: the domain part (after '@') must equal or end with "." + an allowed domain.
function isAllowed(rule, matchText) {
  if (!rule.allow.length) return false;
  const at = matchText.lastIndexOf('@');
  if (at < 0) return false;
  const domain = matchText.slice(at + 1).toLowerCase().replace(/\.+$/, '');
  return rule.allow.some((d) => domain === d || domain.endsWith('.' + d));
}

function maskChar(ch) {
  if (/[\p{L}\p{N}]/u.test(ch)) return '*';
  if (ch === '\n' || ch === '\r' || ch === '\t') return ' ';
  return ch;
}
function mask(s) {
  return Array.from(s).map(maskChar).join('');
}

function lineColOf(text, idx) {
  let line = 1;
  let last = -1;
  for (let i = 0; i < idx; i++) if (text.charCodeAt(i) === 10) { line++; last = i; }
  return { line, col: idx - last };
}

function scanText(text, rules) {
  const norm = text.normalize('NFKC');
  const hits = [];
  for (const rule of rules) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(norm)) !== null) {
      if (m[0].length === 0) { rule.re.lastIndex++; continue; }
      if (!isAllowed(rule, m[0])) {
        const { line, col } = lineColOf(norm, m.index);
        const before = norm.slice(Math.max(0, m.index - 10), m.index);
        const after = norm.slice(m.index + m[0].length, m.index + m[0].length + 10);
        hits.push({ rule: rule.id, line, col, len: m[0].length, ctx: `${mask(before)}[#]${mask(after)}` });
      }
    }
  }
  return hits;
}

// ---- .gitignore (subset: comments, blank, negation '!', trailing '/', leading '/', '*', '**', '?') ----
function globToRegexBody(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // '**/' -> zero or more dirs; trailing '**' -> anything
        if (glob[i + 2] === '/') { out += '(?:.*/)?'; i += 2; }
        else { out += '.*'; i += 1; }
      } else out += '[^/]*';
    } else if (c === '?') out += '[^/]';
    else if ('\\^$.|+()[]{}'.includes(c)) out += '\\' + c;
    else out += c;
  }
  return out;
}

function loadGitignore(file) {
  if (!file) return [];
  const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const rules = [];
  for (let raw of lines) {
    let line = raw.replace(/\s+$/, '');
    if (!line || line.startsWith('#')) continue;
    let negate = false;
    if (line.startsWith('!')) { negate = true; line = line.slice(1); }
    let dirOnly = false;
    if (line.endsWith('/')) { dirOnly = true; line = line.slice(0, -1); }
    let anchored = false;
    if (line.startsWith('/')) { anchored = true; line = line.slice(1); }
    if (line.includes('/')) anchored = true;
    if (!line) continue;
    const body = globToRegexBody(line);
    const prefix = anchored ? '^' : '^(?:.*/)?';
    // Match the path itself (file or dir) or any descendant of a matched dir.
    const reSelf = new RegExp(prefix + body + '$');
    const reDesc = new RegExp(prefix + body + '/');
    rules.push({ negate, dirOnly, reSelf, reDesc });
  }
  return rules;
}

function isIgnored(relPosix, isDir, giRules) {
  let ignored = false;
  for (const r of giRules) {
    let hit = false;
    if (r.reDesc.test(relPosix)) hit = true; // a parent dir matched
    else if (r.reSelf.test(relPosix) && (!r.dirOnly || isDir)) hit = true;
    if (hit) ignored = !r.negate;
  }
  return ignored;
}

function loadExceptions(file) {
  if (!file) return [];
  const j = loadJson(file);
  const list = Array.isArray(j.exceptions) ? j.exceptions : [];
  return list.map((e) => {
    if (typeof e.path !== 'string' || !Array.isArray(e.rules)) die('malformed exception entry');
    return { re: new RegExp('^' + globToRegexBody(e.path.replace(/\\/g, '/')) + '$'), rules: new Set(e.rules), path: e.path };
  });
}

function walk(root, giRules, basePrefix, out = [], rel = '') {
  const dir = path.join(root, rel);
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${ent.name}` : ent.name;
    if (ent.name === '.git' && ent.isDirectory()) continue;
    const isDir = ent.isDirectory();
    const baseRel = basePrefix ? `${basePrefix}/${r}` : r;
    if (isIgnored(baseRel, isDir, giRules)) continue;
    if (isDir) walk(root, giRules, basePrefix, out, r);
    else out.push({ rel: r, baseRel });
  }
  return out;
}

function isBinary(file, buf) {
  const lower = file.toLowerCase();
  for (const ext of BINARY_EXT) if (lower.endsWith(ext)) return true;
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

// Path relative to the .gitignore folder when the scan root is inside it; '' when they are the same.
function basePrefixOf(root, gitignoreFile) {
  if (!gitignoreFile) return '';
  const rel = path.relative(path.dirname(gitignoreFile), root);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return '';
  return rel.split(path.sep).join('/');
}

function runScan(opts) {
  const root = opts.root;
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) die('root is not a directory');
  const { fail, warn } = loadRules(opts.patterns, opts.scope);
  const gi = loadGitignore(opts.gitignore);
  const exc = loadExceptions(opts.allow);
  const basePrefix = basePrefixOf(root, opts.gitignore);
  const files = walk(root, gi, basePrefix);
  const privateDigests = new Map([[sha256File(opts.patterns), 'patterns']]);
  if (opts.allow) privateDigests.set(sha256File(opts.allow), 'exceptions');
  const hits = [];
  const warns = [];
  const binaries = [];
  const suppressed = [];
  const maskedFiles = new Set();
  for (const { rel, baseRel } of files) {
    const buf = fs.readFileSync(path.join(root, rel));
    const pathHits = scanText(baseRel, fail).map((h) => ({ ...h, where: 'path' }));
    if (pathHits.length) maskedFiles.add(rel);
    let contentHits = [];
    let wHits = scanText(baseRel, warn).map((h) => ({ ...h, where: 'path' }));
    const digest = crypto.createHash('sha256').update(buf).digest('hex');
    if (privateDigests.has(digest)) {
      // never suppressible: a byte copy of the private patterns/exceptions file is in public scope
      hits.push({ file: rel, rule: 'private-file-copy', where: 'path', len: buf.length, ctx: `copy-of-${privateDigests.get(digest)}` });
    }
    if (isBinary(rel, buf)) {
      binaries.push(rel);
    } else {
      const text = buf.toString('utf8');
      contentHits = scanText(text, fail).map((h) => ({ ...h, where: 'content' }));
      wHits = wHits.concat(scanText(text, warn).map((h) => ({ ...h, where: 'content' })));
    }
    for (const h of [...pathHits, ...contentHits]) {
      const ex = exc.find((e) => e.re.test(baseRel) && e.rules.has(h.rule));
      if (ex) suppressed.push({ file: rel, ...h, exception: ex.path });
      else hits.push({ file: rel, ...h });
    }
    for (const h of wHits) warns.push({ file: rel, ...h });
  }
  // A file whose path itself matched a rule is printed masked, so the output never leaks the literal.
  const show = (f) => (maskedFiles.has(f) ? `<masked-path:${mask(f)}>` : f);
  const p = (s) => process.stdout.write(s + '\n');
  for (const n of opts.notices || []) p(`NOTE ${n}`);
  p(`scan-public: root=${basePrefix ? '<workspace>/' + basePrefix : '<workspace-or-given>'} scope=${opts.scope} files=${files.length} fail_rules=${fail.length} gitignore=${opts.gitignore ? 'yes' : 'no'} exceptions=${exc.length}`);
  for (const h of hits) p(`HIT  ${show(h.file)}:${h.where === 'path' ? 'PATH' : h.line}:${h.where === 'path' ? '-' : h.col} rule=${h.rule} len=${h.len} ctx=${h.ctx}`);
  for (const h of suppressed) p(`EXC  ${show(h.file)}:${h.where === 'path' ? 'PATH' : h.line} rule=${h.rule} (exception ${h.exception})`);
  for (const h of warns) p(`WARN ${show(h.file)}:${h.where === 'path' ? 'PATH' : h.line} rule=${h.rule}`);
  p(`binary_files_need_manual_metadata_check=${binaries.length}`);
  for (const b of binaries) p(`BIN  ${show(b)}`);
  const byRule = {};
  for (const h of hits) byRule[h.rule] = (byRule[h.rule] || 0) + 1;
  p(`hits=${hits.length} suppressed=${suppressed.length} warnings=${warns.length} by_rule=${JSON.stringify(byRule)}`);
  process.exit(hits.length ? 1 : 0);
}

// ---------------- self-test ----------------
// Minimal regex sampler: produces one string that matches a given alternative of a regex
// source. Supports literals, escapes, classes, groups (first alternative), quantifiers and
// skips lookaround assertions (canaries are padded with spaces to satisfy them).
function splitTopLevel(src) {
  const parts = [];
  let depth = 0, inClass = false, cur = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') { cur += c + (src[i + 1] ?? ''); i++; continue; }
    if (inClass) { if (c === ']') inClass = false; cur += c; continue; }
    if (c === '[') { inClass = true; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === '|' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

function sampleEscape(ch) {
  if (ch === 'd') return '1';
  if (ch === 'w') return 'a';
  if (ch === 's') return ' ';
  if (ch === 'n') return '\n';
  if (ch === 't') return '\t';
  return ch;
}

function sampleClass(body) {
  // body without brackets; pick the first concrete char, honoring escapes and ranges.
  if (body.startsWith('^')) return 'Q'; // negated class: unlikely in rules; best effort
  if (body[0] === '\\') return sampleEscape(body[1]);
  return body[0];
}

function sampleSeq(src) {
  let out = '';
  let i = 0;
  const atoms = [];
  while (i < src.length) {
    const c = src[i];
    let atom;
    if (c === '\\') { atom = sampleEscape(src[i + 1]); i += 2; }
    else if (c === '[') {
      let j = i + 1, body = '';
      while (j < src.length && src[j] !== ']') { if (src[j] === '\\') { body += src[j] + src[j + 1]; j += 2; } else body += src[j++]; }
      atom = sampleClass(body); i = j + 1;
    } else if (c === '(') {
      let depth = 1, j = i + 1, inner = '';
      let inClass = false;
      while (j < src.length && depth > 0) {
        const d = src[j];
        if (d === '\\') { inner += d + src[j + 1]; j += 2; continue; }
        if (inClass) { if (d === ']') inClass = false; }
        else if (d === '[') inClass = true;
        else if (d === '(') depth++;
        else if (d === ')') { depth--; if (depth === 0) break; }
        inner += d; j++;
      }
      i = j + 1;
      if (/^\?<?[!=]/.test(inner)) { atom = ''; atoms.push({ atom, lookaround: true }); continue; }
      if (inner.startsWith('?:')) inner = inner.slice(2);
      atom = sampleSeq(splitTopLevel(inner)[0]);
    } else if (c === '.') { atom = 'a'; i++; }
    else if (c === '^' || c === '$') { atom = ''; i++; }
    else { atom = c; i++; }
    // quantifier
    let rep = 1;
    const q = src[i];
    if (q === '?' || q === '*') { rep = 0; i++; }
    else if (q === '+') { rep = 1; i++; }
    else if (q === '{') {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(src.slice(i));
      if (m) { rep = Number(m[1]); i += m[0].length; }
    }
    if (src[i] === '?') i++; // lazy modifier
    atoms.push({ atom: atom.repeat(rep) });
  }
  for (const a of atoms) out += a.atom;
  return out;
}

function toFullwidth(s) {
  return Array.from(s).map((ch) => {
    const c = ch.codePointAt(0);
    return c >= 0x21 && c <= 0x7e ? String.fromCodePoint(c + 0xfee0) : ch;
  }).join('');
}

function selfTest(patternsFile) {
  const { all, warn } = loadRules(patternsFile, 'brain');
  let failures = 0;
  let checks = 0;
  const report = (ok, msg) => { checks++; if (!ok) { failures++; process.stdout.write(`FAIL ${msg}\n`); } };
  for (const rule of [...all, ...warn]) {
    const alts = splitTopLevel(rule.source);
    alts.forEach((alt, k) => {
      const sample = sampleSeq(alt);
      const canary = ` ${sample} `;
      const label = `rule=${rule.id} alt#${k + 1}`;
      report(sample.length > 0, `${label}: sampler produced empty canary`);
      // 1) plain canary hits via the scanner pipeline (content)
      const h1 = scanText(`prefix\n${canary}\nsuffix`, [rule]);
      report(h1.length > 0, `${label}: content canary not detected`);
      // 2) path canary (filename) hits
      const h2 = scanText(`dir/${sample.replace(/[\r\n]/g, '')}/file.md`, [rule]);
      report(h2.length > 0, `${label}: path canary not detected`);
      // 3) NFKC: fullwidth variant normalizes back and still hits
      const fw = toFullwidth(sample);
      if (fw !== sample && fw.normalize('NFKC') === sample) {
        const h3 = scanText(` ${fw} `, [rule]);
        report(h3.length > 0, `${label}: fullwidth (NFKC) canary not detected`);
      }
    });
    // 4) allow-list: an allowed domain must NOT hit; a non-allowed one must hit
    if (rule.allow.length) {
      const local = sampleSeq(splitTopLevel(rule.source)[0]).split('@')[0] || 'a';
      for (const d of rule.allow) report(scanText(` ${local}@${d} `, [rule]).length === 0, `rule=${rule.id}: allowed domain flagged`);
      report(scanText(` ${local}@notallowed.invalidtld `, [rule]).length > 0, `rule=${rule.id}: non-allowed domain missed`);
    }
  }
  // 5) URLs must not trigger the path-style rules (or any rule) on a neutral URL
  const neutral = [
    'see https://example.com/a/b and http://example.org/x?y=1',
    'file:///tmp/x and ftp://host/dir',
    'relative/path/to/file.md and ./a/b',
  ];
  for (const t of neutral) {
    const h = scanText(t, all);
    report(h.length === 0, `neutral text flagged by ${h.map((x) => x.rule).join(',')}`);
  }
  // 6) output masking: rendered context must not contain the matched sample
  for (const rule of all) {
    const sample = sampleSeq(splitTopLevel(rule.source)[0]);
    const h = scanText(`xx ${sample} yy`, [rule]);
    const rendered = h.map((x) => x.ctx).join('|');
    report(sample.length < 2 || !rendered.includes(sample), `rule=${rule.id}: context leaks match`);
  }
  // 7) gitignore subset
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TEMP || process.env.TMPDIR || '/tmp'), 'scanpub-'));
  try {
    const gif = path.join(tmp, '.gitignore');
    fs.writeFileSync(gif, '# c\n_index/\n*.local.json\n/rules/\nbuild/**/out\n!keep.local.json\n');
    const gr = loadGitignore(gif);
    const cases = [
      ['_index/a/b.md', false, true], ['_index', true, true], ['config/sites.local.json', false, true],
      ['config/sites.example.json', false, false], ['rules/x.md', false, true], ['a/rules/x.md', false, false],
      ['build/a/b/out', false, true], ['keep.local.json', false, false], ['brain/x.md', false, false],
    ];
    for (const [p, d, want] of cases) report(isIgnored(p, d, gr) === want, `gitignore case ${p} expected ${want}`);
    // private/ (unanchored) must exclude the private area at any depth
    const gp = path.join(tmp, '.gitignore.private');
    fs.writeFileSync(gp, 'private/\n');
    const gpr = loadGitignore(gp);
    for (const [p, d, want] of [['private/scan/x.json', false, true], ['projects/a/private/y.md', false, true],
      ['private', true, true], ['brain/private-notes.md', false, false]]) {
      report(isIgnored(p, d, gpr) === want, `gitignore private case ${p} expected ${want}`);
    }
    // sub-root scans resolve .gitignore/exception paths relative to the .gitignore folder
    fs.mkdirSync(path.join(tmp, 'brain'));
    report(basePrefixOf(path.join(tmp, 'brain'), gif) === 'brain', 'basePrefixOf sub-root');
    report(basePrefixOf(tmp, gif) === '', 'basePrefixOf same root');
    report(basePrefixOf(path.dirname(tmp), gif) === '', 'basePrefixOf outside root');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  process.stdout.write(`self-test: checks=${checks} failures=${failures} rules=${all.length + warn.length}\n`);
  process.exit(failures ? 2 : 0);
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
  process.stdout.write([
    'node harness/tools/scan-public.mjs [--root <dir>] [--patterns <json>] [--scope all|brain]',
    '                                   [--gitignore <file>|--no-gitignore] [--allow <json>|--no-allow]',
    'node harness/tools/scan-public.mjs --self-test [--patterns <json>]',
    `defaults: root=<workspace>, patterns=${DEFAULT_PATTERNS.replace(/\\/g, '/')}, allow=${DEFAULT_ALLOW.replace(/\\/g, '/')}, gitignore=.gitignore`,
    `no private patterns yet? start from ${EXAMPLE_PATTERNS.replace(/\\/g, '/')}`,
  ].join('\n') + '\n');
  process.exit(0);
}
const resolved = resolveOptions(opts);
if (opts.selfTest) selfTest(resolved.patterns);
else runScan(resolved);
