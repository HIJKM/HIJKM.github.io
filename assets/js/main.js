document.addEventListener('DOMContentLoaded', function () {

  /* ══════════════════════════════════════
     Shared data cache
     ══════════════════════════════════════ */
  let _graphData = null;
  function fetchGraphData() {
    if (_graphData) return Promise.resolve(_graphData);
    const base = window.SITE_BASEURL || '';
    return fetch(`${base}/graph-data.json`)
      .then(r => r.json())
      .then(d => { _graphData = d; return d; });
  }

  /* ══════════════════════════════════════
     Graph modal (explore 버튼)
     ══════════════════════════════════════ */
  const exploreBtn  = document.getElementById('explore-btn');
  const modal       = document.getElementById('graph-modal');
  const closeBtn    = document.getElementById('graph-modal-close');
  const backdrop    = modal?.querySelector('.graph-modal-backdrop');

  let graphInited = false;

  function openModal() {
    modal?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (!graphInited) { graphInited = true; initModalGraph(); }
  }

  function closeModal() {
    modal?.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  exploreBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  /* ══════════════════════════════════════
     Inline header search
     ══════════════════════════════════════ */
  const headerSearch   = document.getElementById('header-search');
  const searchBtn      = document.getElementById('search-btn');
  const searchInput    = document.getElementById('search-input');
  const searchResults  = document.getElementById('search-results');
  const searchDropdown = document.getElementById('search-dropdown');

  let posts = null;

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function loadPosts() {
    if (posts !== null) return;
    try { const data = await fetchGraphData(); posts = data.nodes || []; }
    catch (e) { posts = []; }
  }

  function openSearch() {
    headerSearch?.classList.add('is-open');
    searchInput?.focus();       // 동기 호출 → 모바일 키보드 즉시 팝업
    loadPosts();
  }

  function closeSearch() {
    if (!headerSearch?.classList.contains('is-open')) return;
    headerSearch.classList.remove('is-open');
    searchDropdown?.classList.remove('is-open');
    if (searchInput)   searchInput.value = '';
    if (searchResults) searchResults.innerHTML = '';
    searchInput?.blur();
  }

  searchBtn?.addEventListener('click', e => {
    e.stopPropagation();
    headerSearch?.classList.contains('is-open') ? closeSearch() : openSearch();
  });

  // pointerdown = 모바일에서 click보다 빠르게 반응
  document.addEventListener('pointerdown', e => {
    if (headerSearch && !headerSearch.contains(e.target) &&
        searchDropdown && !searchDropdown.contains(e.target)) closeSearch();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSearch(); closeModal(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  });

  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchDropdown?.classList.remove('is-open'); if (searchResults) searchResults.innerHTML = ''; return; }

    const matches = (posts || []).filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    );

    if (searchResults) {
      searchResults.innerHTML = matches.length
        ? matches.map(p => `
            <a class="search-result" href="${p.url}">
              <span class="search-result-title">${p.title}</span>
              <span class="search-result-date">${fmtDate(p.date)}</span>
            </a>`).join('')
        : '<p class="search-empty">No results found.</p>';
    }
    searchDropdown?.classList.toggle('is-open', !!q);
  });

  /* ══════════════════════════════════════
     Activity Heatmap — animated expand/collapse
     ══════════════════════════════════════ */
  const miniEl         = document.getElementById('heatmap-mini');
  const heatmapSection = document.getElementById('heatmap-section');
  const heatmapInner   = document.getElementById('heatmap-inner');
  const heatmapSummary = heatmapSection?.querySelector('.heatmap-summary');
  let heatmapInited    = false;

  /* 미니 히트맵 (접힌 요약줄) */
  if (miniEl) {
    fetchGraphData()
      .then(d => renderMiniHeatmap(d.nodes || []))
      .catch(() => renderMiniHeatmap([]));
  }

  function renderMiniHeatmap(nodes) {
    const el = document.getElementById('heatmap-mini');
    if (!el) return;
    const dateMap = {};
    nodes.forEach(n => { if (n.date) dateMap[n.date] = (dateMap[n.date] || 0) + 1; });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 9; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key   = d.toISOString().slice(0, 10);
      const count = dateMap[key] || 0;
      const cell  = document.createElement('div');
      cell.className = 'hm-mini-cell';
      if (count > 0) cell.classList.add(count >= 4 ? 'hm-l4' : count === 3 ? 'hm-l3' : count === 2 ? 'hm-l2' : 'hm-l1');
      el.appendChild(cell);
    }
  }

  /* summary 클릭 → 커스텀 애니메이션으로 처리 */
  if (heatmapSummary) {
    heatmapSummary.addEventListener('click', e => {
      e.preventDefault();
      heatmapSection.open ? collapseHeatmap() : expandHeatmap();
    });
  }

  function expandHeatmap() {
    /* ① 미니 셀들을 날려 보낸다 (왼→오 순서) */
    const miniCells = [...document.querySelectorAll('.hm-mini-cell')];
    miniCells.forEach((c, i) => {
      c.style.transition = `transform 200ms ${i * 20}ms ease, opacity 200ms ${i * 20}ms ease`;
      c.style.transform  = 'scale(1.9) translateY(-4px)';
      c.style.opacity    = '0';
    });

    /* ② details 열기 + inner 슬라이드 준비 */
    heatmapSection.setAttribute('open', '');
    if (heatmapInner) {
      heatmapInner.style.height   = '0';
      heatmapInner.style.overflow = 'hidden';
      heatmapInner.style.opacity  = '1';
    }

    const doSlide = () => {
      if (!heatmapInner) return;
      const targetH = heatmapInner.scrollHeight;
      requestAnimationFrame(() => {
        heatmapInner.style.transition = 'height 360ms cubic-bezier(0.4,0,0.2,1)';
        heatmapInner.style.height     = targetH + 'px';
        heatmapInner.addEventListener('transitionend', () => {
          heatmapInner.style.cssText = '';  // inline 전부 해제
          staggerColumnsIn();
        }, { once: true });
      });
    };

    /* ③ 데이터 lazy 로드 후 슬라이드 */
    if (!heatmapInited) {
      heatmapInited = true;
      fetchGraphData()
        .then(d => { renderHeatmap(d.nodes || []); doSlide(); })
        .catch(() => { renderHeatmap([]); doSlide(); });
    } else {
      requestAnimationFrame(doSlide);
    }
  }

  function collapseHeatmap() {
    /* ① 컬럼들을 오→왼 순서로 stagger out */
    const cells    = [...document.querySelectorAll('.hm-cell')];
    const colCount = cells.length ? Math.ceil(cells.length / 7) : 0;
    cells.forEach((c, i) => {
      const col   = Math.floor(i / 7);
      const delay = (colCount - 1 - col) * 8;
      c.style.transition = `opacity 140ms ${delay}ms ease, transform 140ms ${delay}ms ease`;
      c.style.opacity    = '0';
      c.style.transform  = 'translateY(-3px)';
    });

    /* ② 셀 애니메이션 끝나면 inner 슬라이드 업 */
    const waitMs = colCount * 8 + 160;
    setTimeout(() => {
      if (!heatmapInner) { heatmapSection.open = false; return; }
      heatmapInner.style.height   = heatmapInner.offsetHeight + 'px';
      heatmapInner.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        heatmapInner.style.transition = 'height 300ms cubic-bezier(0.4,0,0.2,1)';
        heatmapInner.style.height     = '0';
        heatmapInner.addEventListener('transitionend', () => {
          /* ③ details 닫기 */
          heatmapSection.removeAttribute('open');
          heatmapInner.style.cssText = '';
          /* ④ 미니 셀들이 스프링처럼 돌아온다 */
          const minis = [...document.querySelectorAll('.hm-mini-cell')];
          minis.forEach(c => { c.style.transition = 'none'; c.style.transform = 'scale(0)'; c.style.opacity = '0'; });
          requestAnimationFrame(() => {
            minis.forEach((c, i) => {
              c.style.transition = `transform 280ms ${i * 28}ms cubic-bezier(0.34,1.56,0.64,1),
                                    opacity    180ms ${i * 28}ms ease`;
              c.style.transform  = '';
              c.style.opacity    = '';
            });
          });
        }, { once: true });
      });
    }, waitMs);
  }

  function staggerColumnsIn() {
    const cells = [...document.querySelectorAll('.hm-cell')];
    /* 먼저 모두 숨김 */
    cells.forEach(c => { c.style.opacity = '0'; c.style.transform = 'translateY(-6px)'; c.style.transition = 'none'; });
    requestAnimationFrame(() => {
      cells.forEach((c, i) => {
        const col = Math.floor(i / 7);
        c.style.transition = `opacity 220ms ${col * 12}ms ease, transform 220ms ${col * 12}ms ease`;
        c.style.opacity    = '1';
        c.style.transform  = '';
      });
    });
  }

  function renderHeatmap(nodes) {
    const grid     = document.getElementById('heatmap-grid');
    const monthsEl = document.getElementById('heatmap-months');
    const tooltip  = document.getElementById('heatmap-tooltip');
    if (!grid) return;

    const WEEKS = 26, CELL_GAP = 2;
    const colsEl   = document.querySelector('.heatmap-cols');
    const availW   = colsEl ? colsEl.clientWidth : 600;
    const cellSize = Math.max(10, Math.floor((availW - (WEEKS - 1) * CELL_GAP) / WEEKS));
    document.documentElement.style.setProperty('--hm-cell', cellSize + 'px');

    const CELL_STEP = cellSize + CELL_GAP;
    const MONTHS    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dateMap   = {};
    nodes.forEach(n => { if (n.date) dateMap[n.date] = (dateMap[n.date] || 0) + 1; });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - WEEKS * 7 + 1 - start.getDay());

    let lastMonth = -1, colIndex = 0;
    const cur = new Date(start);
    while (cur <= today) {
      const key = cur.toISOString().slice(0, 10);
      const count = dateMap[key] || 0;
      if (cur.getDay() === 0 && monthsEl) {
        const m = cur.getMonth();
        if (m !== lastMonth) {
          const span = document.createElement('span');
          span.textContent = MONTHS[m];
          span.style.left  = (colIndex * CELL_STEP) + 'px';
          monthsEl.appendChild(span);
          lastMonth = m;
        }
        colIndex++;
      }
      const el = document.createElement('div');
      el.className     = 'hm-cell';
      el.dataset.date  = key;
      el.dataset.count = count;
      if (count > 0) el.classList.add(count >= 4 ? 'hm-l4' : count === 3 ? 'hm-l3' : count === 2 ? 'hm-l2' : 'hm-l1');
      grid.appendChild(el);
      cur.setDate(cur.getDate() + 1);
    }

    /* 툴팁 */
    if (tooltip) {
      grid.addEventListener('mouseover', e => {
        const c = e.target.closest('.hm-cell'); if (!c) return;
        const n = Number(c.dataset.count);
        tooltip.textContent   = `${c.dataset.date}  ·  ${n === 0 ? 'no posts' : n === 1 ? '1 post' : n + ' posts'}`;
        tooltip.style.display = 'block';
      });
      grid.addEventListener('mousemove', e => {
        const tipW = tooltip.offsetWidth || 160;
        const x    = (e.clientX + 14 + tipW > window.innerWidth) ? e.clientX - tipW - 8 : e.clientX + 14;
        tooltip.style.left = x + 'px';
        tooltip.style.top  = (e.clientY - 32) + 'px';
      });
      grid.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    }
  }

  /* ══════════════════════════════════════
     Post card scroll entrance
     ══════════════════════════════════════ */
  const cards = document.querySelectorAll('.post-card');
  if (cards.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.style.transition = `opacity 380ms ease, transform 380ms ease`;
        e.target.style.opacity    = '1';
        e.target.style.transform  = 'none';
        io.unobserve(e.target);
      });
    }, { threshold: 0.06 });
    cards.forEach((c, i) => {
      c.style.opacity   = '0';
      c.style.transform = 'translateY(14px)';
      io.observe(c);
    });
  }

  /* ══════════════════════════════════════
     Heading labels (H1 / H2 / H3 in margin)
     ══════════════════════════════════════ */
  document.querySelectorAll('.post-content h1, .post-content h2, .post-content h3').forEach(el => {
    const tag = el.tagName; // H1, H2, H3
    el.setAttribute('data-heading', tag);
  });

  /* ══════════════════════════════════════
     Modal D3 Graph
     ══════════════════════════════════════ */
  async function initModalGraph() {
    const base = window.SITE_BASEURL || '';
    let data;
    try {
      const res = await fetch(`${base}/graph-data.json`);
      data = await res.json();
    } catch (e) { return; }

    if (!data?.nodes?.length || typeof d3 === 'undefined') return;

    data.nodes.forEach(n => { n.linkCount = 0; });
    data.links.forEach(l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      const s = data.nodes.find(n => n.id === sId);
      const t = data.nodes.find(n => n.id === tId);
      if (s) s.linkCount++;
      if (t) t.linkCount++;
    });

    const container = document.getElementById('graph-modal-container');
    const svgEl     = document.getElementById('knowledge-graph-modal');
    if (!container || !svgEl) return;

    const w = container.clientWidth;
    const h = container.clientHeight || 400;
    const currentUrl  = (window.CURRENT_PAGE || '').replace(/\/$/, '') || '/';
    const currentNode = data.nodes.find(n => n.url === currentUrl);

    const linkedIds = new Set();
    if (currentNode) {
      data.links.forEach(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        if (s === currentNode.id) linkedIds.add(t);
        if (t === currentNode.id) linkedIds.add(s);
      });
    }

    const svg = d3.select(svgEl).attr('width', w).attr('height', h);
    const g   = svg.append('g');

    const zoom = d3.zoom().scaleExtent([0.3, 4])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(0.78));

    const BOUNDARY = 520;

    const sim = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id).distance(80).strength(0.35))
      .force('charge', d3.forceManyBody().strength(-200).distanceMax(380))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius(d => 14 + Math.min(d.linkCount || 0, 6) * 1.2))
      .force('boundary', () => {
        data.nodes.forEach(d => {
          const dist = Math.hypot(d.x, d.y);
          if (dist > BOUNDARY) {
            const excess = dist - BOUNDARY;
            d.vx -= (d.x / dist) * excess * 0.018;
            d.vy -= (d.y / dist) * excess * 0.018;
          }
        });
      });

    let bgDragging = false, lastBgPos = null;
    svg.on('mousedown.bgpull', function (e) {
      if (e.target === svgEl) { bgDragging = true; lastBgPos = { x: e.clientX, y: e.clientY }; }
    });
    svg.on('mousemove.bgpull', function (e) {
      if (!bgDragging || !lastBgPos) return;
      const dx = (e.clientX - lastBgPos.x) * 0.55;
      const dy = (e.clientY - lastBgPos.y) * 0.55;
      lastBgPos = { x: e.clientX, y: e.clientY };
      data.nodes.forEach(d => { d.vx += dx; d.vy += dy; });
      sim.alphaTarget(0.08).restart();
    });
    svg.on('mouseup.bgpull mouseleave.bgpull', function () {
      if (!bgDragging) return;
      bgDragging = false; lastBgPos = null; sim.alphaTarget(0);
    });

    const link = g.append('g').selectAll('line').data(data.links).enter()
      .append('line').attr('class', 'graph-link');

    const tipEl = document.createElement('div');
    tipEl.className = 'graph-tooltip';
    tipEl.style.display = 'none';
    container.appendChild(tipEl);

    const node = g.append('g').selectAll('g').data(data.nodes).enter().append('g')
      .attr('class', d => 'graph-node' + (d.id === currentNode?.id ? ' current' : ''))
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append('circle')
      .attr('r', d => d.id === currentNode?.id ? 9 : 5 + Math.min(d.linkCount || 0, 5) * 1.1)
      .attr('fill', d => {
        if (d.id === currentNode?.id) return 'var(--accent)';
        if (linkedIds.has(d.id)) return '#9ece6a';
        return 'rgba(35,29,26,0.25)';
      })
      .attr('stroke', d => d.id === currentNode?.id ? 'rgba(26,137,23,0.3)' : 'none')
      .attr('stroke-width', 4);

    node.append('text')
      .attr('dx', d => (d.id === currentNode?.id ? 9 : 5) + 5)
      .attr('dy', '0.35em')
      .attr('font-size', 10)
      .attr('fill', 'var(--ink-soft)')
      .attr('font-family', 'DM Sans, sans-serif')
      .text(d => d.title.length > 20 ? d.title.slice(0, 20) + '…' : d.title);

    node
      .on('mouseover', function (event, d) {
        const connected = new Set([d.id]);
        data.links.forEach(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          if (s === d.id) connected.add(t);
          if (t === d.id) connected.add(s);
        });
        node.classed('dimmed', n => !connected.has(n.id));
        link.classed('dimmed', l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          return s !== d.id && t !== d.id;
        });
        link.classed('highlighted', l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          return s === d.id || t === d.id;
        });
        tipEl.textContent = d.title;
        tipEl.style.display = 'block';
      })
      .on('mousemove', function (event) {
        const rect = container.getBoundingClientRect();
        tipEl.style.left = (event.clientX - rect.left + 14) + 'px';
        tipEl.style.top  = (event.clientY - rect.top  - 10) + 'px';
      })
      .on('mouseout', function () {
        node.classed('dimmed', false);
        link.classed('dimmed', false).classed('highlighted', false);
        tipEl.style.display = 'none';
      })
      .on('click', function (event, d) {
        if (d.url) { closeModal(); setTimeout(() => { window.location.href = (base || '') + d.url; }, 180); }
      });

    sim.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }
});
