import { useEffect, useMemo, useState } from "react";
import posters from "./data/posters.json";
import details from "./data/poster-details.json";

const normalize = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const handlePointerMove = (event) => {
  const card = event.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const px = x / rect.width;
  const py = y / rect.height;
  const rx = (0.5 - py) * 18;
  const ry = (px - 0.5) * 18;
  card.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
  card.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
  card.style.setProperty("--mx", `${(px * 100).toFixed(2)}%`);
  card.style.setProperty("--my", `${(py * 100).toFixed(2)}%`);
};

const handlePointerLeave = (event) => {
  const card = event.currentTarget;
  card.style.setProperty("--rx", "0deg");
  card.style.setProperty("--ry", "0deg");
  card.style.setProperty("--mx", "50%");
  card.style.setProperty("--my", "50%");
};

const PosterCard = ({ poster, index, onSelect }) => (
  <article
    className="card"
    style={{ "--float": `${((index % 9) - 4) * 0.4}deg` }}
    onPointerMove={handlePointerMove}
    onPointerLeave={handlePointerLeave}
    onClick={() => onSelect(poster)}
  >
    <div className="poster-frame">
      <img
        src={`/posters/${poster.file}`}
        alt={poster.name}
        loading="lazy"
        decoding="async"
      />
    </div>
    <div className="card-meta">
      <h3>{poster.name}</h3>
      <p>Wanted Poster</p>
    </div>
  </article>
);

const resolveDetails = (poster) => {
  if (!poster) return null;
  const lookup = details?.[poster.name] ?? details?.[poster.id] ?? {};
  return {
    name: poster.name,
    posterFile: poster.file,
    crew: lookup.crew ?? poster.crew ?? "Unknown",
    origin: lookup.origin ?? poster.origin ?? "Unknown",
    affiliation: lookup.affiliation ?? poster.affiliation ?? "Unknown",
    role: lookup.role ?? poster.role ?? "Unknown",
    bounty: lookup.bounty ?? poster.bounty ?? "Unknown",
    status: lookup.status ?? poster.status ?? "Unknown",
    age: lookup.age ?? poster.age ?? "Unknown",
    birthday: lookup.birthday ?? poster.birthday ?? "Unknown",
    size: lookup.size ?? poster.size ?? "Unknown",
    fruit: lookup.fruit ?? poster.fruit ?? "Unknown",
    firstSeen: lookup.firstSeen ?? poster.firstSeen ?? "Unknown",
    matchedName: lookup.matchedName ?? poster.matchedName ?? null,
    sourcePage: lookup.sourcePage ?? poster.sourcePage ?? null,
    note: lookup.note ?? poster.note ?? null,
  };
};

export default function App() {
  const [query, setQuery] = useState("");
  const [activePoster, setActivePoster] = useState(null);

  const filtered = useMemo(() => {
    if (!posters.length) return [];
    if (!query.trim()) return posters;
    const q = normalize(query);
    return posters.filter((poster) => normalize(poster.name).includes(q));
  }, [query]);

  useEffect(() => {
    if (!activePoster) return;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setActivePoster(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activePoster]);

  const info = resolveDetails(activePoster);
  const detailRows = info
    ? [
        { label: "Matched Name", value: info.matchedName },
        { label: "Crew", value: info.crew },
        { label: "Origin", value: info.origin },
        { label: "Affiliation", value: info.affiliation },
        { label: "Role", value: info.role },
        { label: "Bounty", value: info.bounty },
        { label: "Status", value: info.status },
        { label: "Age", value: info.age },
        { label: "Birthday", value: info.birthday },
        { label: "Height", value: info.size },
        { label: "Devil Fruit", value: info.fruit },
        { label: "First Seen", value: info.firstSeen },
        { label: "Source Page", value: info.sourcePage },
      ].filter(
        (item) =>
          item.value &&
          item.value !== "Unknown" &&
          item.value !== "N/A" &&
          item.value !== "-"
      )
    : [];

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-text">
          <span className="eyebrow">Grand Line Intelligence</span>
          <h1>Wanted Poster Compendium</h1>
          <p>
            A complete visual archive of every known One Piece bounty poster.
            Flip through the collection, tilt for depth, and track down your
            favorite pirates in an immersive 3D gallery.
          </p>
        </div>
        <div className="hero-card">
          <div className="hero-card-inner">
            <span className="hero-label">Total Posters</span>
            <strong>{posters.length || 0}</strong>
            <span className="hero-sub">All downloaded locally</span>
          </div>
        </div>
      </header>

      <section className="controls">
        <label className="search">
          <span>Search</span>
          <input
            type="text"
            placeholder="Search by name"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="pill">{filtered.length} posters shown</div>
        <div className="pill">3D tilt enabled</div>
      </section>

      <section className="grid">
        {posters.length === 0 ? (
          <div className="empty">
            <h2>Posters not downloaded yet</h2>
            <p>Run `npm run download:posters` to fetch them locally.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <h2>No matches found</h2>
            <p>Try a different name or clear the search.</p>
          </div>
        ) : (
          filtered.map((poster, index) => (
            <PosterCard
              key={poster.id}
              poster={poster}
              index={index}
              onSelect={setActivePoster}
            />
          ))
        )}
      </section>

      <footer className="footer">
        Built as a single-page React notebook gallery with locally stored
        posters, layered textures, and interactive 3D animation.
      </footer>

      {activePoster && info && (
        <div className="modal" onClick={() => setActivePoster(null)}>
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setActivePoster(null)}
              aria-label="Close"
            >
              Close
            </button>
            <div className="modal-grid">
              <div className="modal-poster">
                <img
                  src={`/posters/${activePoster.file}`}
                  alt={activePoster.name}
                />
              </div>
              <div className="modal-info">
                <span className="modal-eyebrow">Poster Detail</span>
                <h2>{info.name}</h2>
                {detailRows.length ? (
                  <dl>
                    {detailRows.map((item) => (
                      <div key={item.label}>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="modal-empty">
                    No extra details yet. Run `npm run enrich:posters` to fill
                    in character data.
                  </p>
                )}
                {info.note && <p className="modal-note">{info.note}</p>}
                <p className="modal-file">Local file: {info.posterFile}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
