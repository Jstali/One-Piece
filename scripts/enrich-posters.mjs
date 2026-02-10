import fs from "node:fs/promises";
import path from "node:path";

const POSTERS_PATH = path.resolve("src/data/posters.json");
const DETAILS_PATH = path.resolve("src/data/poster-details.json");
const API_URL = "https://onepiece.fandom.com/api.php";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (params) => {
  const url = `${API_URL}?${new URLSearchParams(params).toString()}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "OnePiecePosterEnricher/1.1 (personal project)",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed request: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

const normalizeLabel = (value) =>
  value
    .toLowerCase()
    .replace(/&[^;]+;/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const cleanHtml = (value) => {
  if (!value) return null;
  let text = String(value);
  text = text
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<\/li>/gi, ", ")
    .replace(/<li>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/(,\s*)+/g, ", ")
    .trim();
  return text || null;
};

const mergeField = (target, key, value) => {
  if (!value) return;
  if (!target[key]) {
    target[key] = value;
    return;
  }
  if (target[key] === value) return;
  const merged = `${target[key]}, ${value}`;
  const parts = [...new Set(merged.split(/,\s*/))].filter(Boolean);
  target[key] = parts.join(", ");
};

const getFileUsage = async (fileTitle) => {
  const title = fileTitle.startsWith("File:") ? fileTitle : `File:${fileTitle}`;
  const data = await fetchJson({
    action: "query",
    format: "json",
    formatversion: "2",
    titles: title,
    prop: "fileusage",
    fuprop: "title|pageid|ns",
    fulimit: "50",
  });

  return data?.query?.pages?.[0]?.fileusage ?? [];
};

const pickUsageTitle = (usages) => {
  if (!usages.length) return null;
  const main = usages.find((usage) => usage.ns === 0);
  return (main ?? usages[0]).title ?? null;
};

const getInfoboxes = async (title) => {
  const data = await fetchJson({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "pageprops",
    titles: title,
  });

  const page = data?.query?.pages?.[0];
  const raw = page?.pageprops?.infoboxes;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const extractFields = (infoboxes) => {
  const fields = {};
  if (!Array.isArray(infoboxes)) return fields;

  for (const infobox of infoboxes) {
    for (const entry of infobox?.data ?? []) {
      if (entry.type === "title") {
        const title = cleanHtml(entry?.data?.value);
        mergeField(fields, "matchedName", title);
        continue;
      }
      if (entry.type !== "data") continue;
      const labelRaw = entry?.data?.label;
      const value = cleanHtml(entry?.data?.value);
      if (!labelRaw || !value) continue;

      const label = normalizeLabel(labelRaw);
      if (label.includes("crew")) mergeField(fields, "crew", value);
      if (label.includes("affiliation")) mergeField(fields, "affiliation", value);
      if (label.includes("origin") || label.includes("birthplace"))
        mergeField(fields, "origin", value);
      if (label.includes("occupation") || label.includes("job") || label.includes("role"))
        mergeField(fields, "role", value);
      if (label.includes("bounty") || label.includes("reward"))
        mergeField(fields, "bounty", value);
      if (label.includes("status")) mergeField(fields, "status", value);
      if (label.includes("age")) mergeField(fields, "age", value);
      if (label.includes("birthday")) mergeField(fields, "birthday", value);
      if (label.includes("height") || label.includes("size"))
        mergeField(fields, "size", value);
      if (label.includes("devil fruit") || label === "fruit")
        mergeField(fields, "fruit", value);
      if (label.includes("first appearance") || label.includes("debut"))
        mergeField(fields, "firstSeen", value);
    }
  }

  return fields;
};

const main = async () => {
  const postersRaw = await fs.readFile(POSTERS_PATH, "utf8");
  const posters = JSON.parse(postersRaw);
  const details = {};

  let matched = 0;
  let withInfobox = 0;

  for (const poster of posters) {
    const usages = await getFileUsage(poster.title);
    const usageTitle = pickUsageTitle(usages);

    if (!usageTitle) {
      await sleep(40);
      continue;
    }

    const infoboxes = await getInfoboxes(usageTitle);
    if (!infoboxes) {
      await sleep(40);
      continue;
    }

    withInfobox += 1;
    const fields = extractFields(infoboxes);
    if (Object.keys(fields).length) matched += 1;

    details[poster.id] = {
      ...fields,
      sourcePage: usageTitle,
    };

    await sleep(60);
  }

  await fs.writeFile(DETAILS_PATH, JSON.stringify(details, null, 2));

  console.log(`Posters: ${posters.length}`);
  console.log(`Posters with infobox: ${withInfobox}`);
  console.log(`Posters with extracted fields: ${matched}`);
  console.log(`Details written: ${DETAILS_PATH}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
