const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { anime: [], query: "", genre: "", sort: "featured" };
const modalRoot = $("#modal-root");
const symbols = ["夜", "星", "夢", "光", "海", "月", "風", "空"];

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function initials(title) {
  return title.split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
}
function card(anime) {
  const genres = (anime.genres || []).slice(0, 2).join(" · ");
  const poster = anime.poster_url
    ? `<img class="poster-image" src="${esc(anime.poster_url)}" alt="" loading="lazy" onerror="this.remove()">`
    : "";
  return `<article class="anime-card" data-open="${anime.id}" tabindex="0" role="button" aria-label="View ${esc(anime.title)}">
    <div class="poster">${poster}<span class="poster-kanji">${symbols[anime.id % symbols.length]}</span>
      ${anime.featured ? '<span class="poster-badge">FEATURED</span>' : ""}
      <div class="poster-title"><small>${esc(anime.year || "NEW")} / ${esc(anime.status || "Anime").toUpperCase()}</small>${esc(anime.title)}</div>
    </div>
    <div class="card-meta"><span>★ ${esc(anime.rating || "NR")}</span><span>${esc(anime.year || "—")}</span><span>${esc(anime.status || "")}</span></div>
    <h3 class="card-title">${esc(anime.title)}</h3><p class="card-genres">${esc(genres || "Anime")}</p>
  </article>`;
}
async function loadAnime() {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.genre) params.set("genre", state.genre);
  const response = await fetch(`/api/anime?${params}`);
  state.anime = await response.json();
  renderAnime();
}
function renderAnime() {
  const list = [...state.anime];
  if (state.sort === "title") list.sort((a, b) => a.title.localeCompare(b.title));
  if (state.sort === "year") list.sort((a, b) => (b.year || 0) - (a.year || 0));
  $("#anime-grid").innerHTML = list.map(card).join("");
  $("#anime-count").textContent = state.anime.length.toString().padStart(2, "0");
  $("#empty-state").classList.toggle("hidden", state.anime.length !== 0);
  const latest = [...state.anime].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 3);
  $("#latest-grid").innerHTML = latest.map(a => `<article class="latest-item" data-open="${a.id}" tabindex="0" role="button">
    <div class="latest-thumb">${symbols[a.id % symbols.length]}</div><div><h3>${esc(a.title)}</h3><p>${esc(a.status)} · ${esc(a.year || "—")} · ${(a.genres || []).slice(0, 2).map(esc).join(" / ")}</p></div>
  </article>`).join("");
}
async function openAnime(id) {
  const response = await fetch(`/api/anime/${id}`);
  const anime = await response.json();
  if (!response.ok) return;
  modalRoot.innerHTML = `<div class="modal-backdrop" data-dismiss="true"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(anime.title)} details">
    <button class="modal-close" data-dismiss="true" aria-label="Close">×</button>
    <div class="detail-layout"><div class="detail-poster">${anime.poster_url ? `<img src="${esc(anime.poster_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px" onerror="this.remove()">` : esc(initials(anime.title))}</div>
    <div class="detail-content"><p class="eyebrow">ANIME DETAILS</p><h2>${esc(anime.title)}</h2>
      <div class="card-meta"><span>★ ${esc(anime.rating)}</span><span>${esc(anime.year || "—")}</span><span>${esc(anime.status)}</span></div>
      <div class="tag-row">${(anime.genres || []).map(g => `<span class="tag">${esc(g)}</span>`).join("")}</div>
      <p>${esc(anime.synopsis || "Synopsis coming soon.")}</p>
      <div class="episode-list"><h3>Episodes (${anime.episodes.length})</h3><div class="episode-buttons">${anime.episodes.length ? anime.episodes.map(e => `<button class="episode-button" data-watch="${e.id}">EP ${e.episode_number}${e.title ? ` · ${esc(e.title)}` : ""}</button>`).join("") : '<p class="muted">Episodes have not been added yet.</p>'}</div></div>
    </div></div></section></div>`;
}
async function watchEpisode(id) {
  const response = await fetch(`/api/episodes/${id}`);
  const ep = await response.json();
  if (!response.ok) return;
  modalRoot.innerHTML = `<div class="modal-backdrop" data-dismiss="true"><section class="modal player-wrap" role="dialog" aria-modal="true" aria-label="Video player">
    <button class="modal-close" data-dismiss="true" aria-label="Close">×</button>
    <p class="eyebrow">NOW PLAYING · EPISODE ${ep.episode_number}</p><h2 class="player-title">${esc(ep.anime_title)}${ep.title ? ` — ${esc(ep.title)}` : ""}</h2>
    <video controls playsinline preload="metadata" crossorigin="anonymous">
      <source src="${esc(ep.video_url)}">
      ${ep.subtitle_url ? `<track kind="subtitles" label="English" srclang="en" src="${esc(ep.subtitle_url)}" default>` : ""}
      Your browser does not support HTML video.
    </video>
    <p class="player-note">Demo player. If playback fails, check that the URL points directly to a browser-compatible video file and allows cross-origin playback. Use only content you own or have permission to stream.</p>
  </section></div>`;
}
document.addEventListener("click", event => {
  const open = event.target.closest("[data-open]");
  const watch = event.target.closest("[data-watch]");
  if (watch) { event.stopPropagation(); watchEpisode(watch.dataset.watch); return; }
  if (open) { openAnime(open.dataset.open); return; }
  if (event.target.dataset.dismiss === "true") modalRoot.innerHTML = "";
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") modalRoot.innerHTML = "";
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-open]")) {
    event.preventDefault(); openAnime(event.target.dataset.open);
  }
});
$("#search-form").addEventListener("submit", event => {
  event.preventDefault(); state.query = $("#search-input").value.trim(); loadAnime(); $("#catalog").scrollIntoView({ behavior: "smooth" });
});
$("#search-input").addEventListener("input", event => {
  if (!event.target.value.trim() && state.query) { state.query = ""; loadAnime(); }
});
$("#sort-select").addEventListener("change", event => { state.sort = event.target.value; renderAnime(); });
$$(".genre-chip").forEach(button => button.addEventListener("click", () => {
  $$(".genre-chip").forEach(b => b.classList.remove("selected"));
  button.classList.add("selected"); state.genre = button.dataset.genre; loadAnime();
}));
$("#year-now").textContent = new Date().getFullYear();
loadAnime().catch(() => { $("#anime-grid").innerHTML = '<p class="empty-state">Could not load titles. Make sure the server is running.</p>'; });
