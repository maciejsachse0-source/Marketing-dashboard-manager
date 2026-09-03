/**
 * Kanon typografii (zasady Z5, Z6, Z7): szuka emoji, wyśrodkowanych kropek
 * i długich myślników WYŁĄCZNIE w tekstach widocznych dla użytkownika, czyli
 * w literałach tekstowych i w tekście JSX. Komentarze w kodzie są pomijane,
 * bo parser je zna, a grep nie.
 *
 * Od F7-17 skanuje także katalog `data/` (pliki JSON zasilające katalog agentów
 * i szablonów). Tam sprawdzane są wszystkie wartości tekstowe POZA `systemPrompt`,
 * bo prompt idzie do modelu, a nie na ekran, i jego treść ma zostać bajt w bajt.
 * Katalogi kopii zapasowych (`_backup*`) są pomijane — to zamrożone zrzuty.
 *
 * Użycie: node scripts/check-typography.mjs [katalog]
 * Kod wyjścia: 0 gdy zero trafień, 1 gdy cokolwiek znaleziono.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const ROOT = process.argv[2] ?? 'src';
const RULES = [
  { name: 'Z5 emoji', re: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u },
  { name: 'Z6 kropka', re: /·/u },
  { name: 'Z7 myślnik', re: /—/u },
];

function files(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

let hits = 0;
for (const path of files(ROOT)) {
  const text = readFileSync(path, 'utf8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node) => {
    const isText =
      ts.isStringLiteral(node) ||
      ts.isJsxText(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node);
    if (isText) {
      for (const rule of RULES) {
        if (rule.re.test(node.text)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          console.log(`${path}:${line + 1}: ${rule.name}: ${node.text.trim().slice(0, 80)}`);
          hits += 1;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
// Pliki danych: JSON z `data/`. Klucz `systemPrompt` pomijany świadomie (F7-17).
function jsonFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry.startsWith('_backup') ? [] : jsonFiles(path);
    return path.endsWith('.json') ? [path] : [];
  });
}

function walkJson(value, key, path) {
  if (typeof value === 'string') {
    if (key === 'systemPrompt') return;
    for (const rule of RULES) {
      if (rule.re.test(value)) {
        console.log(`${path}: ${rule.name}: ${key}: ${value.trim().slice(0, 80)}`);
        hits += 1;
      }
    }
    return;
  }
  if (Array.isArray(value)) value.forEach((v) => walkJson(v, key, path));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walkJson(v, k, path);
  }
}

if (ROOT === 'src') {
  for (const path of jsonFiles('data')) walkJson(JSON.parse(readFileSync(path, 'utf8')), '', path);
}

console.log(`TRAFIENIA: ${hits}`);
process.exit(hits === 0 ? 0 : 1);
