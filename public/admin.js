const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let catalog = [];
async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function notice(selector, message, error = false) {
  $(selector).textContent = message;
  $(selector).classList.toggle("error", error);
}
function setLoggedIn(on) {
  $("#login-view").classList.toggle("hidden", on);
  $("#dashboard-view").classList.toggle("hidden", !on);
}
async function checkSession() {
  try { await api("/api/admin/me"); setLoggedIn(true); await refreshAll(); }
  catch { setLoggedIn(false); }
}
async function refreshAll() {
  catalog = await api("/api/admin/anime");
  $("#anime-table").innerHTML = catalog.map(a => `<tr><td><strong>${esc(a.title)}</strong><br><span class="small-muted">${esc((a.genres || []).join(", "))}</span></td><td>${esc(a.year || "—")}<br>${esc(a.status)}</td><td>${a.episode_count}</td><td><div class="table-actions"><button class="btn-small" data-edit="${a.id}">Edit</button><button class="btn-small" style="background:#34313f;color:white" data-episodes="${a.id}">Episodes</button><button class="btn-small btn-danger" data-delete="${a.id}">Delete</button></div></td></tr>`).join("");
  $("#episode-anime").innerHTML = catalog.map(a => `<option value="${a.id}">${esc(a.title)}</option>`).join("");
  await refreshEpisodes();
}
async function refreshEpisodes() {
  const rows = [];
  for (const a of catalog) {
    const full = await api(`/api/anime/${a.id}`);
    for (const ep of full.episodes) rows.push(`<tr><td>${esc(a.title)}</td><td>${ep.episode_number}${ep.title ? ` — ${esc(ep.title)}` : ""}</td><td style="max-width:260px;word-break:break-all">${esc(ep.video_url)}</td><td><button class="btn-small btn-danger" data-delete-episode="${ep.id}">Delete</button></td></tr>`);
  }
  $("#episode-table").innerHTML = rows.join("") || '<tr><td colspan="4" class="small-muted">No episodes added yet.</td></tr>';
}
function resetAnimeForm() {
  $("#anime-form").reset(); $("#anime-id").value = ""; $("#anime-form-title").textContent = "Add anime title"; notice("#anime-message", "");
}
$("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify({ username: $("#username").value, password: $("#password").value }) });
    $("#password").value = ""; setLoggedIn(true); await refreshAll();
  } catch (error) { notice("#login-message", error.message, true); }
});
$("#logout-button").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST", body: "{}" }); setLoggedIn(false);
});
$("#refresh-button").addEventListener("click", () => refreshAll().catch(e => alert(e.message)));
$("#reset-anime").addEventListener("click", resetAnimeForm);
$("#anime-form").addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("#anime-id").value;
  const body = {
    title: $("#title").value, genres: $("#genres").value, year: $("#year").value,
    status: $("#status").value, rating: $("#rating").value,
    poster_url: $("#poster-url").value, banner_url: $("#banner-url").value,
    synopsis: $("#synopsis").value, featured: $("#featured").checked
  };
  try {
    await api(id ? `/api/admin/anime/${id}` : "/api/admin/anime", { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
    notice("#anime-message", id ? "Anime updated." : "Anime added."); resetAnimeForm(); await refreshAll();
  } catch (error) { notice("#anime-message", error.message, true); }
});
$("#upload-form").addEventListener("submit", async event => {
  event.preventDefault();
  const fileInput = $("#video-file");
  if (!fileInput.files || !fileInput.files[0]) {
    notice("#upload-message", "Choose a video file first.", true);
    return;
  }
  const formData = new FormData();
  formData.append("video", fileInput.files[0]);
  notice("#upload-message", "Uploading… this may take a while for large files.");
  try {
    const response = await fetch("/api/admin/upload-video", { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Upload failed.");
    $("#video-url").value = data.url;
    notice("#upload-message", `Uploaded: ${data.filename}. The video URL has been copied into the episode form below.`);
    $("#episode-form").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    notice("#upload-message", error.message, true);
  }
});

$("#episode-form").addEventListener("submit", async event => {
  event.preventDefault();
  const animeId = $("#episode-anime").value;
  try {
    await api(`/api/admin/anime/${animeId}/episodes`, { method: "POST", body: JSON.stringify({
      episode_number: $("#episode-number").value, title: $("#episode-title").value,
      video_url: $("#video-url").value, subtitle_url: $("#subtitle-url").value
    })});
    notice("#episode-message", "Episode added."); $("#episode-title").value = ""; $("#video-url").value = ""; $("#subtitle-url").value = ""; await refreshAll();
  } catch (error) { notice("#episode-message", error.message, true); }
});
document.addEventListener("click", async event => {
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-delete]");
  const eps = event.target.closest("[data-episodes]");
  const delEp = event.target.closest("[data-delete-episode]");
  try {
    if (edit) {
      const a = await api(`/api/anime/${edit.dataset.edit}`);
      $("#anime-id").value = a.id; $("#title").value = a.title; $("#genres").value = (a.genres || []).join(", ");
      $("#year").value = a.year || ""; $("#status").value = a.status; $("#rating").value = a.rating || "";
      $("#poster-url").value = a.poster_url || ""; $("#banner-url").value = a.banner_url || "";
      $("#synopsis").value = a.synopsis || ""; $("#featured").checked = Boolean(a.featured);
      $("#anime-form-title").textContent = "Edit anime title"; $("#anime-form").scrollIntoView({ behavior: "smooth" });
    }
    if (del && confirm("Delete this anime and all its episodes? This cannot be undone.")) {
      await api(`/api/admin/anime/${del.dataset.delete}`, { method: "DELETE" }); await refreshAll();
    }
    if (eps) { $("#episode-anime").value = eps.dataset.episodes; $("#episode-form").scrollIntoView({ behavior: "smooth" }); }
    if (delEp && confirm("Delete this episode?")) {
      await api(`/api/admin/episodes/${delEp.dataset.deleteEpisode}`, { method: "DELETE" }); await refreshAll();
    }
  } catch (error) { alert(error.message); }
});
checkSession();
