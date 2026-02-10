import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const OUT_DIR = path.resolve("public/posters");
const DATA_PATH = path.resolve("src/data/posters.json");

const hashFile = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const main = async () => {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const posters = JSON.parse(raw);
  const seen = new Map();
  const deduped = [];

  let duplicates = 0;
  let missing = 0;
  let removedFiles = 0;

  for (const poster of posters) {
    const filePath = path.join(OUT_DIR, poster.file);
    if (!(await fileExists(filePath))) {
      missing += 1;
      continue;
    }

    const hash = await hashFile(filePath);
    if (seen.has(hash)) {
      duplicates += 1;
      try {
        await fs.rm(filePath);
        removedFiles += 1;
      } catch {
        // If deletion fails, keep the file but still drop the duplicate entry.
      }
      continue;
    }

    seen.set(hash, poster);
    deduped.push(poster);
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(deduped, null, 2));

  console.log(
    `Posters kept: ${deduped.length} | Duplicates removed: ${duplicates} | Missing files skipped: ${missing} | Files deleted: ${removedFiles}`
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
