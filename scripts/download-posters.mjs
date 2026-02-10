import fs from "node:fs/promises";
import path from "node:path";

const API = "https://onepiece.fandom.com/api.php";
const OUT_DIR = path.resolve("public/posters");
const DATA_PATH = path.resolve("src/data/posters.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (params) => {
  const url = `${API}?${new URLSearchParams(params).toString()}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "OnePiecePosterDownloader/1.0 (personal project)",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed request: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

const sanitize = (value) =>
  value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const toDisplayName = (title) => {
  const base = title.replace(/\.[^.]+$/, "");
  return base.replace(/_/g, " ").replace(/\s+/g, " ").trim();
};

const getPosters = async () => {
  const posters = [];
  let gcmcontinue = undefined;

  do {
    const params = {
      action: "query",
      format: "json",
      generator: "categorymembers",
      gcmtitle: "Category:Bounty_Images",
      gcmnamespace: "6",
      gcmlimit: "500",
      prop: "imageinfo",
      iiprop: "url|size|mime",
    };
    if (gcmcontinue) {
      params.gcmcontinue = gcmcontinue;
    }

    const data = await fetchJson(params);
    const pages = Object.values(data?.query?.pages ?? {});

    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info?.url) continue;

      const originalTitle = page.title.replace(/^File:/, "");
      const extension = path.extname(originalTitle) || path.extname(new URL(info.url).pathname);
      const safeBase = sanitize(originalTitle.replace(/\.[^.]+$/, "")) || `poster_${page.pageid}`;

      posters.push({
        id: page.pageid,
        title: originalTitle,
        name: toDisplayName(originalTitle),
        fileBase: safeBase,
        extension: extension || ".jpg",
        imageUrl: info.url,
        width: info.width,
        height: info.height,
      });
    }

    gcmcontinue = data?.continue?.gcmcontinue;
  } while (gcmcontinue);

  return posters;
};

const main = async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const rawPosters = await getPosters();
  const seen = new Map();

  const posters = rawPosters.map((poster) => {
    const key = `${poster.fileBase}${poster.extension}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    const suffix = count === 0 ? "" : `_${poster.id}`;
    return {
      id: poster.id,
      title: poster.title,
      name: poster.name,
      file: `${poster.fileBase}${suffix}${poster.extension}`,
      imageUrl: poster.imageUrl,
      width: poster.width,
      height: poster.height,
    };
  });

  posters.sort((a, b) => a.name.localeCompare(b.name));

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const poster of posters) {
    const destination = path.join(OUT_DIR, poster.file);
    if (await fileExists(destination)) {
      skipped += 1;
      continue;
    }

    try {
      const response = await fetch(poster.imageUrl, {
        headers: {
          "User-Agent": "OnePiecePosterDownloader/1.0 (personal project)",
        },
      });
      if (!response.ok) {
        failed += 1;
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(destination, buffer);
      downloaded += 1;
    } catch {
      failed += 1;
    }

    await sleep(60);
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(posters, null, 2));

  console.log(
    `Posters: ${posters.length} | Downloaded: ${downloaded} | Skipped: ${skipped} | Failed: ${failed}`
  );
  console.log(`Images stored in ${OUT_DIR}`);
  console.log(`Data written to ${DATA_PATH}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
