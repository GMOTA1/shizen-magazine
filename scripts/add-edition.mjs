// Uso: node scripts/add-edition.mjs <arquivo.pdf> <id> "<titulo>" "<data>"
// Converte o PDF em imagens WebP e registra a edição em editions/editions.js
import * as mupdf from "mupdf"; import sharp from "sharp"; import fs from "fs"; import path from "path";

const [pdf, id, title = id, date = ""] = process.argv.slice(2);
if (!pdf || !id) { console.error("Uso: node scripts/add-edition.mjs <pdf> <id> [titulo] [data]"); process.exit(1); }

const out = path.join("editions", id);
fs.mkdirSync(path.join(out, "pages"), { recursive: true });
fs.mkdirSync(path.join(out, "thumbs"), { recursive: true });

const doc = mupdf.Document.openDocument(fs.readFileSync(pdf), "application/pdf");
const n = doc.countPages();
const pages = [];
for (let i = 0; i < n; i++) {
  const page = doc.loadPage(i);
  const png = page.toPixmap(mupdf.Matrix.scale(2.5, 2.5), mupdf.ColorSpace.DeviceRGB, false, true).asPNG();
  const name = String(i + 1).padStart(3, "0") + ".webp";
  await sharp(png).resize({ width: 1400 }).webp({ quality: 82 }).toFile(path.join(out, "pages", name));
  await sharp(png).resize({ width: 280 }).webp({ quality: 70 }).toFile(path.join(out, "thumbs", name));
  pages.push(name);
  process.stdout.write(`\r${i + 1}/${n}`);
}

const registry = path.join("editions", "editions.js");
let list = [];
if (fs.existsSync(registry)) list = JSON.parse(fs.readFileSync(registry, "utf8").replace(/^window\.EDITIONS\s*=\s*/, "").replace(/;\s*$/, ""));
const prev = list.find(e => e.id === id) || {};
list = list.filter(e => e.id !== id);
list.push({ ...prev, id, title, date, pages: n, cover: `editions/${id}/pages/001.webp`, sections: prev.sections || [] });
fs.writeFileSync(registry, "window.EDITIONS = " + JSON.stringify(list, null, 2) + ";\n");
console.log(`\nEdição "${title}" adicionada com ${n} páginas.`);
