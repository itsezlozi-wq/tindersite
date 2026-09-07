const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
const headers = {'X-Telegram-Init-Data': tg.initData};
const API_BASE = (window.TINDER_API_URL || '').replace(/\/$/, '');
let current = null;
let botUsername = '';
let isAdmin = false;
const $ = id => document.getElementById(id);
const api = async (url, options = {}) => {
  const response = await fetch(`${API_BASE}${url}`, {headers, ...options});
  if (!response.ok) throw new Error(await response.text());
  return response.json();
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const photoUrl = photo => photo && photo.startsWith('/') ? `${API_BASE}${photo}` : photo;
const card = p => `<article class="profile-card"><img src="${photoUrl(p.photos[0])}" alt="${esc(p.name)}"><div class="card-info"><div class="name">${esc(p.name)}, ${p.age ?? ''} <span class="verified">✦</span></div><div class="city">⌖ ${esc(p.city)}</div>${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}</div></article>`;
const list = (items, empty, kind = '') => items.length ? items.map(p => `<div class="list-card" data-id="${p.id}"><img src="${photoUrl(p.photos[0])}" alt=""><div class="list-content"><div class="list-name">${esc(p.name)}, ${p.age ?? ''}</div><div class="list-meta">⌖ ${esc(p.city)}${p.premium ? ' · ⭐ Premium' : ''}</div></div>${kind === 'likes' ? '<button class="mini-like" data-action="like">♥</button><button class="mini-nope" data-action="nope">×</button>' : kind === 'matches' && p.username ? '<button class="mini-message" data-action="message">Написать</button>' : ''}</div>`).join('') : `<div class="list-empty">${empty}</div>`;
function toast(text) { $('toast').textContent = text; $('toast').classList.add('show'); setTimeout(() => $('toast').classList.remove('show'), 2200); }
function openBot(command = 'start') { if (botUsername) tg.openTelegramLink(`https://t.me/${botUsername}?start=${command}`); }

async function loadFeed() {
  const [data, me] = await Promise.all([api('/api/discover'), api('/api/me')]);
  current = data.profile;
  const hasProfile = !!me.profile;
  $('card-wrap').innerHTML = current ? card(current) : '';
  $('empty-feed').classList.toggle('hidden', !!current || !hasProfile);
  $('create-profile').classList.toggle('hidden', hasProfile);
  $('actions').classList.toggle('hidden', !current);
  $('feed-counter').textContent = current ? 'Новая анкета' : '';
}
async function react(kind) {
  if (!current) return;
  const result = await api('/api/react', {method:'POST', headers:{...headers, 'Content-Type':'application/json'}, body:JSON.stringify({profile_id:current.id, kind})});
  if (result.matched) toast('Это взаимно! 💕');
  await loadFeed();
}
function bindListActions(id) {
  $(id).querySelectorAll('[data-action]').forEach(button => button.onclick = async event => {
    event.stopPropagation();
    const profileId = Number(button.closest('.list-card').dataset.id);
    if (button.dataset.action === 'message') {
      const text = prompt('Сообщение:');
      if (text) { await api('/api/matches/message', {method:'POST', headers:{...headers, 'Content-Type':'application/json'}, body:JSON.stringify({profile_id:profileId, text})}); toast('Сообщение отправлено'); }
      return;
    }
    const result = await api('/api/react', {method:'POST', headers:{...headers, 'Content-Type':'application/json'}, body:JSON.stringify({profile_id:profileId, kind:button.dataset.action})});
    if (result.matched) toast('Это взаимно! 💕');
    await loadView('likes');
  });
}
async function loadView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('selected', t.dataset.view === view));
  if (view === 'feed') return loadFeed();
  if (view === 'likes') { $('likes-list').innerHTML = list((await api('/api/likes')).profiles, 'Пока никто не лайкнул тебя', 'likes'); bindListActions('likes-list'); }
  if (view === 'matches') { $('matches-list').innerHTML = list((await api('/api/matches')).profiles, 'Взаимных симпатий пока нет', 'matches'); bindListActions('matches-list'); }
  if (view === 'profile') { const p = (await api('/api/me')).profile; $('my-profile').innerHTML = p ? `<div class="profile-full">${card(p).replace('profile-card','')}</div><button id="edit-profile" class="wide-button">Изменить анкету</button>` : '<div class="list-empty">Создай анкету прямо в приложении.</div><button id="create-profile-button" class="wide-button">Создать анкету</button>'; ($('edit-profile') || $('create-profile-button')).onclick = openEditor; }
  if (view === 'admin') await loadAdmin();
}
async function openEditor() {
  const p = (await api('/api/me')).profile;
  $('profile-editor').classList.remove('hidden');
  $('edit-name').value = p?.name || ''; $('edit-age').value = p?.age || ''; $('edit-city').value = p?.city || '';
  $('edit-gender').value = p?.gender || 'male'; $('edit-looking').value = p?.looking_for || 'all'; $('edit-bio').value = p?.bio || '';
  renderEditPhotos(p?.photos || []);
}
function renderEditPhotos(photos) { $('edit-photos').innerHTML = photos.map(photo => `<div class="edit-photo"><img src="${photoUrl(photo)}"><button data-photo="${photo}">×</button></div>`).join(''); $('edit-photos').querySelectorAll('button').forEach(b => b.onclick = async () => { await api('/api/profile/photo', {method:'DELETE', headers:{...headers, 'Content-Type':'application/json'}, body:JSON.stringify({photo_id:b.dataset.photo.replace('/media/','')})}); openEditor(); }); }
async function saveProfile() {
  try {
    await api('/api/profile', {method:'PUT', headers:{...headers, 'Content-Type':'application/json'}, body:JSON.stringify({name:$('edit-name').value, age:$('edit-age').value, city:$('edit-city').value, gender:$('edit-gender').value, looking_for:$('edit-looking').value, bio:$('edit-bio').value})});
    toast('Анкета сохранена'); $('profile-editor').classList.add('hidden'); await loadView('profile');
  } catch (error) { toast(error.message || 'Не удалось сохранить'); }
}
async function uploadPhoto() {
  const file = $('photo-input').files[0]; if (!file) return toast('Выбери фото');
  const data = new FormData(); data.append('photo', file);
  try { await api('/api/profile/photo', {method:'POST', headers, body:data}); $('photo-input').value = ''; await openEditor(); } catch (error) { toast(error.message || 'Не удалось загрузить фото'); }
}
function adminButtons(p) {
  return `<div class="admin-controls"><button data-admin="ban" class="${p.banned ? 'accent' : 'danger'}">${p.banned ? 'Разбанить' : 'Заблокировать'}</button><button data-admin="premium" class="accent">${p.premium ? 'Снять Premium' : 'Выдать Premium'}</button><button data-admin="boost" class="accent">Буст +1</button><button data-admin="delete" class="danger">Удалить анкету</button></div>`;
}
function adminCard(p) { return p ? `<div class="admin-user"><div class="list-name">${esc(p.name)}, ${p.age} · ID ${p.telegram_id}</div><div class="list-meta">⌖ ${esc(p.city)} · @${esc(p.username || 'нет username')} · ${p.banned ? '🚫 бан' : 'активен'} · бустов: ${p.boosts}</div>${adminButtons(p)}</div>` : ''; }
function bindAdminCard(container) { $(container).querySelectorAll('[data-admin]').forEach(button => button.onclick = async () => { const p = JSON.parse($(container).dataset.profile); const action = button.dataset.admin; if (action === 'delete' && !confirm('Удалить анкету и все её лайки?')) return; await api(`/api/admin/${action}/${p.id}`, {method:'POST', headers:{...headers, 'Content-Type':'application/json'}, body:JSON.stringify({amount:1})}); toast('Готово'); await loadAdmin(); }); }
async function loadAdmin() {
  const stats = await api('/api/admin/stats');
  $('admin-stats').innerHTML = [['users','Пользователи'],['profiles','Анкеты'],['matches','Матчи'],['premium','Premium'],['banned','Баны']].map(([key,label]) => `<div class="stat"><b>${stats[key]}</b><span>${label}</span></div>`).join('');
  const data = await api('/api/admin/profiles'); $('admin-profiles').innerHTML = data.profiles.map(p => adminCard(p)).join('') || '<div class="list-empty">Анкет нет</div>';
  $('admin-profiles').querySelectorAll('.admin-user').forEach((el, i) => { el.dataset.profile = JSON.stringify(data.profiles[i]); }); bindAdminCard('admin-profiles');
}
async function searchAdmin() { const data = await api(`/api/admin/search?q=${encodeURIComponent($('admin-query').value)}`); $('admin-result').innerHTML = data.profile ? adminCard(data.profile) : '<div class="list-empty">Ничего не найдено</div>'; const el=$('admin-result').querySelector('.admin-user'); if(el) { el.dataset.profile=JSON.stringify(data.profile); bindAdminCard('admin-result'); } }
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => loadView(tab.dataset.view)));
document.querySelectorAll('.action').forEach(button => button.addEventListener('click', () => react(button.dataset.kind)));
$('open-bot').onclick = () => openBot('start'); $('close-editor').onclick = () => $('profile-editor').classList.add('hidden'); $('save-profile').onclick = saveProfile; $('upload-photo').onclick = uploadPhoto; $('admin-search-button').onclick = searchAdmin;
api('/api/config').then(data => { botUsername = data.bot_username; isAdmin = data.is_admin; document.querySelector('.admin-tab').classList.toggle('hidden', !isAdmin); loadFeed(); }).catch(() => toast('Не удалось подключить приложение'));
