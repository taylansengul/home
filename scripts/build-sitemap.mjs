#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDirectory, "..");
const baseUrl = "https://taylansengul.github.io/home/";

// Pages worth indexing. The four top-level pages carry the site itself; the
// entries under files/ and other/ are standalone course notes that people find
// through search directly. files/index.html is a stale copy of the old
// homepage and is deliberately left out.
const pages = [
  { file: "index.html", loc: "", priority: "1.0", alternates: { en: "", tr: "tr.html" } },
  { file: "tr.html", loc: "tr.html", priority: "0.9", alternates: { en: "", tr: "tr.html" } },
  {
    file: "publications.html",
    loc: "publications.html",
    priority: "0.8",
    alternates: { en: "publications.html", tr: "yayinlar.html" },
  },
  {
    file: "yayinlar.html",
    loc: "yayinlar.html",
    priority: "0.8",
    alternates: { en: "publications.html", tr: "yayinlar.html" },
  },
  { file: "other/lmustat2/index.html", loc: "other/lmustat2/", priority: "0.5" },
  { file: "files/bilim_tarihi_2025_I.html", loc: "files/bilim_tarihi_2025_I.html", priority: "0.5" },
  { file: "files/guz_2025_bilim_tarihi_sunum.html", loc: "files/guz_2025_bilim_tarihi_sunum.html", priority: "0.5" },
  { file: "files/bilim_tarihi_2023.html", loc: "files/bilim_tarihi_2023.html", priority: "0.4" },
  { file: "files/bilimtarihinotlari.html", loc: "files/bilimtarihinotlari.html", priority: "0.4" },
  { file: "files/numpy1.html", loc: "files/numpy1.html", priority: "0.3" },
  { file: "files/numpy2.html", loc: "files/numpy2.html", priority: "0.3" },
];

// Last commit that touched the file, falling back to the filesystem for
// anything not yet committed.
function lastModified(file) {
  try {
    const stdout = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], {
      cwd: siteRoot,
      encoding: "utf8",
    }).trim();
    if (stdout) {
      return stdout;
    }
  } catch {
    // git is unavailable or this is not a checkout; fall through.
  }
  return fs.statSync(path.join(siteRoot, file)).mtime.toISOString().slice(0, 10);
}

function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderUrl(page) {
  const lines = [
    "  <url>",
    `    <loc>${escapeXml(baseUrl + page.loc)}</loc>`,
    `    <lastmod>${lastModified(page.file)}</lastmod>`,
    `    <priority>${page.priority}</priority>`,
  ];

  if (page.alternates) {
    for (const [language, target] of Object.entries(page.alternates)) {
      lines.push(
        `    <xhtml:link rel="alternate" hreflang="${language}" href="${escapeXml(baseUrl + target)}"/>`,
      );
    }
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(baseUrl + page.alternates.en)}"/>`,
    );
  }

  lines.push("  </url>");
  return lines.join("\n");
}

const missing = pages.filter((page) => !fs.existsSync(path.join(siteRoot, page.file)));
if (missing.length > 0) {
  throw new Error(`Listed but missing: ${missing.map((page) => page.file).join(", ")}`);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${pages.map(renderUrl).join("\n")}
</urlset>
`;

// GitHub Pages serves this repository as a project page, so crawlers only read
// robots.txt from the domain root, which belongs to a different repository.
// This file is therefore advisory; the stale files/index.html is kept out of
// the index by a noindex meta tag in the file itself, not by the rule below.
const robots = `User-agent: *
Allow: /
Disallow: /files/index.html

Sitemap: ${baseUrl}sitemap.xml
`;

fs.writeFileSync(path.join(siteRoot, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(siteRoot, "robots.txt"), robots);

console.log(`Generated sitemap.xml with ${pages.length} URLs, and robots.txt.`);
