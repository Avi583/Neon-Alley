// Rewrites the docs/ section of DIRECTORY.md to match the build output,
// since each build changes the hashed filenames in docs/assets/. Run by build.bat.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const HEADING = '## docs/ (deployed build output)';
const FILE = 'DIRECTORY.md';

const files = readdirSync('docs', { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => `${entry.parentPath}/${entry.name}`.replaceAll('\\', '/'))
  .sort();

const text = readFileSync(FILE, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const start = text.indexOf(HEADING);
if (start === -1) throw new Error(`${FILE}: heading not found: ${HEADING}`);

// The section runs to the next heading, or to the end of the file.
const next = text.indexOf(`${eol}## `, start + HEADING.length);
const after = next === -1 ? '' : text.slice(next);
const list = files.map((file) => `- ${file}`).join(eol);

writeFileSync(FILE, `${text.slice(0, start)}${HEADING}${eol}${list}${eol}${after}`);
console.log(`${FILE}: docs/ section updated (${files.length} files).`);
