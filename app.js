// Inspo — gallery app
// Functional core (init/topTags/visible) per spec; DOM rendering below.

import { expandQuery, scoreEntry } from './search.js';

const RE_SAFE_URL = /^https?:\/\//i;

const state = { entries: [], synonyms: {}, query: '', chip: null, sort: 'recent' };

const $grid = document.getElementById('grid');
const $chips = document.getElementById('chips');
const $empty = document.getElementById('empty');
const $emptyMsg = document.getElementById('empty-msg');
const $search = document.getElementById('search');
const $detail = document.getElementById('detail');
const $detailBody = document.getElementById('detail-body');

const HEART = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 14S2 10.2 2 5.9C2 3.7 3.7 2 5.7 2 7 2 7.7 2.7 8 3.2 8.3 2.7 9 2 10.3 2 12.3 2 14 3.7 14 5.9 14 10.2 8 14 8 14Z"/></svg>`;
const PLAY = `<svg viewBox="0 0 9 10" fill="currentColor" aria-hidden="true"><path d="M0 0L9 5L0 10Z"/></svg>`;

async function init() {
  const [entries, synonyms] = await Promise.all([
    fetch('index.json').then(r => r.json()),
    fetch('synonyms.json').then(r => r.json())
  ]);
  state.entries = entries; state.synonyms = synonyms;
  renderChips(topTags(entries, 12));
  render();
}

function topTags(entries, n) {
  const freq = {};
  for (const e of entries) for (const t of Object.values(e.tags).flat())
    freq[t] = (freq[t] ?? 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map(([t]) => t);
}

function visible() {
  let list = state.entries;
  if (state.chip) list = list.filter(e => Object.values(e.tags).flat().includes(state.chip));
  if (state.query.trim()) {
    const terms = expandQuery(state.query, state.synonyms);
    list = list.map(e => [scoreEntry(e, terms), e]).filter(([s]) => s > 0)
               .sort((a, b) => b[0] - a[0]).map(([, e]) => e);
  } else if (state.sort === 'loved') {
    list = [...list].sort((a, b) => (b.loves ?? 0) - (a.loves ?? 0));
  }
  return list;
}

/* ── rendering ─────────────────────────────────────────────── */

function renderChips(tags) {
  $chips.replaceChildren(...tags.map(tag => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.tag = tag;
    b.textContent = tag;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      state.chip = state.chip === tag ? null : tag;
      for (const c of $chips.children) {
        const active = c.dataset.tag === state.chip;
        c.classList.toggle('is-active', active);
        c.setAttribute('aria-pressed', String(active));
      }
      render();
    });
    return b;
  }));
}

function render() {
  const list = visible();
  $grid.replaceChildren(...list.map((e, i) => card(e, i)));
  const none = list.length === 0;
  $empty.hidden = !none;
  if (none) {
    const q = state.query.trim() || state.chip || '';
    $emptyMsg.innerHTML =
      `Nothing matches <em>‘${escapeHtml(q)}’</em> — try a mood, a component, or a colour.`;
  }
}

function card(entry, i) {
  const fig = document.createElement('figure');
  fig.className = 'shot';
  fig.style.animationDelay = `${Math.min(i, 14) * 45}ms`;
  fig.tabIndex = 0;
  fig.setAttribute('role', 'button');
  fig.setAttribute('aria-label', `${entry.title} — open details`);

  const media = document.createElement('div');
  media.className = 'shot-media';

  const img = document.createElement('img');
  img.src = entry.asset;
  img.alt = entry.title;
  img.loading = 'lazy';
  img.decoding = 'async';
  media.appendChild(img);

  if (entry.motion) {
    const badge = document.createElement('span');
    badge.className = 'shot-play';
    badge.innerHTML = PLAY;
    fig.appendChild(badge);

    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    media.appendChild(video);

    fig.addEventListener('mouseenter', () => {
      if (!video.src) video.src = entry.motion;
      video.play().then(() => fig.classList.add('is-playing')).catch(() => {});
    });
    fig.addEventListener('mouseleave', () => {
      fig.classList.remove('is-playing');
      video.pause();
    });
  }

  fig.appendChild(media);

  const meta = document.createElement('figcaption');
  meta.className = 'shot-meta';
  meta.innerHTML = `
    <p class="shot-desc">${escapeHtml(entry.description ?? '')}</p>
    <span class="shot-by">${escapeHtml(entry.addedBy ?? '')}</span>
    <span class="shot-loves">${HEART}${entry.loves ?? 0}</span>`;
  fig.appendChild(meta);

  fig.addEventListener('click', () => openDetail(entry, fig));
  fig.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openDetail(entry, fig); }
  });

  return fig;
}

