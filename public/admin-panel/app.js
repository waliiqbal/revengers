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
    totalXp: 'Total XP', level: 'Level', won: 'Wins', kills: 'Kills', totalMatch: 'Matches played', hours: 'Hours played',
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
  const views = { overview: loadOverview, players: loadPlayers, leaderboard: loadLeaderboard };

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
        ['Level', fmt(p.level)], ['Total XP', fmt(p.totalXp)], ['Matches', fmt(p.totalMatch)], ['Win rate', winRate(p)],
        ['Wins', fmt(p.won)], ['Losses', fmt(p.lost)], ['K/D', kd(p)], ['Hours', fmt(p.hours)],
        ['Coins', fmt(p.coin)], ['Gems', fmt(p.gem)], ['Diamonds', fmt(p.diamond)], ['Assists', fmt(p.assists)],
      ];
      const games = recentGames.map((g) => {
        const me = (g.players || []).find((x) => String(x.user) === String(p._id)) || {};
        return `<tr><td>${fmtDate(g.createdAt)}</td>
          <td>${me.result ? '<span class="badge badge-win">Won</span>' : '<span class="badge badge-loss">Lost</span>'}</td>
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
          <td class="num">${fmt(p.level)}</td><td class="num">${fmt(p.totalXp)}</td><td class="num">${fmt(p.won)}</td>
          <td class="num">${fmt(p.kills)}</td><td class="num">${fmt(p.totalMatch)}</td><td class="num">${fmt(p.hours)}</td>
        </tr>`).join('') : '<tr><td class="empty" colspan="8">No players yet.</td></tr>';
      renderPager('#lb-pager', pagination, 'players', (page) => { lbState.page = page; loadLeaderboard(); });
    } catch (err) {
      toast(err.message, true);
    }
  }

  $('#lb-metric').addEventListener('change', () => { lbState.page = 1; loadLeaderboard(); });

  // ---------- start ----------
  if (auth.token) startApp(); else showLogin();
})();
