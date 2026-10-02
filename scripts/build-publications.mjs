#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDirectory, "..");
const refreshDois = process.argv.includes("--refresh-dois");
const positionalArguments = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
const defaultCvPath = path.resolve(siteRoot, "../work/cv/CV.tex");
const cvPath = path.resolve(positionalArguments[0] || process.env.CV_TEX_PATH || defaultCvPath);
const dataPath = path.join(siteRoot, "publications.json");

if (!fs.existsSync(cvPath)) {
  throw new Error(`CV source not found: ${cvPath}\nUsage: node scripts/build-publications.mjs [CV.tex] [--refresh-dois]`);
}

function texToText(value) {
  return value
    .replace(/\\&/g, "&")
    .replace(/---/g, "-")
    .replace(/--/g, "-")
    .replace(/~/g, " ")
    .replace(/\\,/g, " ")
    .trim();
}

function normalizeTitle(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function parseItemSection(source, name, { required = true } = {}) {
  const section = source.match(new RegExp(`\\\\section\\*\\{${name}\\}([\\s\\S]*?)\\\\end\\{etaremune\\}`));
  if (!section) {
    if (required) throw new Error(`The ${name} section was not found in the CV source.`);
    return [];
  }

  const itemLines = section[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("\\item "));

  const publications = itemLines.map((line, index) => {
    const item = line.replace(/^\\item\s+/, "");
    const match = item.match(/^(.*?)\s+``(.*?)''\s+\\emph\{(.*?)\},\s+(.*?),\s+(\d{4})\.$/);
    if (!match) {
      throw new Error(`Could not parse ${name} item ${index + 1}: ${line}`);
    }

    return {
      number: itemLines.length - index,
      authors: texToText(match[1].replace(/\.$/, "")),
      title: texToText(match[2]),
      journal: texToText(match[3]),
      details: texToText(match[4]),
      year: Number(match[5]),
      doi: null,
    };
  });

  return publications;
}

function loadExistingDois() {
  if (!fs.existsSync(dataPath)) return new Map();
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  return new Map(
    data.publications
      .filter((publication) => publication.doi)
      .map((publication) => [normalizeTitle(publication.title), publication.doi]),
  );
}

function crossrefAuthorMatches(item) {
  return (item.author || []).some((author) => {
    const given = normalizeTitle(author.given || "");
    const family = normalizeTitle(author.family || "");
    return given.includes("taylan") && family === "sengul";
  });
}

async function queryCrossref(publication) {
  const endpoint = new URL("https://api.crossref.org/works");
  endpoint.searchParams.set("query.title", publication.title);
  endpoint.searchParams.set("query.author", "Taylan Sengul");
  endpoint.searchParams.set("rows", "8");
  endpoint.searchParams.set("select", "DOI,title,published,author");

  let response;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await fetch(endpoint, {
      headers: {
        "User-Agent": "taylansengul-homepage-publication-builder/1.0 (mailto:taylan.sengul@marmara.edu.tr)",
      },
    });
    if (response.status !== 429 || attempt === 3) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  if (!response.ok) throw new Error(`Crossref returned HTTP ${response.status}`);

  const payload = await response.json();
  const expectedTitle = normalizeTitle(publication.title);
  const match = payload.message.items.find((item) => {
    const titleMatches = normalizeTitle(item.title?.[0] || "") === expectedTitle;
    const year = item.published?.["date-parts"]?.[0]?.[0];
    const yearMatches = !year || Math.abs(Number(year) - publication.year) <= 1;
    const isJournalVersion = !item.DOI?.toLowerCase().startsWith("10.22541/");
    return titleMatches && yearMatches && crossrefAuthorMatches(item) && isJournalVersion;
  });

  return match?.DOI?.toLowerCase() || null;
}

async function addVerifiedDois(publications) {
  const queue = publications.filter((publication) => !publication.doi);
  const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
    while (queue.length > 0) {
      const publication = queue.shift();
      try {
        publication.doi = await queryCrossref(publication);
        const status = publication.doi ? publication.doi : "no exact match";
        console.log(`${publication.number}. ${status}`);
      } catch (error) {
        console.warn(`${publication.number}. Crossref lookup failed: ${error.message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  });
  await Promise.all(workers);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function publicationMarkup(publication) {
  const title = escapeHtml(publication.title);
  const titleMarkup = publication.doi
    ? `<a href="https://doi.org/${encodeURI(publication.doi)}">${title}</a>`
    : title;
  const doiMarkup = publication.doi
    ? `<a class="doi-link" href="https://doi.org/${encodeURI(publication.doi)}" aria-label="DOI for ${title}">DOI</a>`
    : "";

  return `        <li id="publication-${publication.number}">
          <span class="publication-number" aria-label="Publication ${publication.number}">${publication.number}</span>
          <p class="publication-title">${titleMarkup}<span class="publication-meta">${escapeHtml(publication.authors)} · <em>${escapeHtml(publication.journal)}</em>, ${escapeHtml(publication.details)} (${publication.year}) ${doiMarkup}</span></p>
        </li>`;
}

function preprintMarkup(preprint) {
  const title = escapeHtml(preprint.title);
  const arxivUrl = `https://arxiv.org/abs/${encodeURI(preprint.details)}`;
  return `        <li id="preprint-${preprint.number}">
          <span class="publication-number" aria-label="Preprint ${preprint.number}">P${preprint.number}</span>
          <p class="publication-title"><a href="${arxivUrl}">${title}</a><span class="publication-meta">${escapeHtml(preprint.authors)} · <em>${escapeHtml(preprint.journal)}</em>, <a class="doi-link" href="${arxivUrl}" aria-label="arXiv for ${title}">arXiv:${escapeHtml(preprint.details)}</a> (${preprint.year})</span></p>
        </li>`;
}

function renderPage(publications, preprints, language) {
  const isTurkish = language === "tr";
  const strings = isTurkish
    ? {
        lang: "tr",
        title: "Yayınlar | Taylan Şengül",
        description: "Taylan Şengül'ün uygulamalı matematik, dinamik sistemler ve akışkanlar dinamiği alanındaki yayınları.",
        canonical: "https://taylansengul.github.io/home/yayinlar.html",
        home: "Ana sayfa",
        teaching: "Dersler",
        cv: "CV",
        languageLabel: "English",
        languageHref: "publications.html",
        heading: "Yayınlar",
        preprints: "Önbaskılar",
        articles: "Dergi makaleleri",
        preprintsIntro: "Hakem değerlendirmesinde olan, arXiv'de yayımlanmış çalışmalar.",
        scholar: "Google Scholar profili",
        footerLocation: "İstanbul, Türkiye",
        skip: "İçeriğe geç",
        research: "Araştırma",
        researchLines: `        <li><strong>Kapalı formda geçiş sayıları</strong> · 1B tepkime–yayınım denklemlerinde geçiş katsayısının açık formülü.</li>\n        <li><strong>Simetri ve desen seçimi</strong> · dejenere geçişlerde sistemin hangi deseni seçtiği; şu an O(2) simetrisi altında Hopf çatallanması.</li>\n        <li><strong>Akışkanlar</strong> · aynı makinenin termohalin dolaşım, zonal okyanus akışları ve Poiseuille akışına uygulanması.</li>`,
      }
    : {
        lang: "en",
        title: "Publications | Taylan Şengül",
        description: "Publications by Taylan Şengül in applied mathematics, dynamical systems and fluid dynamics.",
        canonical: "https://taylansengul.github.io/home/publications.html",
        home: "Home",
        teaching: "Teaching",
        cv: "CV",
        languageLabel: "Türkçe",
        languageHref: "yayinlar.html",
        heading: "Publications",
        preprints: "Preprints",
        articles: "Journal articles",
        preprintsIntro: "Work under review, available on arXiv.",
        scholar: "Google Scholar profile",
        footerLocation: "Istanbul, Türkiye",
        skip: "Skip to content",
        research: "Research",
        researchLines: `        <li><strong>Transition numbers in closed form</strong> · explicit formulas for the transition coefficient of 1D reaction–diffusion equations.</li>\n        <li><strong>Symmetry and pattern selection</strong> · what degenerate transitions select; currently Hopf bifurcation under O(2) symmetry.</li>\n        <li><strong>Fluids</strong> · the same machinery applied to the thermohaline circulation, zonal ocean flows and Poiseuille flow.</li>`,
      };

  return `<!doctype html>
<html lang="${strings.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(strings.description)}">
  <meta name="google-site-verification" content="bcMfvzL1d2pfMhWTkG37EBtRo-kM076lqfGrwLfaAos">
  <title>${escapeHtml(strings.title)}</title>
  <link rel="canonical" href="${strings.canonical}">
  <link rel="alternate" hreflang="en" href="https://taylansengul.github.io/home/publications.html">
  <link rel="alternate" hreflang="tr" href="https://taylansengul.github.io/home/yayinlar.html">
  <link rel="alternate" hreflang="x-default" href="https://taylansengul.github.io/home/publications.html">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(strings.title)}">
  <meta property="og:description" content="${escapeHtml(strings.description)}">
  <meta property="og:url" content="${strings.canonical}">
  <meta name="twitter:card" content="summary">
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
  <a class="skip-link" href="#main-content">${strings.skip}</a>
  <nav aria-label="${isTurkish ? "Ana menü" : "Primary navigation"}">
    <ul class="nav-links">
      <li><a href="${isTurkish ? "tr.html" : "index.html"}">${strings.home}</a></li>
      <li><a href="${isTurkish ? "dersler.html" : "teaching.html"}">${strings.teaching}</a></li>
      <li><a class="language-link" href="${strings.languageHref}" hreflang="${isTurkish ? "en" : "tr"}">${strings.languageLabel}</a></li>
    </ul>
  </nav>
  <main class="container publications-page" id="main-content">
    <header class="page-header">
      <p class="eyebrow">Taylan Şengül</p>
      <h1>${strings.heading}</h1>
      <p class="page-meta"><a href="https://scholar.google.com/citations?user=udE47_gAAAAJ&amp;hl=${isTurkish ? "tr" : "en"}">${strings.scholar}</a></p>
    </header>
    <section class="research" aria-labelledby="research-heading">
      <h2 id="research-heading">${strings.research}</h2>
      <ul class="research-lines">
${strings.researchLines}
      </ul>
    </section>
${preprints.length > 0 ? `    <section class="preprints" aria-labelledby="preprints-heading">
      <h2 id="preprints-heading">${strings.preprints}</h2>
      <p class="section-intro">${strings.preprintsIntro}</p>
      <ol class="publication-list full-publication-list" reversed start="${preprints.length}">
${preprints.map(preprintMarkup).join("\n")}
      </ol>
    </section>
    <h2 id="articles-heading">${strings.articles}</h2>
` : ""}    <ol class="publication-list full-publication-list" reversed start="${publications.length}">
${publications.map(publicationMarkup).join("\n")}
    </ol>
    <footer>
      <p><a href="mailto:taylan.sengul@marmara.edu.tr">taylan.sengul@marmara.edu.tr</a> · ${strings.footerLocation}</p>
    </footer>
  </main>
  <script src="motif.js" defer></script>
</body>
</html>
`;
}

const cvSource = fs.readFileSync(cvPath, "utf8");
const publications = parseItemSection(cvSource, "Publications");
const preprints = parseItemSection(cvSource, "Preprints", { required: false });
const existingDois = loadExistingDois();
for (const publication of publications) {
  publication.doi = existingDois.get(normalizeTitle(publication.title)) || null;
}

if (refreshDois) {
  await addVerifiedDois(publications);
}

fs.writeFileSync(
  dataPath,
  `${JSON.stringify({ source: path.basename(cvPath), publications, preprints }, null, 2)}\n`,
);
fs.writeFileSync(path.join(siteRoot, "publications.html"), renderPage(publications, preprints, "en"));
fs.writeFileSync(path.join(siteRoot, "yayinlar.html"), renderPage(publications, preprints, "tr"));

const doiCount = publications.filter((publication) => publication.doi).length;
console.log(`Generated ${publications.length} publications (${doiCount} with verified DOI links) and ${preprints.length} preprints.`);