/* ── detail overlay ────────────────────────────────────────── */

let _detailOpener = null;

function openDetail(entry, openerEl) {
  _detailOpener = openerEl ?? null;

  const media = entry.motion
    ? `<video src="${escapeAttr(entry.motion)}" autoplay loop muted playsinline poster="${escapeAttr(entry.asset)}"></video>`
    : `<img src="${escapeAttr(entry.asset)}" alt="${escapeAttr(entry.title)}" />`;

  const notes = (entry.notes ?? []).length
    ? `<div class="detail-notes">
         <p class="detail-notes-label">Notes</p>
         ${entry.notes.map(n =>
           `<p class="detail-note"><strong>${escapeHtml(n.by)}:</strong> ${escapeHtml(n.note)}</p>`
         ).join('')}
       </div>`
    : '';

  const visitLink = RE_SAFE_URL.test(entry.url)
    ? `<a class="detail-visit" href="${escapeAttr(entry.url)}" target="_blank" rel="noopener noreferrer">Visit site
        <svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 9L9 3M4.5 3H9v4.5" stroke="currentColor" stroke-width="1.3"/></svg>
      </a>`
    : '';

  $detailBody.innerHTML = `
    <div class="detail-media">${media}</div>
    <h2 class="detail-title" id="detail-title">${escapeHtml(entry.title)}</h2>
    <p class="detail-desc">${escapeHtml(entry.description ?? '')}</p>
    <div class="detail-meta">
      <span>${escapeHtml(entry.addedBy ?? '')}</span>
      <span class="meta-dot"></span>
      <span>${formatDate(entry.date)}</span>
      <span class="meta-dot"></span>
      <span class="detail-loves">${HEART}${entry.loves ?? 0}</span>
      ${visitLink}
    </div>
    ${notes}`;

  const others = visible().filter(e => e.id !== entry.id);
  const $more = document.getElementById('detail-more');
  document.getElementById('detail-more-grid').replaceChildren(...others.map((e, i) => card(e, i)));
  $more.hidden = others.length === 0;

  $detail.hidden = false;
  document.body.classList.add('detail-open');
  document.getElementById('detail-scroll').scrollTop = 0;
  document.getElementById('detail-back').focus();
}

function closeDetail() {
  if ($detail.hidden) return;
  $detail.hidden = true;
  document.body.classList.remove('detail-open');
  $detailBody.replaceChildren(); // stops any playing video
  if (_detailOpener) { _detailOpener.focus(); _detailOpener = null; }
}

document.getElementById('detail-close').addEventListener('click', closeDetail);
document.getElementById('detail-back').addEventListener('click', closeDetail);
$detail.addEventListener('click', ev => {
  // backdrop click — anything that isn't inside the article, controls, or the more-grid closes
  if (!ev.target.isConnected) return; // clicked a keep-browsing card that was just re-rendered
  if (!ev.target.closest('.detail-body, .detail-close, .detail-back, .detail-more')) closeDetail();
});

/* ── controls ──────────────────────────────────────────────── */

$search.addEventListener('input', () => {
  state.query = $search.value;
  render();
});

for (const btn of document.querySelectorAll('.sort-btn')) {
  btn.addEventListener('click', () => {
    state.sort = btn.dataset.sort;
    for (const b of document.querySelectorAll('.sort-btn')) {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    }
    render();
  });
}

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { closeDetail(); return; }
  if (ev.key === '/' && document.activeElement !== $search) {
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    ev.preventDefault();
    $search.focus();
    $search.select();
  }
});

/* ── utils ─────────────────────────────────────────────────── */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(s) { return escapeHtml(s); }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return escapeHtml(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

init();
