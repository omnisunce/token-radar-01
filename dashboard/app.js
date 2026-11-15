// Token Radar page: renders window.RADAR (written by main.ts) into the board,
// the filters and the per-protocol detail view. No network, no framework.
(function () {
  var D = window.RADAR;
  if (!D) return;
  var rows = D.rows.map(function (r) {
    return {
      slug: r[0], name: r[1], category: r[2], chains: r[3] ? r[3].split('|') : [],
      tvl: r[4], change: r[5], age: r[6], implied: r[7], multiple: r[8],
      peers: r[9], conf: r[10], watch: r[11] === 1, steps: r[12],
    };
  });

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(c) {
    if (c === null || c === undefined) return '<span class="flat">—</span>';
    var cls = c > 0 ? 'up' : c < 0 ? 'down' : 'flat';
    return '<span class="' + cls + '">' + (c > 0 ? '+' : '') + c.toFixed(1) + '%</span>';
  }
  function ageText(days) {
    if (days === null || days === undefined) return '—';
    return days >= 365 ? (days / 365).toFixed(1) + 'y' : days + 'd';
  }
  function confText(c) { return c === 2 ? 'High' : c === 1 ? 'Medium' : 'Low'; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function factors(row) {
    var growth = 1 + (0.5 * clamp(row.change === null ? 0 : row.change, -30, 100)) / 100;
    var ageF = row.age === null ? 1 : 1 + 0.15 * Math.min(Math.log1p(row.age / 365), 1.5);
    var breadth = 1 + 0.02 * Math.min(Math.max(row.chains.length - 1, 0), 5);
    return { growth: growth, age: ageF, breadth: breadth };
  }
  function primaryChain(row) { return row.chains[0] || 'Ethereum'; }

  // ---- header stats -------------------------------------------------------
  var total = D.meta.total_implied_usd;
  document.getElementById('stats').innerHTML =
    '<div class="stat"><b>' + rows.length + '</b><span>Protocols tracked</span></div>' +
    '<div class="stat"><b>' + D.meta.watchlist + '</b><span>Watchlist</span></div>' +
    '<div class="stat"><b>' + D.meta.eligible + '</b><span>Farmable in snapshot</span></div>' +
    '<div class="stat"><b>' + money(total) + '</b><span>Total implied value</span></div>';
  document.getElementById('asof').textContent = D.meta.as_of;
  document.getElementById('asof2').textContent = D.meta.as_of;

  // ---- filter controls ----------------------------------------------------
  var catSel = document.getElementById('cat');
  var chainSel = document.getElementById('chain');
  var cats = [], chains = [];
  rows.forEach(function (r) {
    if (cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort().forEach(function (c) {
    catSel.insertAdjacentHTML('beforeend', '<option>' + esc(c) + '</option>');
  });
  chains.sort().forEach(function (c) {
    chainSel.insertAdjacentHTML('beforeend', '<option>' + esc(c) + '</option>');
  });

  var state = { q: '', cat: '', chain: '', status: 'all', sort: 'implied' };
  var params = new URLSearchParams(location.search);
  if (params.get('status') === 'watchlist' || params.get('status') === 'early') state.status = params.get('status');
  if (params.get('cat')) state.cat = params.get('cat');
  if (params.get('sort')) state.sort = params.get('sort');

  var tbody = document.getElementById('tbody');
  var countEl = document.getElementById('count');
  var selectedSlug = null;

  function visible() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.status === 'watchlist' && !r.watch) return false;
      if (state.status === 'early' && r.watch) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (state.sort === 'tvl') list.sort(function (a, b) { return b.tvl - a.tvl; });
    else if (state.sort === 'growth') list.sort(function (a, b) { return (b.change || 0) - (a.change || 0); });
    else if (state.sort === 'age') list.sort(function (a, b) { return (b.age || 0) - (a.age || 0); });
    else list.sort(function (a, b) { return b.implied - a.implied; });
    return list;
  }

  function render() {
    var list = visible();
    var shown = list.reduce(function (n, r) { return n + r.implied; }, 0);
    countEl.textContent = 'Showing ' + list.length + ' of ' + rows.length + ' protocols · ' + money(shown) + ' implied value in view';
    tbody.innerHTML = list.map(function (r, i) {
      var rank = rows.indexOf(r) + 1;
      return '<tr data-slug="' + esc(r.slug) + '" class="' + (rank <= 3 ? 'top3' : '') + (r.slug === selectedSlug ? ' sel' : '') + '">' +
        '<td class="r rank">' + rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span><span class="sub">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category) + '</td>' +
        '<td>' + esc(r.chains.slice(0, 2).join(', ')) + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
        '<td class="r">' + money(r.tvl) + '</td>' +
        '<td class="r">' + pct(r.change) + '</td>' +
        '<td class="r">' + ageText(r.age) + '</td>' +
        '<td class="r value">' + money(r.implied) + '</td>' +
        '<td><span class="badge ' + (r.watch ? 'watch' : 'early') + '">' + (r.watch ? 'Watchlist' : 'Early') + '</span> <span class="conf"><b>' + confText(r.conf) + '</b></span></td>' +
        '</tr>';
    }).join('');
  }

  // ---- detail view ---------------------------------------------------------
  var detailEl = document.getElementById('detail');
  function showDetail(slug) {
    var r = null;
    rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) { detailEl.hidden = true; selectedSlug = null; render(); return; }
    selectedSlug = slug;
    var f = factors(r);
    var rank = rows.indexOf(r) + 1;
    var steps = r.steps.map(function (k) { return window.expandStep(k, r.name, primaryChain(r)); });
    detailEl.innerHTML =
      '<h2>#' + rank + ' · ' + esc(r.name) + '</h2>' +
      '<p class="lede">' + esc(r.slug) + ' · ' + esc(r.category) + ' · ' + esc(r.chains.join(', ')) +
      ' · <span class="badge ' + (r.watch ? 'watch' : 'early') + '">' + (r.watch ? 'On the watchlist' : 'Early find') + '</span></p>' +
      '<div class="facts">' +
      '<div class="fact"><b>' + moneyFull(r.implied) + '</b><span>Implied value</span></div>' +
      '<div class="fact"><b>' + money(r.tvl) + '</b><span>TVL</span></div>' +
      '<div class="fact"><b>' + (r.change === null ? '—' : (r.change > 0 ? '+' : '') + r.change.toFixed(1) + '%') + '</b><span>TVL, 7 days</span></div>' +
      '<div class="fact"><b>' + ageText(r.age) + '</b><span>Running, no token</span></div>' +
      '<div class="fact"><b>' + r.multiple.toFixed(3) + '×</b><span>Peer multiple (' + r.peers + ' peers)</span></div>' +
      '<div class="fact"><b>' + confText(r.conf) + '</b><span>Confidence</span></div>' +
      '</div>' +
      '<h3>How the value is built</h3>' +
      '<p class="formula"><code>' + money(r.tvl) + ' TVL × ' + r.multiple.toFixed(3) + ' peer multiple × ' +
      f.growth.toFixed(3) + ' growth × ' + f.age.toFixed(3) + ' age × ' + f.breadth.toFixed(3) +
      ' breadth ≈ ' + moneyFull(r.implied) + '</code><br>Peer multiple: the median market-cap-per-TVL of the ' +
      r.peers + ' traded ' + esc(r.category) + ' protocols in the snapshot, shrunk toward the global median of ' +
      D.meta.global_multiple.toFixed(3) + '×. The snapshot records no token for ' + esc(r.name) +
      ' — that is the record, not proof it has none.</p>' +
      '<h3>How to farm it</h3>' +
      '<ol class="steps">' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    detailEl.hidden = false;
    render();
    detailEl.scrollIntoView({ block: 'nearest' });
  }

  // ---- comparables ---------------------------------------------------------
  document.getElementById('peers').innerHTML = D.comp.map(function (c) {
    var ratio = c[4] / c[3];
    return '<tr><td><span class="name">' + esc(c[1]) + '</span><span class="sub">' + esc(c[0]) + '</span></td>' +
      '<td>' + esc(c[2]) + '</td><td class="r">' + money(c[3]) + '</td><td class="r">' + money(c[4]) +
      '</td><td class="r">' + ratio.toFixed(2) + '×</td></tr>';
  }).join('');

  // ---- events --------------------------------------------------------------
  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  catSel.addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  chainSel.addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  document.querySelectorAll('.pills button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.pills button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      state.status = b.getAttribute('data-status');
      render();
    });
  });
  tbody.addEventListener('click', function (e) {
    var tr = e.target.closest('tr');
    if (tr) {
      history.replaceState(null, '', '#/protocol/' + tr.getAttribute('data-slug'));
      showDetail(tr.getAttribute('data-slug'));
    }
  });
  window.addEventListener('hashchange', function () {
    var m = location.hash.match(/^#\/protocol\/(.+)$/);
    if (m) showDetail(m[1]);
  });

  // ---- initial state -------------------------------------------------------
  if (state.status !== 'all') {
    document.querySelectorAll('.pills button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-status') === state.status);
    });
  }
  if (state.cat) catSel.value = state.cat;
  if (state.sort) document.getElementById('sort').value = state.sort;
  render();
  var detailParam = params.get('detail');
  var hashMatch = location.hash.match(/^#\/protocol\/(.+)$/);
  if (detailParam) showDetail(detailParam);
  else if (hashMatch) showDetail(hashMatch[1]);
})();
