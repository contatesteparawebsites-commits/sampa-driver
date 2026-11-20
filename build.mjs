#!/usr/bin/env node
/**
 * SAMPA DRIVER build
 * Junta src/shell.html + src/theme.css + vendor/three.min.js + src/js/*.js
 * em um único index.html autossuficiente (sem CDN para o motor 3D).
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

const shell = read("src/shell.html");
const css = read("src/theme.css");
const three = read("vendor/three.min.js");

const jsDir = join(root, "src/js");
const files = readdirSync(jsDir).filter((f) => f.endsWith(".js")).sort();
const game = files
  .map((f) => `/* ---------- ${f} ---------- */\n` + readFileSync(join(jsDir, f), "utf8"))
  .join("\n\n");

const bundle = [
  "(function(){",
  '"use strict";',
  "if(!window.THREE){console.error('Three.js não encontrado');}",
  game,
  "})();"
].join("\n");

for (const [name, source] of [["css", css], ["three", three], ["game", bundle]]) {
  if (source.includes("</script>")) {
    console.warn(`aviso: ${name} contém a sequência </script>`);
  }
}

let html = shell;
html = html.replace("/*__CSS__*/", () => css);
html = html.replace("/*__THREE__*/", () => three);
html = html.replace("/*__GAME__*/", () => bundle);
// garante que nenhuma marca sobrou
for (const marker of ["/*__CSS__*/", "/*__THREE__*/", "/*__GAME__*/"]) {
  if (html.includes(marker)) throw new Error("marcador não substituído: " + marker);
}

writeFileSync(join(root, "index.html"), html);
const kb = (n) => (n / 1024).toFixed(0) + " KB";
console.log(`index.html gerado · ${kb(Buffer.byteLength(html))}`);
console.log(`  css    ${kb(Buffer.byteLength(css))}`);
console.log(`  three  ${kb(Buffer.byteLength(three))}`);
console.log(`  jogo   ${kb(Buffer.byteLength(bundle))} (${files.length} módulos)`);
