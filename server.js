require("dotenv").config();

const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, "data");
const MEDIA_DIR = path.join(DATA_DIR, "media");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "otaku-arcade.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS anime (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    synopsis TEXT NOT NULL DEFAULT '',
    genres TEXT NOT NULL DEFAULT '',
    year INTEGER,
    status TEXT NOT NULL DEFAULT 'Ongoing',
    rating TEXT NOT NULL DEFAULT 'NR',
    poster_url TEXT NOT NULL DEFAULT '',
    banner_url TEXT NOT NULL DEFAULT '',
    featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anime_id INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
    episode_number INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    video_url TEXT NOT NULL DEFAULT '',
    subtitle_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(anime_id, episode_number)
  );
`);

const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "change-this-password";
const existingAdmin = db.prepare("SELECT id FROM admins WHERE username = ?").get(adminUsername);
if (!existingAdmin) {
  db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run(
    adminUsername,
    bcrypt.hashSync(adminPassword, 12)
  );
}

const count = db.prepare("SELECT COUNT(*) AS n FROM anime").get().n;
if (count === 0) {
  const insertAnime = db.prepare(`
    INSERT INTO anime (title, synopsis, genres, year, status, rating, featured)
    VALUES (@title, @synopsis, @genres, @year, @status, @rating, @featured)
  `);
  const insertEpisode = db.prepare(`
    INSERT INTO episodes (anime_id, episode_number, title, video_url)
    VALUES (?, ?, ?, ?)
  `);
  const seed = [
    {
      title: "Moonlit Ronin",
      synopsis: "A wandering swordsman follows strange blue lights through a city where memories can be traded.",
      genres: "Action,Fantasy,Adventure", year: 2026, status: "Ongoing", rating: "8.7", featured: 1
    },
    {
      title: "Neon Tide Academy",
      synopsis: "Students at a coastal science academy discover a hidden world beneath the waves.",
      genres: "Sci-Fi,Drama,Adventure", year: 2025, status: "Ongoing", rating: "8.3", featured: 0
    },
    {
      title: "Paper Crane Planet",
      synopsis: "A quiet artist builds paper creatures that can briefly bring forgotten places to life.",
      genres: "Fantasy,Slice of Life", year: 2024, status: "Completed", rating: "8.9", featured: 0
    },
    {
      title: "Last Train to Aurora",
      synopsis: "Every night, a train arrives at a station that does not exist on any map.",
      genres: "Mystery,Supernatural,Drama", year: 2026, status: "Ongoing", rating: "8.1", featured: 0
    },
    {
      title: "Pixel Hearts Club",
      synopsis: "Four friends create an indie game and learn that teamwork is harder than boss battles.",
      genres: "Comedy,Romance,School", year: 2023, status: "Completed", rating: "7.9", featured: 0
    },
    {
      title: "The Jade Comet",
      synopsis: "A young navigator searches the sky for the comet said to grant one impossible wish.",
      genres: "Adventure,Fantasy", year: 2025, status: "Ongoing", rating: "8.5", featured: 0
    }
  ];
  const seedTransaction = db.transaction(() => {
    for (const item of seed) {
      const result = insertAnime.run(item);
      // Demo episode uses a public sample video. Replace it with a video you own or are licensed to stream.
      insertEpisode.run(result.lastInsertRowid, 1, "Pilot (sample player)", "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4");
    }
  });
  seedTransaction();
}

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "https:", "blob:"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "https:"],
      objectSrc: ["'none'"]
    }
  }
}));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(session({
  secret: process.env.SESSION_SECRET || "development-only-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});
app.use(express.static(path.join(__dirname, "public")));
app.use("/media", express.static(MEDIA_DIR, {
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=3600");
  }
}));

const allowedVideoExt = new Set([".mp4", ".webm", ".ogv", ".ogg", ".m4v"]);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "episode";
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  }
});
const uploadVideo = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB local development cap
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedVideoExt.has(ext)) return cb(new Error("Upload an MP4, WebM, OGV, OGG, or M4V video file."));
    cb(null, true);
  }
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) return next();
  return res.status(401).json({ error: "Please sign in as an administrator." });
}
function validHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch { return false; }
}
function normalizeAnime(row) {
  return {
    ...row,
    genres: row.genres ? row.genres.split(",").map(x => x.trim()).filter(Boolean) : []
  };
}

// Public API
app.get("/api/anime", (req, res) => {
  const q = String(req.query.q || "").trim();
  const genre = String(req.query.genre || "").trim();
  const featured = req.query.featured === "1";
  let sql = "SELECT * FROM anime WHERE 1=1";
  const params = [];
  if (q) {
    sql += " AND (title LIKE ? OR synopsis LIKE ? OR genres LIKE ?)";
    const term = `%${q}%`;
    params.push(term, term, term);
  }
  if (genre) {
    sql += " AND genres LIKE ?";
    params.push(`%${genre}%`);
  }
  if (featured) sql += " AND featured = 1";
  sql += " ORDER BY featured DESC, created_at DESC, title COLLATE NOCASE ASC";
  res.json(db.prepare(sql).all(...params).map(normalizeAnime));
});

app.get("/api/anime/:id", (req, res) => {
  const anime = db.prepare("SELECT * FROM anime WHERE id = ?").get(Number(req.params.id));
  if (!anime) return res.status(404).json({ error: "Anime not found." });
  const episodes = db.prepare("SELECT * FROM episodes WHERE anime_id = ? ORDER BY episode_number ASC").all(anime.id);
  res.json({ ...normalizeAnime(anime), episodes });
});

app.get("/api/episodes/:id", (req, res) => {
  const episode = db.prepare(`
    SELECT episodes.*, anime.title AS anime_title
    FROM episodes JOIN anime ON anime.id = episodes.anime_id
    WHERE episodes.id = ?
  `).get(Number(req.params.id));
  if (!episode) return res.status(404).json({ error: "Episode not found." });
  res.json(episode);
});

// Admin authentication
app.post("/api/admin/login", (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  req.session.adminId = admin.id;
  req.session.adminUsername = admin.username;
  res.json({ ok: true, username: admin.username });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/me", (req, res) => {
  if (!req.session.adminId) return res.status(401).json({ error: "Not signed in." });
  res.json({ username: req.session.adminUsername });
});

app.get("/api/admin/anime", requireAdmin, (req, res) => {
  res.json(db.prepare(`
    SELECT anime.*, COUNT(episodes.id) AS episode_count
    FROM anime LEFT JOIN episodes ON episodes.anime_id = anime.id
    GROUP BY anime.id ORDER BY anime.created_at DESC
  `).all().map(normalizeAnime));
});

app.post("/api/admin/anime", requireAdmin, (req, res) => {
  const body = req.body || {};
  const title = String(body.title || "").trim();
  if (!title) return res.status(400).json({ error: "Title is required." });
  if (!validHttpUrl(body.poster_url) || !validHttpUrl(body.banner_url)) {
    return res.status(400).json({ error: "Poster and banner must be valid HTTP(S) URLs." });
  }
  const info = {
    title,
    synopsis: String(body.synopsis || "").trim(),
    genres: String(body.genres || "").split(",").map(x => x.trim()).filter(Boolean).join(","),
    year: body.year ? Number(body.year) : null,
    status: ["Ongoing", "Completed", "Upcoming"].includes(body.status) ? body.status : "Ongoing",
    rating: String(body.rating || "NR").trim().slice(0, 10),
    poster_url: String(body.poster_url || "").trim(),
    banner_url: String(body.banner_url || "").trim(),
    featured: body.featured ? 1 : 0
  };
  const result = db.prepare(`
    INSERT INTO anime (title, synopsis, genres, year, status, rating, poster_url, banner_url, featured)
    VALUES (@title, @synopsis, @genres, @year, @status, @rating, @poster_url, @banner_url, @featured)
  `).run(info);
  res.status(201).json({ id: result.lastInsertRowid });
});

app.put("/api/admin/anime/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare("SELECT id FROM anime WHERE id = ?").get(id);
  if (!old) return res.status(404).json({ error: "Anime not found." });
  const body = req.body || {};
  const title = String(body.title || "").trim();
  if (!title) return res.status(400).json({ error: "Title is required." });
  if (!validHttpUrl(body.poster_url) || !validHttpUrl(body.banner_url)) {
    return res.status(400).json({ error: "Poster and banner must be valid HTTP(S) URLs." });
  }
  db.prepare(`
    UPDATE anime SET title=@title, synopsis=@synopsis, genres=@genres, year=@year,
    status=@status, rating=@rating, poster_url=@poster_url, banner_url=@banner_url, featured=@featured
    WHERE id=@id
  `).run({
    id, title, synopsis: String(body.synopsis || "").trim(),
    genres: String(body.genres || "").split(",").map(x => x.trim()).filter(Boolean).join(","),
    year: body.year ? Number(body.year) : null,
    status: ["Ongoing", "Completed", "Upcoming"].includes(body.status) ? body.status : "Ongoing",
    rating: String(body.rating || "NR").trim().slice(0, 10),
    poster_url: String(body.poster_url || "").trim(),
    banner_url: String(body.banner_url || "").trim(),
    featured: body.featured ? 1 : 0
  });
  res.json({ ok: true });
});

app.delete("/api/admin/anime/:id", requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM anime WHERE id = ?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Anime not found." });
  res.json({ ok: true });
});

app.post("/api/admin/upload-video", requireAdmin, (req, res, next) => {
  uploadVideo.single("video")(req, res, error => {
    if (error) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "File is too large. The local development limit is 1 GB."
        : error.message || "Upload failed.";
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: "Choose a video file to upload." });
    res.status(201).json({
      url: `/media/${req.file.filename}`,
      filename: req.file.originalname,
      size: req.file.size
    });
  });
});

app.post("/api/admin/anime/:id/episodes", requireAdmin, (req, res) => {
  const animeId = Number(req.params.id);
  const anime = db.prepare("SELECT id FROM anime WHERE id = ?").get(animeId);
  if (!anime) return res.status(404).json({ error: "Anime not found." });
  const number = Number(req.body.episode_number);
  const title = String(req.body.title || "").trim();
  const videoUrl = String(req.body.video_url || "").trim();
  const subtitleUrl = String(req.body.subtitle_url || "").trim();
  if (!Number.isInteger(number) || number < 1) return res.status(400).json({ error: "Episode number must be a positive integer." });
  if (!videoUrl || !validHttpUrl(videoUrl) || !validHttpUrl(subtitleUrl)) {
    return res.status(400).json({ error: "Enter a valid HTTP(S) video URL and optional subtitle URL." });
  }
  try {
    const result = db.prepare(`
      INSERT INTO episodes (anime_id, episode_number, title, video_url, subtitle_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(animeId, number, title, videoUrl, subtitleUrl);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) return res.status(409).json({ error: "That episode number already exists for this anime." });
    throw error;
  }
});

app.delete("/api/admin/episodes/:id", requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM episodes WHERE id = ?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: "Episode not found." });
  res.json({ ok: true });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`Otaku Arcade running at http://localhost:${PORT}`);
  console.log(`Admin login username: ${adminUsername}`);
  if (adminPassword === "change-this-password") {
    console.warn("IMPORTANT: change ADMIN_PASSWORD in .env before using this beyond local testing.");
  }
});
