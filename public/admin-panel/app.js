/* Revengers admin dashboard — plain JavaScript, talks to the same backend it is served from. */
(() => {
  'use strict';

  // ---------- colours (match styles.css) ----------
  const COLORS = {
    accent: '#2a78d6',
    accentFill: 'rgba(42, 120, 214, 0.12)',
    good: '#0ca30c',
    critical: '#d03b3b',
    neutral: '#b9b7b0',
    ink2: '#52514e',
    muted: '#898781',
    grid: '#eceae4',
    surface: '#ffffff',
  };

  const METRIC_LABELS = {
    totalXp: 'Total XP', trophies: 'Trophies', level: 'Level', won: 'Wins', kills: 'Kills', totalMatch: 'Matches played', hours: 'Hours played',
  };

  // ---------- small helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const fmt = (n) => (Number(n) || 0).toLocaleString();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const shortDay = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const winRate = (p) => (p.totalMatch ? Math.round(((p.won || 0) / p.totalMatch) * 100) + '%' : '—');
  const kd = (p) => ((p.kills || 0) / Math.max(p.death || 0, 1)).toFixed(2);

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* private mode */ } },
  };

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  let toastTimer;
  function toast(message, isError = false) {
    const el = $('#toast');
    el.textContent = message;
    el.className = 'toast' + (isError ? ' toast-error' : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  function avatar(p) {
    const pic = typeof p.displayPic === 'string' && /^https?:\/\//i.test(p.displayPic) ? p.displayPic : '';
    const initial = esc((p.name || p.email || '?').trim().charAt(0).toUpperCase());
    return pic
      ? `<span class="avatar" data-initial="${initial}"><img src="${esc(pic)}" alt="" onerror="this.parentNode.textContent=this.parentNode.dataset.initial"></span>`
      : `<span class="avatar">${initial}</span>`;
  }

  function statusOf(p) {
    if (p.isDeleted) return 'removed';
    if (p.isBanned) return 'banned';
    return 'active';
  }

  // match history: newer matches store an outcome (won / lost / draw / left), older ones only a won flag
  function outcomeBadge(me) {
    const outcome = me.outcome || (me.result ? 'won' : 'lost');
    const label = { won: 'Won', lost: 'Lost', draw: 'Draw', left: 'Left early' }[outcome] || 'Lost';
    return `<span class="badge ${outcome === 'won' ? 'badge-win' : 'badge-loss'}">${label}</span>`;
  }

  function statusBadge(p) {
    const s = statusOf(p);
    const label = { active: 'Active', banned: 'Banned', removed: 'Removed' }[s];
    return `<span class="badge badge-${s}">${label}</span>`;
  }

  // ---------- API ----------
  const auth = { token: store.get('adminToken'), email: store.get('adminEmail') };

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/auth/login') {
      logout('Your session expired. Please sign in again.');
      throw new Error('Session expired');
    }
    if (!res.ok) {
      const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      throw new Error(message || `Request failed (${res.status})`);
    }
    return data;
  }

  // ---------- login / logout ----------
  function showLogin(message) {
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    const err = $('#login-error');
    err.hidden = !message;
    err.textContent = message || '';
  }

  function logout(message) {
    auth.token = null;
    auth.email = null;
    store.remove('adminToken');
    store.remove('adminEmail');
    showLogin(message);
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter || $('#login-form button');
    btn.disabled = true;
    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: { email: $('#login-email').value.trim(), password: $('#login-password').value },
      });
      if (res.data?.role !== 'admin') throw new Error('This account is not an admin.');
      auth.token = res.data.token;
      auth.email = res.data.email;
      store.set('adminToken', auth.token);
      store.set('adminEmail', auth.email);
      $('#login-password').value = '';
      startApp();
    } catch (err) {
      showLogin(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  $('#logout-btn').addEventListener('click', () => logout());

  // ---------- routing ----------
  const views = { overview: loadOverview, players: loadPlayers, leaderboard: loadLeaderboard, notifications: loadNotifications, rewards: loadRewards, support: loadSupport, store: loadStore };

  function route() {
    const name = (location.hash || '#overview').slice(1);
    const view = views[name] ? name : 'overview';
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${view}`; });
    document.querySelectorAll('.nav-link').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
    views[view]();
  }

  function startApp() {
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    $('#admin-email').textContent = auth.email || '';
    route();
    refreshSupportCount();
  }

  window.addEventListener('hashchange', () => { if (auth.token) route(); });
  document.querySelectorAll('[data-refresh]').forEach((b) => b.addEventListener('click', route));

  // ---------- charts ----------
  const charts = {};
  if (window.Chart) {
    Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    Chart.defaults.color = COLORS.ink2;
    Chart.defaults.plugins.tooltip.backgroundColor = '#16181d';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = false;
  }

  function drawChart(id, config) {
    if (!window.Chart) return; // CDN blocked → page still works without charts
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), config);
  }

  const axisX = { grid: { display: false }, border: { color: '#d6d4cd' }, ticks: { color: COLORS.muted, maxRotation: 0, autoSkipPadding: 12 } };
  const axisY = { beginAtZero: true, grid: { color: COLORS.grid }, border: { display: false }, ticks: { color: COLORS.muted, precision: 0 } };

  function topPlayersChart(id, players, metric) {
    drawChart(id, {
      type: 'bar',
      data: {
        labels: players.map((p) => p.name || p.email),
        datasets: [{ data: players.map((p) => p[metric] || 0), backgroundColor: COLORS.accent, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 }],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${METRIC_LABELS[metric]}: ${fmt(c.raw)}` } } },
        scales: {
          x: { ...axisY, ticks: { ...axisY.ticks, maxRotation: 0, maxTicksLimit: 5, callback: (v) => fmt(v) } },
          y: { grid: { display: false }, border: { color: '#d6d4cd' }, ticks: { color: COLORS.ink2, autoSkip: false } },
        },
      },
    });
  }

  // ---------- overview ----------
  async function loadOverview() {
    try {
      const [statsRes, lbRes] = await Promise.all([
        api('/admin/stats'),
        api('/admin/leaderboard?sortBy=totalXp&limit=10'),
      ]);
      const s = statsRes.data;

      const tiles = [
        { label: 'Total players', value: s.totalPlayers, sub: `${fmt(s.removedPlayers)} removed` },
        { label: 'Active', value: s.activePlayers, dot: COLORS.good, sub: 'can log in and play' },
        { label: 'Banned', value: s.bannedPlayers, dot: COLORS.critical, sub: 'blocked from the game' },
        { label: 'New this week', value: s.newPlayersLast7Days, sub: `${fmt(s.newPlayersToday)} today` },
        { label: 'Games played', value: s.totalGames, sub: `${fmt(s.gamesToday)} today` },
      ];
      $('#stat-tiles').innerHTML = tiles.map((t) => `
        <div class="tile">
          <div class="tile-label">${t.dot ? `<span class="dot" style="background:${t.dot}"></span>` : ''}${t.label}</div>
          <div class="tile-value">${fmt(t.value)}</div>
          <div class="tile-sub">${t.sub}</div>
        </div>`).join('');

      // donut: player status
      const statusData = [
        { label: 'Active', value: s.activePlayers, color: COLORS.good },
        { label: 'Banned', value: s.bannedPlayers, color: COLORS.critical },
        { label: 'Removed', value: s.removedPlayers, color: COLORS.neutral },
      ];
      const statusTotal = statusData.reduce((sum, d) => sum + d.value, 0);
      drawChart('chart-status', {
        type: 'doughnut',
        data: {
          labels: statusData.map((d) => d.label),
          datasets: [{
            data: statusData.map((d) => d.value),
            backgroundColor: statusData.map((d) => d.color),
            borderColor: COLORS.surface, borderWidth: 2, hoverOffset: 4,
          }],
        },
        options: {
          cutout: '68%',
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => `${c.label}: ${fmt(c.raw)} (${statusTotal ? Math.round((c.raw / statusTotal) * 100) : 0}%)` } },
          },
        },
        plugins: [{
          id: 'centerText',
          afterDraw(chart) {
            const { ctx, chartArea: a } = chart;
            const x = (a.left + a.right) / 2;
            const y = (a.top + a.bottom) / 2;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#16181d';
            ctx.font = '700 24px system-ui, sans-serif';
            ctx.fillText(fmt(statusTotal), x, y + 4);
            ctx.fillStyle = COLORS.muted;
            ctx.font = '12px system-ui, sans-serif';
            ctx.fillText('accounts', x, y + 22);
            ctx.restore();
          },
        }],
      });
      $('#status-legend').innerHTML = statusData.map((d) => `
        <li><span class="dot" style="background:${d.color}"></span>${d.label}
          <strong>${fmt(d.value)} <span class="muted small">${statusTotal ? Math.round((d.value / statusTotal) * 100) : 0}%</span></strong></li>`).join('');

      // line: signups per day
      drawChart('chart-signups', {
        type: 'line',
        data: {
          labels: s.signupsLast14Days.map((d) => shortDay(d.date)),
          datasets: [{
            data: s.signupsLast14Days.map((d) => d.count),
            borderColor: COLORS.accent, backgroundColor: COLORS.accentFill, fill: true, tension: 0.3, cubicInterpolationMode: 'monotone',
            borderWidth: 2, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: COLORS.accent,
            pointBorderColor: COLORS.surface, pointBorderWidth: 2,
          }],
        },
        options: {
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${fmt(c.raw)} new players` } } },
          scales: { x: axisX, y: axisY },
        },
      });

      // bar: games per day
      drawChart('chart-games', {
        type: 'bar',
        data: {
          labels: s.gamesLast14Days.map((d) => shortDay(d.date)),
          datasets: [{ data: s.gamesLast14Days.map((d) => d.count), backgroundColor: COLORS.accent, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 28 }],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${fmt(c.raw)} games` } } },
          scales: { x: axisX, y: axisY },
        },
      });

      topPlayersChart('chart-top', lbRes.data.leaderboard, 'totalXp');
    } catch (err) {
      toast(err.message, true);
    }
  }

  // ---------- players ----------
  const playerState = { page: 1, limit: 15 };

  async function loadPlayers() {
    const [sortBy, order] = $('#player-sort').value.split(':');
    const params = new URLSearchParams({
      page: playerState.page, limit: playerState.limit, status: $('#player-status').value, sortBy, order,
    });
    const search = $('#player-search').value.trim();
    if (search) params.set('search', search);

    const body = $('#players-body');
    try {
      const res = await api(`/admin/players?${params}`);
      const { players, pagination } = res.data;
      body.innerHTML = players.length ? players.map(playerRow).join('') : '<tr><td class="empty" colspan="9">No players found.</td></tr>';
      renderPager('#players-pager', pagination, 'players', (page) => { playerState.page = page; loadPlayers(); });
    } catch (err) {
      toast(err.message, true);
    }
  }

  function playerRow(p) {
    const s = statusOf(p);
    const actions = [`<button class="btn btn-sm" data-action="view" data-id="${p._id}">View</button>`];
    if (s === 'removed') {
      actions.push(`<button class="btn btn-sm" data-action="restore" data-id="${p._id}">Restore</button>`);
    } else {
      actions.push(s === 'banned'
        ? `<button class="btn btn-sm" data-action="unban" data-id="${p._id}">Unban</button>`
        : `<button class="btn btn-sm btn-text-danger" data-action="ban" data-id="${p._id}">Ban</button>`);
      actions.push(`<button class="btn btn-sm btn-text-danger" data-action="remove" data-id="${p._id}">Remove</button>`);
    }
    return `
      <tr data-name="${esc(p.name || p.email)}">
        <td><button class="link-btn player-cell" data-action="view" data-id="${p._id}">${avatar(p)}
          <span><div class="player-name">${esc(p.name || '(no name)')}</div><div class="player-email">${esc(p.email)}</div></span></button></td>
        <td class="num">${fmt(p.level)}</td>
        <td class="num">${fmt(p.totalXp)}</td>
        <td class="num">${fmt(p.totalMatch)}</td>
        <td class="num">${winRate(p)}</td>
        <td class="num">${kd(p)}</td>
        <td>${fmtDate(p.createdAt)}</td>
        <td>${statusBadge(p)}</td>
        <td><div class="actions">${actions.join('')}</div></td>
      </tr>`;
  }

  function renderPager(sel, { page, totalPages, total }, noun, go) {
    const el = $(sel);
    el.innerHTML = `
      <span>${fmt(total)} ${noun} · page ${page} of ${Math.max(totalPages, 1)}</span>
      <span class="pager-btns">
        <button class="btn btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
        <button class="btn btn-sm" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next →</button>
      </span>`;
    el.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.page))));
  }

  $('#player-search').addEventListener('input', debounce(() => { playerState.page = 1; loadPlayers(); }, 300));
  $('#player-status').addEventListener('change', () => { playerState.page = 1; loadPlayers(); });
  $('#player-sort').addEventListener('change', () => { playerState.page = 1; loadPlayers(); });

  $('#players-body').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const name = btn.closest('tr')?.dataset.name || 'this player';
    ({ view: showPlayer, ban: confirmBan, unban: doUnban, remove: confirmRemove, restore: doRestore })[btn.dataset.action](id, name);
  });

  // ---------- modal ----------
  function openModal(title, html, wide = false) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = html;
    $('#modal .modal-card').classList.toggle('wide', wide);
    $('#modal').hidden = false;
  }
  function closeModal() { $('#modal').hidden = true; }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  async function playerAction(request, successMessage) {
    try {
      await request();
      closeModal();
      toast(successMessage);
      loadPlayers();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function confirmBan(id, name) {
    openModal(`Ban ${name}?`, `
      <p>The player is logged out right away and can't sign in until you unban them.</p>
      <label>Reason <span class="muted small">(shown to the player)</span>
        <textarea id="ban-reason" maxlength="500" placeholder="e.g. Cheating in ranked matches"></textarea></label>
      <div class="modal-actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-danger" id="ban-confirm">Ban player</button>
      </div>`);
    $('#ban-reason').focus();
    $('#ban-confirm').addEventListener('click', () => playerAction(
      () => api(`/admin/players/${id}/ban`, { method: 'PATCH', body: { reason: $('#ban-reason').value.trim() || undefined } }),
      `${name} has been banned`,
    ));
  }

  function doUnban(id, name) {
    playerAction(() => api(`/admin/players/${id}/unban`, { method: 'PATCH' }), `${name} has been unbanned`);
  }

  function confirmRemove(id, name) {
    openModal(`Remove ${name}?`, `
      <p>The account is hidden from the game and leaderboard, and the player can't sign in.
      Their data is kept, so you can <strong>restore</strong> them later from the “Removed” filter.</p>
      <div class="modal-actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-danger" id="remove-confirm">Remove player</button>
      </div>`);
    $('#remove-confirm').addEventListener('click', () => playerAction(
      () => api(`/admin/players/${id}`, { method: 'DELETE' }),
      `${name} has been removed`,
    ));
  }

  function doRestore(id, name) {
    playerAction(() => api(`/admin/players/${id}/restore`, { method: 'PATCH' }), `${name} has been restored`);
  }

  async function showPlayer(id) {
    try {
      const { player: p, recentGames } = (await api(`/admin/players/${id}`)).data;
      const stats = [
        ['Level', fmt(p.level)], ['Trophies', fmt(p.trophies)], ['Total XP', fmt(p.totalXp)], ['Matches', fmt(p.totalMatch)],
        ['Wins', fmt(p.won)], ['Losses', fmt(p.lost)], ['Win rate', winRate(p)], ['K/D', kd(p)],
        ['Coins', fmt(p.coin)], ['Gems', fmt(p.gem)], ['Diamonds', fmt(p.diamond)], ['Hours', fmt(p.hours)],
        ['Story stage', `${fmt(p.storyStage)} / 7`], ['Skill points', fmt(p.skillPoints)],
        ['Chapters done', (p.chaptersCompleted || []).length ? p.chaptersCompleted.join(', ') : '—'], ['Assists', fmt(p.assists)],
      ];
      const games = recentGames.map((g) => {
        const me = (g.players || []).find((x) => String(x.user) === String(p._id)) || {};
        return `<tr><td>${fmtDate(g.createdAt)}</td>
          <td>${outcomeBadge(me)}</td>
          <td class="num">${fmt(me.score)}</td><td class="num">${fmt(me.kills)} / ${fmt(me.deaths)} / ${fmt(me.assists)}</td>
          <td class="num">${(g.players || []).length}</td></tr>`;
      }).join('');

      openModal(p.name || p.email, `
        <div class="detail-head">${avatar(p)}
          <div><div class="player-name">${esc(p.name || '(no name)')} ${statusBadge(p)}</div>
          <div class="player-email">${esc(p.email)} · ${esc(p.authProvider || 'email')} login · joined ${fmtDate(p.createdAt)}</div></div>
        </div>
        ${p.isBanned ? `<div class="ban-note">Banned ${fmtDate(p.bannedAt)}${p.banReason ? ` — ${esc(p.banReason)}` : ''}</div>` : ''}
        <div class="detail-grid">${stats.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
        <h2>Last 10 games</h2>
        <div class="table-scroll"><table class="table">
          <thead><tr><th>Date</th><th>Result</th><th class="num">Score</th><th class="num">K / D / A</th><th class="num">Players</th></tr></thead>
          <tbody>${games || '<tr><td class="empty" colspan="5">No games yet.</td></tr>'}</tbody>
        </table></div>`, true);
    } catch (err) {
      toast(err.message, true);
    }
  }

  // ---------- leaderboard ----------
  const lbState = { page: 1, limit: 20 };

  async function loadLeaderboard() {
    const metric = $('#lb-metric').value;
    try {
      const [pageRes, topRes] = await Promise.all([
        api(`/admin/leaderboard?sortBy=${metric}&page=${lbState.page}&limit=${lbState.limit}`),
        api(`/admin/leaderboard?sortBy=${metric}&limit=10`),
      ]);
      const { leaderboard, pagination } = pageRes.data;
      $('#lb-chart-title').innerHTML = `Top 10 <span class="muted small">by ${METRIC_LABELS[metric]}</span>`;
      topPlayersChart('chart-lb', topRes.data.leaderboard, metric);

      $('#lb-body').innerHTML = leaderboard.length ? leaderboard.map((p) => `
        <tr>
          <td class="num">${p.rank <= 3 ? `<span class="medal medal-${p.rank}">${p.rank}</span>` : p.rank}</td>
          <td><div class="player-cell">${avatar(p)}<span><div class="player-name">${esc(p.name || '(no name)')}</div><div class="player-email">${esc(p.email)}</div></span></div></td>
          <td class="num">${fmt(p.level)}</td><td class="num">${fmt(p.trophies)}</td><td class="num">${fmt(p.totalXp)}</td><td class="num">${fmt(p.won)}</td>
          <td class="num">${fmt(p.kills)}</td><td class="num">${fmt(p.totalMatch)}</td><td class="num">${fmt(p.hours)}</td>
        </tr>`).join('') : '<tr><td class="empty" colspan="8">No players yet.</td></tr>';
      renderPager('#lb-pager', pagination, 'players', (page) => { lbState.page = page; loadLeaderboard(); });
    } catch (err) {
      toast(err.message, true);
    }
  }

  $('#lb-metric').addEventListener('change', () => { lbState.page = 1; loadLeaderboard(); });

  // ---------- notifications ----------
  const notifyState = { channel: 'push', audience: 'all', selected: new Map(), status: null, historyPage: 1, pollTimer: null };

  async function loadNotifications() {
    try {
      notifyState.status = (await api('/admin/notifications/status')).data;
      renderNotifyStatus();
      renderNotifyForm();
      updateReach();
      loadNotifyHistory();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function renderNotifyStatus() {
    const s = notifyState.status;
    $('#notify-status').innerHTML = `
      <div class="tile">
        <div class="tile-label"><span class="dot" style="background:${COLORS.good}"></span>Push notifications</div>
        <div class="tile-value">${fmt(s.push.players)}</div>
        <div class="tile-sub">of ${fmt(s.totalPlayers)} players can receive them</div>
      </div>
      <div class="tile">
        <div class="tile-label"><span class="dot" style="background:${s.email.configured ? COLORS.good : COLORS.neutral}"></span>Email</div>
        <div class="tile-value">${s.email.configured ? fmt(s.email.players) : 'Not set up'}</div>
        <div class="tile-sub">${s.email.configured ? `sent from ${esc(s.email.from)}` : 'add SMTP settings to the server'}</div>
      </div>`;
  }

  function renderNotifyForm() {
    const isEmail = notifyState.channel === 'email';
    document.querySelectorAll('.segmented [data-channel]').forEach((b) => {
      const on = b.dataset.channel === notifyState.channel;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('#email-setup').hidden = !(isEmail && notifyState.status && !notifyState.status.email.configured);
    $('#title-label').textContent = isEmail ? 'Subject' : 'Title';
    $('#pick-players').hidden = notifyState.audience !== 'players';
    $('#notify-chips').innerHTML = [...notifyState.selected].map(([id, name]) =>
      `<span class="chip">${esc(name)}<button type="button" data-remove="${id}" aria-label="Remove ${esc(name)}">×</button></span>`).join('');
    $('#title-count').textContent = `${$('#notify-title').value.length}/120`;
    $('#body-count').textContent = `${$('#notify-body').value.length}/3000`;
    renderNotifyPreview();
    updateSendButton();
  }

  function renderNotifyPreview() {
    const title = $('#notify-title').value.trim() || (notifyState.channel === 'email' ? 'Subject' : 'Title');
    const body = $('#notify-body').value.trim() || 'Your message will appear here.';
    $('#notify-preview').innerHTML = notifyState.channel === 'push'
      ? `<div class="phone"><div class="push-bubble">
          <div class="app-icon">R</div>
          <div class="push-meta"><span>Tokyo Revengers</span><span>now</span></div>
          <div class="push-title">${esc(title)}</div>
          <div class="push-body" style="grid-column:2">${esc(body)}</div>
        </div></div>
        <p class="muted small">How it looks on a phone. Long messages are cut off on the lock screen.</p>`
      : `<div class="email-preview">
          <div class="email-head"><strong>${esc(title)}</strong><br>From: ${esc(notifyState.status?.email.from || 'your SMTP address')}</div>
          <div class="email-body">Hi Player,\n\n${esc(body)}\n\n— Tokyo Revengers</div>
        </div>
        <p class="muted small">Every player gets their own email, so nobody sees other players' addresses.</p>`;
  }

  function notifyAudienceBody() {
    return { channel: notifyState.channel, audience: notifyState.audience, userIds: notifyState.audience === 'players' ? [...notifyState.selected.keys()] : undefined };
  }

  const updateReach = debounce(async () => {
    const reach = $('#notify-reach');
    if (notifyState.audience === 'players' && !notifyState.selected.size) {
      reach.textContent = 'Pick at least one player.';
      notifyState.reachable = 0;
      updateSendButton();
      return;
    }
    try {
      const { targeted, reachable } = (await api('/admin/notifications/preview', { method: 'POST', body: notifyAudienceBody() })).data;
      notifyState.reachable = reachable;
      const missing = targeted - reachable;
      const why = notifyState.channel === 'push' ? 'push notifications turned on yet' : 'an email address';
      reach.textContent = `Will reach ${fmt(reachable)} of ${fmt(targeted)} player${targeted === 1 ? '' : 's'}.`
        + (missing > 0 ? ` ${fmt(missing)} ${missing === 1 ? "doesn't" : "don't"} have ${why}.` : '');
    } catch (err) {
      reach.textContent = err.message;
      notifyState.reachable = 0;
    }
    updateSendButton();
  }, 250);

  function updateSendButton() {
    const blockedEmail = notifyState.channel === 'email' && notifyState.status && !notifyState.status.email.configured;
    const ready = $('#notify-title').value.trim() && $('#notify-body').value.trim() && notifyState.reachable > 0 && !blockedEmail;
    $('#notify-send').disabled = !ready;
    $('#notify-send').textContent = notifyState.channel === 'push' ? 'Send push notification' : 'Send email';
  }

  document.querySelectorAll('.segmented [data-channel]').forEach((b) => b.addEventListener('click', () => {
    notifyState.channel = b.dataset.channel;
    renderNotifyForm();
    updateReach();
  }));
  document.querySelectorAll('input[name="audience"]').forEach((r) => r.addEventListener('change', () => {
    notifyState.audience = r.value;
    renderNotifyForm();
    updateReach();
  }));
  ['#notify-title', '#notify-body'].forEach((sel) => $(sel).addEventListener('input', renderNotifyForm));

  $('#notify-search').addEventListener('input', debounce(async () => {
    const q = $('#notify-search').value.trim();
    if (!q) { $('#notify-results').innerHTML = ''; return; }
    try {
      const { players } = (await api(`/admin/players?search=${encodeURIComponent(q)}&limit=8&status=active`)).data;
      $('#notify-results').innerHTML = players.length ? players.map((p) => `
        <button type="button" data-add="${p._id}" data-name="${esc(p.name || p.email)}" ${notifyState.selected.has(p._id) ? 'disabled' : ''}>
          ${avatar(p)}<span><div class="player-name">${esc(p.name || '(no name)')}</div><div class="player-email">${esc(p.email)}</div></span>
        </button>`).join('') : '<p class="muted small">No active players found.</p>';
    } catch (err) {
      toast(err.message, true);
    }
  }, 300));

  $('#notify-results').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    notifyState.selected.set(btn.dataset.add, btn.dataset.name);
    btn.disabled = true;
    renderNotifyForm();
    updateReach();
  });
  $('#notify-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    notifyState.selected.delete(btn.dataset.remove);
    renderNotifyForm();
    updateReach();
  });

  $('#notify-send').addEventListener('click', () => {
    const kind = notifyState.channel === 'push' ? 'push notification' : 'email';
    openModal(`Send ${kind}?`, `
      <p>This sends <strong>"${esc($('#notify-title').value.trim())}"</strong> to <strong>${fmt(notifyState.reachable)}</strong> player${notifyState.reachable === 1 ? '' : 's'} right now. It can't be undone.</p>
      <div class="modal-actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-primary" id="notify-confirm">Send ${kind}</button>
      </div>`);
    $('#notify-confirm').addEventListener('click', async () => {
      $('#notify-confirm').disabled = true;
      try {
        await api('/admin/notifications/send', {
          method: 'POST',
          body: { ...notifyAudienceBody(), title: $('#notify-title').value.trim(), body: $('#notify-body').value.trim() },
        });
        closeModal();
        toast(`Sending your ${kind}…`);
        $('#notify-title').value = '';
        $('#notify-body').value = '';
        renderNotifyForm();
        notifyState.historyPage = 1;
        loadNotifyHistory();
      } catch (err) {
        closeModal();
        toast(err.message, true);
      }
    });
  });

  async function loadNotifyHistory() {
    clearTimeout(notifyState.pollTimer);
    try {
      const { items, pagination } = (await api(`/admin/notifications/history?page=${notifyState.historyPage}&limit=10`)).data;
      $('#notify-history').innerHTML = items.length ? items.map((n) => {
        const status = n.status === 'sending'
          ? '<span class="badge badge-sending">Sending…</span>'
          : n.status === 'failed'
            ? `<span class="badge badge-banned" title="${esc(n.error || '')}">Failed</span>`
            : `<span class="badge badge-active">Sent</span>`;
        const to = n.audience === 'all' ? 'All players' : `${fmt(n.players)} chosen`;
        return `<tr>
          <td>${new Date(n.createdAt).toLocaleString()}</td>
          <td>${n.channel === 'push' ? 'Push' : 'Email'}</td>
          <td title="${esc(n.body)}">${esc(n.title)}</td>
          <td>${to}</td>
          <td class="num">${fmt(n.sent)} / ${fmt(n.reachable)}${n.failed ? ` <span class="muted small">(${fmt(n.failed)} failed)</span>` : ''}</td>
          <td>${status}</td>
          <td>${esc(n.sentBy || '—')}</td>
        </tr>`;
      }).join('') : '<tr><td class="empty" colspan="7">Nothing sent yet.</td></tr>';
      renderPager('#notify-pager', pagination, 'sent', (page) => { notifyState.historyPage = page; loadNotifyHistory(); });

      // keep refreshing while something is still being sent
      if (items.some((n) => n.status === 'sending') && location.hash === '#notifications') {
        notifyState.pollTimer = setTimeout(loadNotifyHistory, 3000);
      }
    } catch (err) {
      toast(err.message, true);
    }
  }
  $('#notify-refresh').addEventListener('click', loadNotifyHistory);

  // ---------- rewards ----------
  const rewardsState = { saved: null, defaults: null, stages: [] };
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

  function numberInput(path, { min = 0, max = 100000 } = {}) {
    const value = getPath(rewardsState.saved, path);
    const def = getPath(rewardsState.defaults, path);
    return `<input class="num-input" type="number" inputmode="numeric" min="${min}" max="${max}" step="1"
      data-path="${path}" value="${value}" title="Default: ${def}" aria-label="${path}">`;
  }

  function rewardsMarkup() {
    const stageRows = rewardsState.saved.story.stages.map((s, i) => {
      const info = rewardsState.stages.find((x) => x.stage === s.stage) || {};
      return `<tr>
        <td><strong>${esc(info.code || s.stage)}</strong></td>
        <td>${esc(info.name || '')} ${info.boss ? '<span class="badge badge-banned">Boss</span>' : ''}</td>
        <td class="num">${numberInput(`story.stages.${i}.coins`)}</td>
        <td class="num">${numberInput(`story.stages.${i}.skillPoints`, { max: 1000 })}</td>
      </tr>`;
    }).join('');

    return `
      <div class="card">
        <h2>Multiplayer match result</h2>
        <div class="table-scroll"><table class="table reward-table">
          <thead><tr><th>Result</th><th class="num">Trophies</th><th class="num">XP</th><th class="num">Coins</th></tr></thead>
          <tbody>
            <tr><td>Win</td><td class="num">+ ${numberInput('match.trophies.won', { max: 1000 })}</td><td class="num">${numberInput('match.xp.won')}</td><td class="num">${numberInput('match.coins.won')}</td></tr>
            <tr><td>Draw</td><td class="num">+ ${numberInput('match.trophies.draw', { max: 1000 })}</td><td class="num">${numberInput('match.xp.draw')}</td><td class="num">${numberInput('match.coins.draw')}</td></tr>
            <tr><td>Loss</td><td class="num">− ${numberInput('match.trophies.lost', { max: 1000 })}</td><td class="num">${numberInput('match.xp.lost')}</td><td class="num">${numberInput('match.coins.lost')}</td></tr>
            <tr><td>Left early / host quit</td><td class="num">− ${numberInput('match.trophies.left', { max: 1000 })}</td><td class="num muted">0</td><td class="num muted">0</td></tr>
          </tbody>
        </table></div>
        <p class="muted small">Trophies never go below 0.</p>
      </div>

      <div class="card">
        <h2>Match bonuses</h2>
        <div class="field-grid">
          <label>XP per kill ${numberInput('match.xp.perKill')}</label>
          <label>XP per assist ${numberInput('match.xp.perAssist')}</label>
          <label>Max XP per match ${numberInput('match.xp.maxPerMatch')}</label>
          <label>MVP coins (1st) ${numberInput('match.coins.mvp1')}</label>
          <label>2nd place coins ${numberInput('match.coins.mvp2')}</label>
          <label>3rd place coins ${numberInput('match.coins.mvp3')}</label>
        </div>
        <p class="example" id="reward-example"></p>
      </div>

      <div class="card">
        <h2>Levels &amp; rules</h2>
        <div class="field-grid">
          <label>Trophies per level ${numberInput('match.trophiesPerLevel', { min: 1, max: 10000 })}
            <span class="muted small">Level = 1 + trophies ÷ this. Levels never go down.</span></label>
          <label>Shortest match that pays (seconds) ${numberInput('match.minMatchSeconds', { max: 600 })}
            <span class="muted small">Shorter matches give no rewards (stops quick-quit farming).</span></label>
        </div>
      </div>

      <div class="card">
        <h2>Story mode — first clear of each stage</h2>
        <div class="table-scroll"><table class="table reward-table">
          <thead><tr><th>Stage</th><th>Name</th><th class="num">Coins</th><th class="num">Skill points</th></tr></thead>
          <tbody>${stageRows}</tbody>
        </table></div>
        <div class="field-grid">
          <label>Shortest stage that pays (seconds) ${numberInput('story.minStageSeconds', { max: 600 })}
            <span class="muted small">Replays of a cleared stage give nothing.</span></label>
        </div>
      </div>`;
  }

  // Current form values as a settings object (numbers).
  function readRewardsForm() {
    const result = JSON.parse(JSON.stringify(rewardsState.saved));
    document.querySelectorAll('#rewards-form [data-path]').forEach((input) => {
      const keys = input.dataset.path.split('.');
      const last = keys.pop();
      const target = keys.reduce((o, k) => o[k], result);
      target[last] = input.value === '' ? NaN : Number(input.value);
    });
    return result;
  }

  function invalidRewardInputs() {
    return [...document.querySelectorAll('#rewards-form [data-path]')].filter((input) => {
      const v = Number(input.value);
      return input.value === '' || !Number.isInteger(v) || v < Number(input.min) || v > Number(input.max);
    });
  }

  function updateRewardsUi() {
    let dirty = false;
    document.querySelectorAll('#rewards-form [data-path]').forEach((input) => {
      const changed = String(getPath(rewardsState.saved, input.dataset.path)) !== input.value;
      input.classList.toggle('changed', changed);
      dirty = dirty || changed;
    });
    const invalid = invalidRewardInputs();
    document.querySelectorAll('#rewards-form [data-path]').forEach((i) => i.classList.toggle('invalid', invalid.includes(i)));
    $('#rewards-save').disabled = !dirty || invalid.length > 0;

    // Live example so the admin sees what a typical result pays.
    const s = readRewardsForm().match;
    if (invalid.length) {
      $('#reward-example').textContent = 'Fix the highlighted fields (whole numbers, 0 or more).';
      return;
    }
    const xp = Math.min(s.xp.won + 3 * s.xp.perKill + 2 * s.xp.perAssist, s.xp.maxPerMatch);
    $('#reward-example').innerHTML = `Example: a <strong>win</strong> with 3 kills and 2 assists as <strong>MVP</strong> pays
      <strong>+${fmt(s.trophies.won)} trophies</strong>, <strong>+${fmt(xp)} XP</strong>, <strong>+${fmt(s.coins.won + s.coins.mvp1)} coins</strong>.`;
  }

  function renderRewards(data) {
    rewardsState.saved = data.settings;
    rewardsState.defaults = data.defaults;
    rewardsState.stages = data.stages || [];
    $('#rewards-form').innerHTML = rewardsMarkup();
    $('#rewards-meta').textContent = data.updatedAt
      ? `Last saved ${new Date(data.updatedAt).toLocaleString()}${data.updatedBy ? ` by ${data.updatedBy}` : ''}.`
      : 'Using the default values (never changed).';
    updateRewardsUi();
  }

  async function loadRewards() {
    try {
      renderRewards((await api('/admin/settings/rewards')).data);
    } catch (err) {
      toast(err.message, true);
    }
  }

  $('#rewards-form').addEventListener('input', updateRewardsUi);

  $('#rewards-save').addEventListener('click', async () => {
    if (invalidRewardInputs().length) return;
    $('#rewards-save').disabled = true;
    try {
      const res = await api('/admin/settings/rewards', { method: 'PUT', body: readRewardsForm() });
      renderRewards(res.data);
      toast('Rewards saved. They apply to the next match or stage.');
    } catch (err) {
      toast(err.message, true);
      updateRewardsUi();
    }
  });

  $('#rewards-reset').addEventListener('click', () => {
    openModal('Reset all rewards?', `
      <p>Every reward goes back to its default value. Results already paid out are not changed.</p>
      <div class="modal-actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-danger" id="rewards-reset-confirm">Reset to defaults</button>
      </div>`);
    $('#rewards-reset-confirm').addEventListener('click', async () => {
      try {
        renderRewards((await api('/admin/settings/rewards/reset', { method: 'POST' })).data);
        closeModal();
        toast('Rewards reset to defaults.');
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  // ---------- store ----------
  // one card per game Store tab; the price currency of each tab is fixed by the game screen
  const STORE_SECTIONS = [
    { key: 'coins', title: 'Coins tab', gives: 'Coins given', price: 'Price (USD)', unit: '$', iap: true,
      note: 'Real-money packs. Put the product IDs exactly as created in App Store Connect and Google Play Console (for example com.tokyorevengers.game.coins_100). The game does not take real payments yet: these IDs are stored for when in-app purchases are added.' },
    { key: 'gems', title: 'Gems tab', gives: 'Gems given', price: 'Price', unit: 'coins',
      note: 'Players pay with coins.' },
    { key: 'diamonds', title: 'Diamonds tab', gives: 'Diamonds given', price: 'Price', unit: 'gems',
      note: 'Players pay with gems.' },
    { key: 'weapons', title: 'Weapons tab', gives: 'Text on card', price: 'Price', unit: 'diamonds', text: true,
      note: 'Shown in the game only. Buying weapons is not built in the game yet, so the Buy button says "Coming soon".' },
  ];
  const PRODUCT_ID_RE = /^$|^[A-Za-z0-9][A-Za-z0-9._]{0,99}$/;
  const storeState = { sections: {} };

  // character ascension rules (same page)
  const ASCENSION_FIELDS = ['diamonds', 'minWins', 'minLevel', 'chapter', 'attackBonus'];
  const ascensionState = { saved: null };

  async function loadAscension() {
    try {
      const { data } = await api('/admin/settings/ascension');
      ascensionState.saved = data.settings;
      $('#ascension-body').innerHTML = data.settings.stars.map((s, i) => `
        <tr data-star="${i}">
          <td class="col-slot"><strong>${'★'.repeat(s.star)}</strong></td>
          ${ASCENSION_FIELDS.map((f) => `<td class="col-num"><input type="number" min="0" step="1" data-field="${f}" value="${s[f]}" title="Document value: ${data.defaults.stars[i][f]}" aria-label="${f}"></td>`).join('')}
        </tr>`).join('');
      $('#ascension-meta').textContent = data.updatedAt
        ? `Last changed ${fmtDateTime(data.updatedAt)}${data.updatedBy ? ' by ' + data.updatedBy : ''}.`
        : 'These are the values from the game document (shards replaced by diamonds).';
      $('#ascension-save').disabled = true;
    } catch (err) {
      toast(err.message, true);
    }
  }

  function readAscension() {
    return {
      maxCharacters: ascensionState.saved.maxCharacters,
      stars: [...$('#ascension-body').querySelectorAll('tr')].map((tr) =>
        Object.fromEntries(ASCENSION_FIELDS.map((f) => [f, Number(tr.querySelector(`[data-field="${f}"]`).value)]))),
    };
  }

  $('#ascension-body').addEventListener('input', (e) => {
    const input = e.target;
    const n = Number(input.value);
    input.classList.toggle('invalid', input.value === '' || !Number.isInteger(n) || n < 0);
    const now = readAscension().stars;
    const changed = now.some((s, i) => ASCENSION_FIELDS.some((f) => s[f] !== ascensionState.saved.stars[i][f]));
    $('#ascension-save').disabled = !changed;
  });

  $('#ascension-save').addEventListener('click', async () => {
    if ($('#ascension-body').querySelector('input.invalid')) { toast('Fix the fields marked in red first', true); return; }
    $('#ascension-save').disabled = true;
    try {
      await api('/admin/settings/ascension', { method: 'PUT', body: readAscension() });
      toast('Character upgrades saved');
      loadAscension();
    } catch (err) {
      toast(err.message, true);
      $('#ascension-save').disabled = false;
    }
  });

  $('#ascension-reset').addEventListener('click', () => {
    openModal('Reset character upgrades?', `
      <p>Every star goes back to the document values. Stars players already bought are kept.</p>
      <div class="modal-actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-danger" id="ascension-reset-confirm">Reset upgrades</button>
      </div>`);
    $('#ascension-reset-confirm').addEventListener('click', async () => {
      try {
        await api('/admin/settings/ascension/reset', { method: 'POST' });
        closeModal();
        toast('Character upgrades reset to the document values');
        loadAscension();
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  // character unlock prices (same page)
  const unlockState = { saved: null };
  const unlockStatus = (price, currency) =>
    price === 0 ? '<span class="badge badge-active">Free for everyone</span>' : `<span class="badge badge-removed">Locked until bought (${fmt(price)} ${currency === 'coin' ? 'coins' : 'gems'})</span>`;

  async function loadUnlocks() {
    try {
      const { data } = await api('/admin/settings/characters');
      unlockState.saved = data.settings;
      $('#unlock-body').innerHTML = data.settings.characters.map((c) => `
        <tr data-index="${c.index}">
          <td class="col-slot"><strong>${c.index + 1}</strong></td>
          <td>${esc(c.name)}</td>
          <td class="col-num"><input type="number" min="0" step="1" data-field="price" value="${c.price}" aria-label="Unlock price"></td>
          <td class="col-num"><select data-field="currency" aria-label="Paid with">
            <option value="gem" ${c.currency === 'gem' ? 'selected' : ''}>Gems</option>
            <option value="coin" ${c.currency === 'coin' ? 'selected' : ''}>Coins</option>
          </select></td>
          <td class="unlock-status">${unlockStatus(c.price, c.currency)}</td>
        </tr>`).join('');
      $('#unlock-meta').textContent = data.updatedAt
        ? `Last changed ${fmtDateTime(data.updatedAt)}${data.updatedBy ? ' by ' + data.updatedBy : ''}.`
        : 'Default: the first character is free, the others cost 200 gems.';
      $('#unlock-save').disabled = true;
    } catch (err) {
      toast(err.message, true);
    }
  }

  function readUnlocks() {
    return {
      characters: [...$('#unlock-body').querySelectorAll('tr')].map((tr) => ({
        index: Number(tr.dataset.index),
        price: Number(tr.querySelector('[data-field="price"]').value),
        currency: tr.querySelector('[data-field="currency"]').value,
      })),
    };
  }

  const onUnlockEdit = (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const price = tr.querySelector('[data-field="price"]');
    const n = Number(price.value);
    price.classList.toggle('invalid', price.value === '' || !Number.isInteger(n) || n < 0);
    tr.querySelector('.unlock-status').innerHTML = unlockStatus(n, tr.querySelector('[data-field="currency"]').value);
    const changed = readUnlocks().characters.some((c, i) => c.price !== unlockState.saved.characters[i].price || c.currency !== unlockState.saved.characters[i].currency);
    $('#unlock-save').disabled = !changed;
  };
  $('#unlock-body').addEventListener('input', onUnlockEdit);
  $('#unlock-body').addEventListener('change', onUnlockEdit);

  $('#unlock-save').addEventListener('click', async () => {
    if ($('#unlock-body').querySelector('input.invalid')) { toast('Fix the fields marked in red first', true); return; }
    $('#unlock-save').disabled = true;
    try {
      await api('/admin/settings/characters', { method: 'PUT', body: readUnlocks() });
      toast('Character prices saved. Players see them next time they open Select a Character.');
      loadUnlocks();
    } catch (err) {
      toast(err.message, true);
      $('#unlock-save').disabled = false;
    }
  });

  $('#unlock-reset').addEventListener('click', () => {
    openModal('Reset character prices?', `
      <p>The first character becomes free and every other character costs 200 gems. Players keep characters they already unlocked.</p>
      <div class="modal-actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-danger" id="unlock-reset-confirm">Reset prices</button>
      </div>`);
    $('#unlock-reset-confirm').addEventListener('click', async () => {
      try {
        await api('/admin/settings/characters/reset', { method: 'POST' });
        closeModal();
        toast('Character prices reset');
        loadUnlocks();
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  async function loadStore() {
    loadUnlocks();
    loadAscension();
    try {
      const { data } = await api('/admin/shop/items');
      storeState.sections = data.sections;
      $('#store-meta').textContent = data.lastChange
        ? `Last changed ${fmtDateTime(data.lastChange.at)}${data.lastChange.by ? ' by ' + data.lastChange.by : ''}.`
        : 'These are the values from the game screens. Nothing has been changed yet.';
      $('#store-sections').innerHTML = STORE_SECTIONS.map(storeSectionMarkup).join('');
    } catch (err) {
      toast(err.message, true);
    }
  }

  function storeSectionMarkup(sec) {
    const items = storeState.sections[sec.key] || [];
    const rows = items.map((it) => `
      <tr data-id="${esc(it._id)}" class="${it.active ? '' : 'row-off'}">
        <td class="col-slot"><strong>#${it.slot}</strong></td>
        <td><input type="text" data-field="title" maxlength="40" value="${esc(it.title)}" aria-label="Title"></td>
        <td class="col-num">${sec.text
          ? `<input type="text" data-field="description" maxlength="80" value="${esc(it.description)}" placeholder="(empty)" aria-label="Text on card">`
          : `<input type="number" data-field="amount" min="0" step="1" value="${it.amount}" aria-label="${sec.gives}">`}</td>
        <td class="col-num"><div class="price-cell">${sec.unit === '$' ? '<span class="unit">$</span>' : ''}
          <input type="number" data-field="price" min="0" step="${sec.unit === '$' ? '0.01' : '1'}" value="${it.price}" aria-label="Price">
          ${sec.unit === '$' ? '' : `<span class="unit">${sec.unit}</span>`}</div></td>
        ${sec.iap ? `
          <td class="col-id"><input type="text" data-field="iosProductId" maxlength="100" value="${esc(it.iosProductId)}" placeholder="iOS product ID" aria-label="iOS product ID"></td>
          <td class="col-id"><input type="text" data-field="androidProductId" maxlength="100" value="${esc(it.androidProductId)}" placeholder="Android product ID" aria-label="Android product ID"></td>` : ''}
        <td class="col-on"><input type="checkbox" data-field="active" ${it.active ? 'checked' : ''} aria-label="Show in game"></td>
      </tr>`).join('');

    return `
      <div class="card" data-section="${sec.key}">
        <h2>${sec.title} <span class="muted small">${items.length} cards</span></h2>
        <div class="table-scroll"><table class="table store-table">
          <thead><tr>
            <th class="col-slot">Card</th><th>Title</th><th class="col-num">${sec.gives}</th><th class="col-num">${sec.price}</th>
            ${sec.iap ? '<th class="col-id">iOS product ID (App Store)</th><th class="col-id">Android product ID (Google Play)</th>' : ''}
            <th class="col-on">Show</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        <div class="section-foot">
          <p class="note">${sec.note}</p>
          <button class="btn btn-primary" data-store-save="${sec.key}" type="button" disabled>Save ${sec.title.toLowerCase()}</button>
        </div>
      </div>`;
  }

  function readStoreRow(tr) {
    const value = (field) => tr.querySelector(`[data-field="${field}"]`);
    const out = {};
    for (const field of ['title', 'description', 'iosProductId', 'androidProductId']) {
      if (value(field)) out[field] = value(field).value.trim();
    }
    for (const field of ['amount', 'price']) {
      if (value(field)) out[field] = Number(value(field).value);
    }
    out.active = value('active').checked;
    return out;
  }

  function storeRowChanges(section, tr) {
    const original = (storeState.sections[section] || []).find((it) => it._id === tr.dataset.id);
    const now = readStoreRow(tr);
    return Object.fromEntries(Object.entries(now).filter(([k, v]) => original[k] !== v));
  }

  function validateStoreRow(section, tr) {
    let ok = true;
    tr.querySelectorAll('input').forEach((input) => {
      let bad = false;
      const field = input.dataset.field;
      if (field === 'iosProductId' || field === 'androidProductId') bad = !PRODUCT_ID_RE.test(input.value.trim());
      if (field === 'amount' || field === 'price') {
        const n = Number(input.value);
        bad = input.value === '' || !Number.isFinite(n) || n < 0 || (section !== 'coins' && field === 'price' && !Number.isInteger(n)) || (field === 'amount' && !Number.isInteger(n));
      }
      if (field === 'title') bad = !input.value.trim();
      input.classList.toggle('invalid', bad);
      if (bad) ok = false;
    });
    return ok;
  }

  $('#store-sections').addEventListener('input', (e) => {
    const card = e.target.closest('[data-section]');
    const tr = e.target.closest('tr[data-id]');
    if (!card || !tr) return;
    const section = card.dataset.section;
    validateStoreRow(section, tr);
    tr.classList.toggle('row-dirty', Object.keys(storeRowChanges(section, tr)).length > 0);
    tr.classList.toggle('row-off', !tr.querySelector('[data-field="active"]').checked);
    card.querySelector('[data-store-save]').disabled = !card.querySelector('tr.row-dirty');
  });

  $('#store-sections').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-store-save]');
    if (!btn) return;
    const section = btn.dataset.storeSave;
    const card = btn.closest('[data-section]');
    const dirty = [...card.querySelectorAll('tr.row-dirty')];
    if (!dirty.every((tr) => validateStoreRow(section, tr))) { toast('Fix the fields marked in red first', true); return; }

    btn.disabled = true;
    let saved = 0;
    try {
      for (const tr of dirty) {
        const changes = storeRowChanges(section, tr);
        const { data } = await api(`/admin/shop/items/${tr.dataset.id}`, { method: 'PUT', body: changes });
        const list = storeState.sections[section];
        list[list.findIndex((it) => it._id === data._id)] = data;
        tr.classList.remove('row-dirty');
        saved++;
      }
      toast(`Saved ${saved} card${saved === 1 ? '' : 's'}. Players see it next time they open the Store.`);
      loadStore();
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
    }
  });

  // the dirty-check listener above only reacts to "input"; checkboxes fire "change" in some browsers
  $('#store-sections').addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') e.target.dispatchEvent(new Event('input', { bubbles: true }));
  });

  $('#store-reset').addEventListener('click', () => {
    openModal('Reset the store?', `
      <p>Every card goes back to the values from the game screens and is shown again. In-app product IDs are kept.</p>
      <div class="modal-actions">
        <button class="btn" data-close>Cancel</button>
        <button class="btn btn-danger" id="store-reset-confirm">Reset store</button>
      </div>`);
    $('#store-reset-confirm').addEventListener('click', async () => {
      try {
        await api('/admin/shop/reset', { method: 'POST' });
        closeModal();
        toast('Store reset to the game defaults');
        loadStore();
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  // ---------- support ----------
  const CATEGORY_LABELS = {
    bug: 'Bug report', feedback: 'Feedback / idea', account: 'Account / login',
    payment: 'Payment / purchase', report_player: 'Report a player', other: 'Other',
  };
  const STATUS_LABELS = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };
  const supportState = { page: 1, limit: 20 };

  const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const ticketStatus = (s) => `<span class="badge badge-${esc(s)}">${STATUS_LABELS[s] || esc(s)}</span>`;

  // sidebar me laal number: kitne tickets pe player ka naya message hai
  async function refreshSupportCount() {
    try {
      const { data } = await api('/admin/support/stats');
      const el = $('#support-count');
      el.textContent = data.unread > 99 ? '99+' : data.unread;
      el.hidden = !data.unread;
      return data;
    } catch {
      return null;
    }
  }

  async function loadSupport() {
    const params = new URLSearchParams({
      page: supportState.page, limit: supportState.limit,
      status: $('#support-status').value, category: $('#support-category').value,
    });
    const search = $('#support-search').value.trim();
    if (search) params.set('search', search);

    try {
      const [stats, res] = await Promise.all([refreshSupportCount(), api(`/admin/support/tickets?${params}`)]);
      if (stats) {
        const tiles = [
          { label: 'Waiting for reply', value: stats.unread, dot: COLORS.critical, sub: 'new player messages' },
          { label: 'Open', value: stats.open, sub: 'not answered yet' },
          { label: 'In progress', value: stats.inProgress, sub: 'being handled' },
          { label: 'Resolved', value: stats.resolved, dot: COLORS.good, sub: `${fmt(stats.closed)} closed` },
        ];
        $('#support-tiles').innerHTML = tiles.map((t) => `
          <div class="tile">
            <div class="tile-label">${t.dot ? `<span class="dot" style="background:${t.dot}"></span>` : ''}${t.label}</div>
            <div class="tile-value">${fmt(t.value)}</div>
            <div class="tile-sub">${t.sub}</div>
          </div>`).join('');
      }

      const { tickets, pagination } = res.data;
      $('#support-body').innerHTML = tickets.length ? tickets.map((t) => `
        <tr class="ticket-row ${t.unread ? 'unread' : ''}" data-id="${esc(t._id)}">
          <td><div class="ticket-code">${esc(t.code)}</div><div class="ticket-subject">${esc(t.subject)}</div></td>
          <td><div class="player-name">${esc(t.playerName || '(no name)')}</div><div class="player-email">${esc(t.playerEmail)}</div></td>
          <td>${CATEGORY_LABELS[t.category] || esc(t.category)}</td>
          <td><div class="ticket-preview">${t.lastMessageFrom === 'admin' ? '<span class="muted">You: </span>' : ''}${esc(t.lastMessage)}</div></td>
          <td>${fmtDateTime(t.lastMessageAt)}</td>
          <td>${ticketStatus(t.status)}</td>
        </tr>`).join('') : '<tr><td class="empty" colspan="6">No support requests here. 🎉</td></tr>';
      renderPager('#support-pager', pagination, 'tickets', (page) => { supportState.page = page; loadSupport(); });
    } catch (err) {
      toast(err.message, true);
    }
  }

  $('#support-search').addEventListener('input', debounce(() => { supportState.page = 1; loadSupport(); }, 300));
  $('#support-status').addEventListener('change', () => { supportState.page = 1; loadSupport(); });
  $('#support-category').addEventListener('change', () => { supportState.page = 1; loadSupport(); });
  $('#support-body').addEventListener('click', (e) => {
    const row = e.target.closest('.ticket-row');
    if (row) showTicket(row.dataset.id);
  });

  async function showTicket(id) {
    try {
      const t = (await api(`/admin/support/tickets/${id}`)).data;
      const p = t.player || {};
      const device = [t.platform, t.deviceModel, t.appVersion && `v${t.appVersion}`].filter(Boolean).map(esc).join(' · ') || '—';
      const playerStatus = p.isDeleted ? ' <span class="badge badge-removed">Removed</span>' : p.isBanned ? ' <span class="badge badge-banned">Banned</span>' : '';

      openModal(`${t.code} · ${t.subject}`, `
        <div class="ticket-meta">
          <span>Player <strong>${esc(t.playerName || p.name || '(no name)')}</strong> ${esc(t.playerEmail)}${playerStatus}</span>
          <span>Category <strong>${CATEGORY_LABELS[t.category] || esc(t.category)}</strong></span>
          <span>Status ${ticketStatus(t.status)}</span>
          <span>Device <strong>${device}</strong></span>
          <span>Opened <strong>${fmtDateTime(t.createdAt)}</strong></span>
        </div>
        <div class="thread" id="ticket-thread">
          ${(t.messages || []).map((m) => `
            <div class="msg ${m.from === 'admin' ? 'msg-admin' : 'msg-player'}">
              <div class="msg-head">${m.from === 'admin' ? 'Support team' : esc(t.playerName || 'Player')} · ${fmtDateTime(m.createdAt)}</div>
              <div class="msg-text">${esc(m.text)}</div>
            </div>`).join('')}
        </div>
        <div class="reply-box">
          <textarea id="ticket-reply" maxlength="2000" placeholder="Write a reply to the player… (they'll see it in the game)"></textarea>
          <div class="reply-actions">
            <div class="left">
              <label class="muted small" for="ticket-next-status">After sending, mark as</label>
              <select id="ticket-next-status">
                <option value="">${t.status === 'open' ? 'In progress' : 'Keep ' + (STATUS_LABELS[t.status] || t.status)}</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div class="right">
              ${t.status === 'closed' || t.status === 'resolved'
                ? `<button class="btn btn-sm" data-ticket-status="open">Reopen</button>`
                : `<button class="btn btn-sm" data-ticket-status="resolved">Mark resolved</button><button class="btn btn-sm" data-ticket-status="closed">Close</button>`}
              <button class="btn btn-primary" id="ticket-send">Send reply</button>
            </div>
          </div>
        </div>`, true);

      const thread = $('#ticket-thread');
      thread.scrollTop = thread.scrollHeight;
      refreshSupportCount();

      $('#ticket-send').addEventListener('click', async (e) => {
        const message = $('#ticket-reply').value.trim();
        if (!message) { toast('Write a reply first', true); return; }
        e.target.disabled = true;
        try {
          const status = $('#ticket-next-status').value || undefined;
          await api(`/admin/support/tickets/${id}/reply`, { method: 'POST', body: { message, status } });
          toast('Reply sent to the player');
          showTicket(id);
          loadSupport();
        } catch (err) {
          toast(err.message, true);
          e.target.disabled = false;
        }
      });
      document.querySelectorAll('[data-ticket-status]').forEach((b) => b.addEventListener('click', async () => {
        try {
          await api(`/admin/support/tickets/${id}/status`, { method: 'PATCH', body: { status: b.dataset.ticketStatus } });
          toast(`Ticket marked ${STATUS_LABELS[b.dataset.ticketStatus].toLowerCase()}`);
          showTicket(id);
          loadSupport();
        } catch (err) {
          toast(err.message, true);
        }
      }));
    } catch (err) {
      toast(err.message, true);
    }
  }

  // ---------- start ----------
  if (auth.token) startApp(); else showLogin();
})();
