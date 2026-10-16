# Site da Revista SHIZEN

Site estático (HTML, CSS e JS puros) com leitor de edições página a página.

## Ver o site no computador

```
npm install
npm start
```

Abra http://localhost:5173

## Adicionar uma nova edição

```
npm run add-edition -- "C:\caminho\SHIZEN Vol2.pdf" vol-02 "Vol. 02" "Agosto 2026"
```

O script converte o PDF em imagens (`editions/vol-02/`) e registra a edição em `editions/editions.js`.
A edição mais recente vira automaticamente o destaque da página inicial.

Para mostrar o índice "Nesta edição", edite `editions/editions.js` e preencha `sections`:

```js
"sections": [
  { "title": "Streetwear em Foco", "page": 4 }
]
```

## Fontes

As fontes de título vêm da própria revista, reconstruídas a partir do PDF:

| Fonte | Uso no site |
|---|---|
| Draco | logo SHIZEN, "LEIA AGORA", tagline, volume |
| Aerosoldier | textos grafite ("Chegou", "Shizen", "Aguarde") |
| Oswald, Josefin Sans | títulos, menus, números (Google Fonts) |
| Crimson Pro | texto corrido (substitui a Minion Pro da revista) |

O PDF só traz as letras usadas na revista, então a Draco e a Aerosoldier não têm todos os
caracteres (por exemplo, faltam Ç e Ã). Para refazer as fontes a partir de outro PDF:

```
node scripts/extract-fonts.mjs "C:\caminho\revista.pdf"
```

Se tiver os arquivos originais das fontes (.otf/.ttf), basta substituí-los na pasta `fonts/`.

## Publicar

Envie para qualquer hospedagem estática (Netlify, Vercel, GitHub Pages, Cloudflare Pages) os arquivos:
`index.html`, `styles.css`, `app.js` e as pastas `editions/`, `fonts/` e `vendor/`. As pastas `node_modules/` e `scripts/` não precisam ir.

## Links diretos

Cada página tem seu próprio link, por exemplo `/#ler/vol-01/24` abre o Vol. 01 na página 24.
