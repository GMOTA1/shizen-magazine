(() => {
  const editions = window.EDITIONS || [];
  const latest = editions[editions.length - 1];
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(3, "0");
  const pageSrc = (ed, n) => `editions/${ed.id}/pages/${pad(n)}.webp`;
  const thumbSrc = (ed, n) => `editions/${ed.id}/thumbs/${pad(n)}.webp`;

  $("year").textContent = new Date().getFullYear();

  // ---------- modo claro / escuro ----------
  const root = document.documentElement;
  const systemDark = matchMedia("(prefers-color-scheme: dark)");
  const currentTheme = () => root.dataset.theme || (systemDark.matches ? "dark" : "light");
  if (!root.dataset.theme) root.dataset.theme = currentTheme();
  $("theme-btn").onclick = () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("shizen-theme", next); } catch (e) {}
  };

  // ---------- página inicial ----------
  if (latest) {
    $("hero-kicker").textContent = `${latest.title.toUpperCase()} - ${latest.date.toUpperCase()}`;
    $("hero-cover-img").src = latest.cover;
    $("toc-sub").textContent = `${latest.title} · ${latest.pages} páginas`;

    const sections = latest.sections || [];
    $("toc").innerHTML = sections.map((s) => `
      <li><a href="#ler/${latest.id}/${s.page}">
        <span class="thumb"><img loading="lazy" src="${thumbSrc(latest, s.page)}" alt=""><span class="num">${String(s.page).padStart(2, "0")}</span></span>
        <span class="name">${s.title}</span>
      </a></li>`).join("");

    const words = sections.length ? sections.map((s) => s.title) : ["Cultura", "Hype", "Estilo", "Atitude"];
    const run = words.map((w) => `<span>${w}</span>`).join("");
    $("marquee").innerHTML = run + run;
  }

  $("editions").innerHTML = [...editions].reverse().map((ed) => `
    <a class="edition" href="#ler/${ed.id}/1" data-id="${ed.id}">
      <div class="cover"><img loading="lazy" src="${ed.cover}" alt="Capa SHIZEN ${ed.title}"></div>
      <div class="meta"><span class="vol">${ed.title.toUpperCase()}</span><span class="date">${ed.date}</span></div>
    </a>`).join("") + `
    <div class="edition soon" aria-label="Próxima edição em breve">
      <div class="cover"><span>Aguarde</span></div>
      <div class="meta"><span class="vol">VOL. ${String(editions.length + 1).padStart(2, "0")}</span><span class="date">Em breve</span></div>
    </div>`;

  // ---------- leitor com folhas virando ----------
  const reader = $("leitor"), host = $("book-host"), scrubber = $("scrubber"), thumbs = $("thumbs");
  let ed = null, book = null, loaded = new Set();

  // carrega as imagens só das páginas próximas (a revista inteira tem ~20MB)
  function loadAround(i) {
    if (!book) return;
    const pages = host.querySelectorAll(".page img");
    for (let k = i - 2; k <= i + 5; k++) {
      if (k < 0 || k >= pages.length || loaded.has(k)) continue;
      pages[k].src = pages[k].dataset.src;
      loaded.add(k);
    }
  }

  // revista fechada: capa (ou contracapa) centralizada; aberta: as duas páginas
  function updateClosed(opening = false) {
    const i = book.getCurrentPageIndex(), last = book.getPageCount() - 1;
    const landscape = book.getOrientation() === "landscape";
    const alone = last % 2 === 1; // última página sozinha à esquerda
    host.classList.toggle("closed-front", landscape && !opening && i === 0);
    host.classList.toggle("closed-back", landscape && !opening && alone && i === last);
  }

  function updateUI() {
    const i = book.getCurrentPageIndex(), n = book.getPageCount();
    const landscape = book.getOrientation() === "landscape";
    let shown = [i];
    if (landscape && i > 0) {
      const left = i % 2 === 1 ? i : i - 1;
      shown = left + 1 < n ? [left, left + 1] : [left];
    }
    const label = shown.map((k) => k + 1).join("–");
    $("reader-count").textContent = `página ${label} de ${n}`;
    $("btn-prev").disabled = i <= 0;
    $("btn-next").disabled = shown[shown.length - 1] >= n - 1;
    scrubber.value = shown[0] + 1;
    thumbs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", shown.includes(+b.dataset.page - 1)));
    const on = thumbs.querySelector("button.on");
    if (on && !thumbs.hidden) thumbs.scrollTo({ left: on.offsetLeft - thumbs.clientWidth / 2, behavior: "smooth" });
    // só guarda a página no endereço depois que a pessoa começa a ler
    if (touched) history.replaceState(null, "", `#ler/${ed.id}/${shown[0] + 1}`);
  }
  let touched = false;

  function loadEdition(id, startPage = 1) {
    const found = editions.find((e) => e.id === id);
    if (!found) return;
    if (ed === found && book) { goTo(startPage); return; }
    ed = found;
    loaded = new Set();
    if (book) { try { book.destroy(); } catch (e) {} }

    const el = document.createElement("div");
    host.innerHTML = "";
    host.appendChild(el);
    el.innerHTML = Array.from({ length: ed.pages }, (_, k) =>
      `<div class="page"><img data-src="${pageSrc(ed, k + 1)}" alt="Página ${k + 1}" draggable="false"></div>`).join("");

    const start = Math.min(Math.max(1, startPage), ed.pages) - 1;
    book = new St.PageFlip(el, {
      width: 612, height: 859,
      size: "stretch", minWidth: 260, maxWidth: 1000, minHeight: 360, maxHeight: 1400,
      showCover: true, usePortrait: true, autoSize: true,
      drawShadow: true, maxShadowOpacity: 0.6, flippingTime: 900,
      mobileScrollSupport: false, startPage: start,
    });
    loadAround(start);
    book.loadFromHTML(el.querySelectorAll(".page"));

    book.on("flip", (e) => { loadAround(e.data); updateClosed(); updateUI(); $("hint").classList.add("gone"); });
    book.on("changeOrientation", () => { updateClosed(); updateUI(); });
    book.on("changeState", (e) => {
      if (e.data === "flipping" || e.data === "user_fold") { touched = true; updateClosed(true); }
      else if (e.data === "read") updateClosed();
    });
    book.on("init", () => { updateClosed(); updateUI(); });

    $("reader-title").textContent = `SHIZEN ${ed.title}`;
    scrubber.max = ed.pages;
    thumbs.innerHTML = Array.from({ length: ed.pages }, (_, k) =>
      `<button data-page="${k + 1}"><img loading="lazy" src="${thumbSrc(ed, k + 1)}" alt="Página ${k + 1}"><span>${k + 1}</span></button>`).join("");
    document.querySelectorAll(".edition[data-id]").forEach((a) => a.classList.toggle("reading", a.dataset.id === ed.id));
  }

  // pula para uma página: perto = vira a folha; longe = vai direto
  function goTo(p) {
    const target = Math.min(Math.max(1, p), ed.pages) - 1;
    const now = book.getCurrentPageIndex();
    loadAround(target);
    if (Math.abs(target - now) <= 2) book.flip(target);
    else { book.turnToPage(target); updateClosed(); updateUI(); }
  }

  $("btn-prev").onclick = () => book.flipPrev();
  $("btn-next").onclick = () => book.flipNext();
  scrubber.onchange = () => goTo(+scrubber.value);
  thumbs.onclick = (e) => { const b = e.target.closest("button[data-page]"); if (b) goTo(+b.dataset.page); };
  $("btn-thumbs").onclick = () => {
    thumbs.hidden = !thumbs.hidden;
    $("btn-thumbs").classList.toggle("on", !thumbs.hidden);
    if (!thumbs.hidden) updateUI();
  };
  $("btn-full").onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else reader.requestFullscreen?.().catch(() => {});
  };
  document.addEventListener("fullscreenchange", () => setTimeout(() => book && book.update(), 60));

  // setas do teclado quando o leitor está na tela
  let readerVisible = false;
  new IntersectionObserver(([en]) => { readerVisible = en.intersectionRatio > 0.4; }, { threshold: [0, 0.4, 1] }).observe($("book-area"));
  document.addEventListener("keydown", (e) => {
    if (!book || (!readerVisible && !document.fullscreenElement) || e.target === scrubber) return;
    if (e.key === "ArrowRight") { e.preventDefault(); book.flipNext(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); book.flipPrev(); }
  });

  // links: #ler/vol-01/24 rola até o leitor e abre na página
  function fromHash(scroll) {
    const m = location.hash.match(/^#ler\/([^/]+)\/?(\d+)?/);
    if (m) {
      touched = true;
      loadEdition(m[1], +(m[2] || 1));
      if (scroll) $("book-area").scrollIntoView({ behavior: "smooth" });
      return true;
    }
    return false;
  }
  window.addEventListener("hashchange", () => fromHash(true));
  if (!fromHash(true) && latest) loadEdition(latest.id, 1);

  // "Ler a edição" abre a capa como uma revista de verdade
  const openLatest = (e) => {
    e.preventDefault();
    loadEdition(latest.id, 1);
    $("book-area").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => { if (book.getCurrentPageIndex() === 0) book.flipNext(); }, 900);
  };
  $("hero-read").onclick = openLatest;
  $("hero-cover").onclick = openLatest;
})();
