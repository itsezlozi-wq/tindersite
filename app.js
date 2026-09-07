const tg = window.Telegram.WebApp;
tg.ready(); tg.expand();
const headers = {'X-Telegram-Init-Data': tg.initData};
let current = null;
const $ = id => document.getElementById(id);
const api = async (url, options = {}) => {
  const response = await fetch(url, {headers, ...options});
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const card = profile => `<article class="profile-card"><img src="${profile.photos[0]}" alt="${esc(profile.name)}"><div class="card-info"><div class="name">${esc(profile.name)}, ${profile.age ?? ''} <span class="verified">✦</span></div><div class="city">⌖ ${esc(profile.city)}</div>${profile.bio ? `<p class="bio">${esc(profile.bio)}</p>` : ''}</div></article>`;
const list = (items, empty) => items.length ? items.map(p => `<div class="list-card"><img src="${p.photos[0]}" alt=""><div><div class="list-name">${esc(p.name)}, ${p.age ?? ''}</div><div class="list-meta">⌖ ${esc(p.city)}</div></div></div>`).join('') : `<div class="list-empty">${empty}</div>`;
async function loadFeed() { try { const data = await api('/api/discover'); current = data.profile; $('card-wrap').innerHTML = current ? card(current) : ''; $('empty-feed').classList.toggle('hidden', !!current); $('actions').classList.toggle('hidden', !current); $('feed-counter').textContent = current ? 'Новая анкета' : ''; } catch { toast('Открой приложение из Telegram'); } }
async function react(kind) { if (!current) return; const id = current.id; try { const result = await api('/api/react', {method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({profile_id:id,kind})}); if(result.matched) toast('Это взаимно! 💕'); await loadFeed(); } catch { toast('Не удалось сохранить реакцию'); } }
async function loadView(view) { document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`)); document.querySelectorAll('.tab').forEach(t => t.classList.toggle('selected', t.dataset.view === view)); if(view === 'feed') return loadFeed(); if(view === 'likes') $('likes-list').innerHTML = list((await api('/api/likes')).profiles, 'Пока никто не лайкнул тебя'); if(view === 'matches') $('matches-list').innerHTML = list((await api('/api/matches')).profiles, 'Взаимных симпатий пока нет'); if(view === 'profile') { const p=(await api('/api/me')).profile; $('my-profile').innerHTML=p?`<div class="profile-full">${card(p).replace('profile-card','')}</div>`:'<div class="list-empty">Сначала создай анкету в боте.</div>'; } }
function toast(text) { $('toast').textContent=text; $('toast').classList.add('show'); setTimeout(()=>$('toast').classList.remove('show'),2200); }
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => loadView(tab.dataset.view)));
document.querySelectorAll('.action').forEach(btn => btn.addEventListener('click', () => react(btn.dataset.kind)));
loadFeed();
