// Uso: node scripts/extract-fonts.mjs <revista.pdf>
// Reconstrói as fontes de título embutidas no PDF (que vêm com só parte das letras)
// como arquivos .otf em fonts/, para usar no site.
import * as mupdf from "mupdf"; import opentype from "opentype.js"; import fs from "fs";

const WANT = { DracoRegular: "Draco", AerosoldierPERSONALUSE: "Aerosoldier", GraffitiXenoa: "GraffitiXenoa", NextUps: "NextUps" };
const CHARS = " !&,-.0123456789:?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÀÂÃÇÉÊÍÓÔÕÚáàâãçéêíóôõú–’“”|";

const doc = mupdf.Document.openDocument(fs.readFileSync(process.argv[2]), "application/pdf");

// 1. acha os arquivos de fonte embutidos
const files = {};
for (let i = 1; i < doc.countObjects(); i++) {
  let o; try { o = doc.newIndirect(i, 0).resolve(); } catch { continue; }
  if (!o.isDictionary() || o.get("Type").toString() !== "/FontDescriptor") continue;
  const name = o.get("FontName").toString();
  const key = Object.keys(WANT).find((k) => name.includes(k));
  if (!key) continue;
  for (const k of ["FontFile", "FontFile2", "FontFile3"]) {
    const f = o.get(k);
    if (!f.isNull()) files[key] = f.readStream().asUint8Array();
  }
}

// 2. desenha cada letra e lê o contorno
function outline(font, ch) {
  const buf = new mupdf.Buffer();
  const w = new mupdf.DocumentWriter(buf, "svg", "text=path");
  const dev = w.beginPage([0, 0, 10, 10]);
  const t = new mupdf.Text();
  t.showString(font, [1, 0, 0, 1, 0, 0], ch);
  dev.fillText(t, mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, [0, 0, 0], 1);
  w.endPage(); w.close();
  const m = buf.asString().match(/<path id="font_[^"]+" d="([^"]*)"/);
  return m ? m[1] : "";
}

function toPath(d, scale) {
  const p = new opentype.Path();
  const tok = d.match(/[MLCHVZ]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi) || [];
  let i = 0, cmd = "", x = 0, y = 0;
  const num = () => parseFloat(tok[i++]) * scale;
  while (i < tok.length) {
    if (/[A-Z]/i.test(tok[i])) cmd = tok[i++];
    if (cmd === "M") { x = num(); y = num(); p.moveTo(x, y); cmd = "L"; }
    else if (cmd === "L") { x = num(); y = num(); p.lineTo(x, y); }
    else if (cmd === "H") { x = num(); p.lineTo(x, y); }
    else if (cmd === "V") { y = num(); p.lineTo(x, y); }
    else if (cmd === "C") { const a = [num(), num(), num(), num()]; x = num(); y = num(); p.curveTo(...a, x, y); }
    else if (cmd === "Z") { p.close(); cmd = ""; }
    else i++;
  }
  return p;
}

fs.mkdirSync("fonts", { recursive: true });
for (const [key, family] of Object.entries(WANT)) {
  if (!files[key]) { console.log("não encontrada:", key); continue; }
  const font = new mupdf.Font(family, files[key]);
  const glyphs = [new opentype.Glyph({ name: ".notdef", advanceWidth: 500, path: new opentype.Path() })];
  const have = {};
  for (const ch of CHARS) {
    const gid = font.encodeCharacter(ch);
    // subconjuntos às vezes mapeiam letras não usadas para um desenho vazio
    if (ch === " " || (gid > 0 && outline(font, ch).length > 0)) have[ch] = gid;
  }
  // fontes só de maiúsculas: minúscula usa o desenho da maiúscula
  for (const ch of CHARS) {
    const up = ch.toUpperCase();
    if (!(ch in have) && up !== ch && up in have) have[ch] = { from: up };
  }
  let yMax = 0, yMin = 0;
  for (const [ch, g] of Object.entries(have)) {
    const src = typeof g === "object" ? g.from : ch;
    const gid = font.encodeCharacter(src);
    const path = src === " " ? new opentype.Path() : toPath(outline(font, src), 1000);
    const bb = path.getBoundingBox(); yMax = Math.max(yMax, bb.y2); yMin = Math.min(yMin, bb.y1);
    glyphs.push(new opentype.Glyph({
      name: "u" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"),
      unicode: ch.codePointAt(0),
      advanceWidth: Math.round(font.advanceGlyph(src === " " ? font.encodeCharacter(" ") || 0 : gid) * 1000) || 300,
      path,
    }));
  }
  const out = new opentype.Font({
    familyName: family, styleName: "Regular", unitsPerEm: 1000,
    ascender: Math.ceil(Math.max(yMax, 800)), descender: Math.floor(Math.min(yMin, -200)), glyphs,
  });
  fs.writeFileSync(`fonts/${family}.otf`, Buffer.from(out.toArrayBuffer()));
  console.log(family, "→", glyphs.length - 1, "caracteres:", Object.keys(have).join(""));
}
