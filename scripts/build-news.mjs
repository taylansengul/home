#!/usr/bin/env node

// News lives in news.json, one entry per item, newest first after sorting.
// Rule: the homepage shows every entry from the last HOME_MONTHS months, and
// never fewer than HOME_COUNT entries; everything else moves to the archive
// page (news.html / haberler.html), linked from the bottom of the homepage
// section. The cut is taken on the day the script runs, so rerun it now and
// then even without new entries. Edit news.json, then run this script.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOME_COUNT = 5;
const HOME_MONTHS = 6;

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(siteRoot, file), "utf8");
const write = (file, text) => fs.writeFileSync(path.join(siteRoot, file), text);

const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
};

const LANG = {
  en: {
    home: "index.html",
    archive: "news.html",
    other: "haberler.html",
    otherLabel: "Türkçe",
    otherLang: "tr",
    older: "Older news",
    title: "News",
    homeLabel: "Home",
    publications: "publications.html",
    publicationsLabel: "Publications",
    teaching: "teaching.html",
    teachingLabel: "Teaching",
    nav: "Primary navigation",
    skip: "Skip to content",
    location: "Istanbul, Türkiye",
  },
  tr: {
    home: "tr.html",
    archive: "haberler.html",
    other: "news.html",
    otherLabel: "English",
    otherLang: "en",
    older: "Eski haberler",
    title: "Haberler",
    homeLabel: "Ana sayfa",
    publications: "yayinlar.html",
    publicationsLabel: "Yayınlar",
    teaching: "dersler.html",
    teachingLabel: "Dersler",
    nav: "Ana menü",
    skip: "İçeriğe geç",
    location: "İstanbul, Türkiye",
  },
};

function formatDate(iso, lang) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[lang][m - 1]} ${y}`;
}

function list(entries, lang, indent) {
  const items = entries.map(
    (e) => `${indent}  <li><time datetime="${e.date}">${formatDate(e.date, lang)}</time> · ${e[lang]}</li>`,
  );
  return [`${indent}<ul class="research-lines">`, ...items, `${indent}</ul>`].join("\n");
}

function archivePage(entries, lang) {
  const s = LANG[lang];
  const url = `https://taylansengul.github.io/home/${s.archive}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${s.older} · Taylan Şengül">
  <meta name="google-site-verification" content="bcMfvzL1d2pfMhWTkG37EBtRo-kM076lqfGrwLfaAos">
  <title>${s.older} | Taylan Şengül</title>
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="en" href="https://taylansengul.github.io/home/news.html">
  <link rel="alternate" hreflang="tr" href="https://taylansengul.github.io/home/haberler.html">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&amp;family=DM+Mono:wght@400;500&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-Z5RM2NXW48"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', 'G-Z5RM2NXW48');
  </script>
</head>
<body id="top">
  <a class="skip-link" href="#main-content">${s.skip}</a>
  <nav aria-label="${s.nav}">
    <a class="nav-name" href="${s.home}">Taylan Şengül</a>
    <ul class="nav-links">
      <li><a href="${s.home}">${s.homeLabel}</a></li>
      <li><a href="${s.publications}">${s.publicationsLabel}</a></li>
      <li><a href="${s.teaching}">${s.teachingLabel}</a></li>
      <li><a href="files/CV.pdf">CV</a></li>
      <li><a class="language-link" href="${s.other}" hreflang="${s.otherLang}">${s.otherLabel}</a></li>
    </ul>
  </nav>
  <main class="container" id="main-content">
    <header class="page-header">
      <p class="eyebrow">Taylan Şengül</p>
      <h1>${s.older}</h1>
    </header>
    <section aria-label="${s.older}">
${list(entries, lang, "      ")}
    </section>
    <footer>
      <p><a href="mailto:taylan.sengul@marmara.edu.tr">taylan.sengul@marmara.edu.tr</a> · ${s.location}</p>
    </footer>
  </main>
</body>
</html>
`;
}

const news = JSON.parse(read("news.json")).sort((a, b) => b.date.localeCompare(a.date));
const cutoff = new Date();
cutoff.setMonth(cutoff.getMonth() - HOME_MONTHS);
const cutoffIso = cutoff.toISOString().slice(0, 10);
const inWindow = news.filter((e) => e.date >= cutoffIso).length;
const homeSize = Math.max(HOME_COUNT, inWindow);
const recent = news.slice(0, homeSize);
const older = news.slice(homeSize);

const START = "<!-- news:start (scripts/build-news.mjs) -->";
const END = "<!-- news:end -->";

for (const lang of ["en", "tr"]) {
  const s = LANG[lang];
  const page = read(s.home);
  const i = page.indexOf(START);
  const j = page.indexOf(END);
  if (i < 0 || j < i) throw new Error(`news markers not found in ${s.home}`);
  let block = list(recent, lang, "      ");
  if (older.length > 0) block += `\n      <p class="section-more"><a href="${s.archive}">${s.older}</a></p>`;
  write(s.home, `${page.slice(0, i + START.length)}\n${block}\n      ${page.slice(j)}`);

  if (older.length > 0) write(s.archive, archivePage(older, lang));
  else fs.rmSync(path.join(siteRoot, s.archive), { force: true });
}

console.log(`News: ${recent.length} on the homepage, ${older.length} in the archive.`);
