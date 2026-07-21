document.addEventListener('DOMContentLoaded', function () {

  /* ══════════════════════════════════════
     Reading progress bar
     ══════════════════════════════════════ */
  (function () {
    const bar = document.getElementById('reading-progress');
    if (!bar || !document.body.classList.contains('page-post')) return;

    function updateProgress() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      bar.style.width = pct + '%';
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  })();

  /* ══════════════════════════════════════
     Shared data cache
     ══════════════════════════════════════ */
  let _postIndex = null;
  function fetchPostIndex() {
    if (_postIndex) return Promise.resolve(_postIndex);
    const base = window.SITE_BASEURL || '';
    return fetch(`${base}/search-data.json`)
      .then(r => r.json())
      .then(d => { _postIndex = d.posts || []; return _postIndex; });
  }

  // toISOString()은 UTC 기준 → 한국(UTC+9)에서 오늘이 어제로 나옴
  // 로컬 시간 기준 YYYY-MM-DD 반환
  function localDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  /* ══════════════════════════════════════
     Full-screen search overlay
     ══════════════════════════════════════ */
  const searchBtn     = document.getElementById('search-btn');
  const searchOverlay = document.getElementById('search-overlay');
  const searchClose   = document.getElementById('search-overlay-close');
  const searchInput   = document.getElementById('search-overlay-input');
  const searchResults = document.getElementById('search-results');

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const queryTerms = query => [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];

  function highlightMatches(text, query) {
    const terms = queryTerms(query);
    if (!terms.length) return escapeHtml(text);
    const pattern = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return escapeHtml(text).replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
  }

  function snippetFor(post, query) {
    const content = String(post.content || '').replace(/\s+/g, ' ').trim();
    const lowerContent = content.toLowerCase();
    const terms = queryTerms(query);
    let matchIndex = -1;
    let matchLength = 0;

    terms.some(term => {
      const index = lowerContent.indexOf(term);
      if (index < 0) return false;
      matchIndex = index;
      matchLength = term.length;
      return true;
    });

    if (matchIndex < 0) {
      return content.length > 180 ? `${content.slice(0, 180).trim()}…` : content;
    }

    const start = Math.max(0, matchIndex - 92);
    const end = Math.min(content.length, matchIndex + matchLength + 128);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < content.length ? '…' : '';
    return `${prefix}${content.slice(start, end).trim()}${suffix}`;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function openSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.add('is-open');
    searchOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('search-is-open');
    searchInput?.focus();
    fetchPostIndex()
      .then(posts => renderSearchResults(searchInput?.value || '', posts))
      .catch(() => {
        if (searchResults) searchResults.innerHTML = '<p class="search-empty">검색 데이터를 불러오지 못했습니다.</p>';
      });
  }

  function closeSearch() {
    if (!searchOverlay?.classList.contains('is-open')) return;
    searchOverlay.classList.remove('is-open');
    searchOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('search-is-open');
    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.innerHTML = '<p class="search-prompt">제목과 글 내용에서 검색합니다.</p>';
    searchInput?.blur();
  }

  function renderSearchResults(query, posts) {
    if (!searchResults) return;
    const terms = queryTerms(query);
    if (!terms.length) {
      searchResults.innerHTML = '<p class="search-prompt">제목과 글 내용에서 검색합니다.</p>';
      return;
    }

    const matches = (posts || []).filter(post => {
      const haystack = `${post.title || ''} ${post.content || ''}`.toLowerCase();
      return terms.every(term => haystack.includes(term));
    });

    searchResults.innerHTML = matches.length
      ? `<p class="search-count">${matches.length} results</p>${matches.map(post => `
          <a class="search-result" href="${escapeHtml(post.url)}">
            <div class="search-result-copy">
              <h2 class="search-result-title">${highlightMatches(post.title, query)}</h2>
              <p class="search-result-snippet">${highlightMatches(snippetFor(post, query), query)}</p>
            </div>
            <time class="search-result-date">${fmtDate(post.date)}</time>
          </a>`).join('')}`
      : '<p class="search-empty">일치하는 글이 없습니다.</p>';
  }

  searchBtn?.addEventListener('click', openSearch);
  searchClose?.addEventListener('click', closeSearch);
  searchOverlay?.addEventListener('click', event => {
    if (event.target === searchOverlay) closeSearch();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSearch(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  });

  searchInput?.addEventListener('input', async () => {
    const query = searchInput.value.trim();
    try {
      const posts = await fetchPostIndex();
      renderSearchResults(query, posts);
    } catch (e) {
      if (searchResults) searchResults.innerHTML = '<p class="search-empty">검색 데이터를 불러오지 못했습니다.</p>';
    }
  });

  /* ══════════════════════════════════════
     Activity Heatmap — animated expand/collapse
     ══════════════════════════════════════ */
  const miniEl         = document.getElementById('heatmap-mini');
  const heatmapSection = document.getElementById('heatmap-section');
  const heatmapInner   = document.getElementById('heatmap-inner');
  const heatmapSummary = heatmapSection?.querySelector('.heatmap-summary');
  let heatmapInited    = false;
  let heatmapAnimating = false;   // 애니메이션 진행 중 재클릭 방지

  /* 미니 히트맵 (접힌 요약줄) */
  if (miniEl) {
    fetchPostIndex()
      .then(posts => renderMiniHeatmap(posts || []))
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
      const key   = localDate(d);
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
      if (heatmapAnimating) return;
      heatmapSection.open ? collapseHeatmap() : expandHeatmap();
    });
  }

  function expandHeatmap() {
    heatmapAnimating = true;

    /* ① 미니 셀 날리기 */
    const miniCells = [...document.querySelectorAll('.hm-mini-cell')];
    miniCells.forEach((c, i) => {
      c.style.transition = `transform 150ms ${i * 14}ms ease, opacity 150ms ${i * 14}ms ease`;
      c.style.transform  = 'scale(1.7) translateY(-3px)';
      c.style.opacity    = '0';
    });
    const miniWait = miniCells.length ? 150 + (miniCells.length - 1) * 14 + 16 : 0;

    /* ② 미니 셀 완료 후 height 슬라이드 */
    setTimeout(() => {
      const doSlide = () => {
        if (!heatmapInner) return;

        // details 열기 → scrollHeight 측정 → 즉시 0으로 고정 (paint 전)
        heatmapSection.setAttribute('open', '');
        const targetH = heatmapInner.scrollHeight;
        heatmapInner.style.height   = '0';
        heatmapInner.style.overflow = 'hidden';

        // double-rAF: 첫 번째는 0-height 상태를 커밋, 두 번째에 트랜지션 시작
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            heatmapInner.style.transition = 'height 400ms cubic-bezier(0.22, 1, 0.36, 1)';
            heatmapInner.style.height     = targetH + 'px';

            const onEnd = e => {
              if (e.propertyName !== 'height') return;
              heatmapInner.removeEventListener('transitionend', onEnd);
              heatmapInner.style.height     = '';
              heatmapInner.style.overflow   = '';
              heatmapInner.style.transition = '';
              heatmapAnimating = false;
            };
            heatmapInner.addEventListener('transitionend', onEnd);
          });
        });
      };

      if (!heatmapInited) {
        heatmapInited = true;
        fetchPostIndex()
          .then(posts => { renderHeatmap(posts || []); doSlide(); })
          .catch(() => { renderHeatmap([]); doSlide(); });
      } else {
        doSlide();
      }
    }, miniWait);
  }

  function collapseHeatmap() {
    heatmapAnimating = true;

    /* ① 현재 높이 고정 후 즉시 트랜지션 (stagger 없이 깔끔하게) */
    const currentH = heatmapInner.offsetHeight;
    heatmapInner.style.height   = currentH + 'px';
    heatmapInner.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        heatmapInner.style.transition = 'height 320ms cubic-bezier(0.4, 0, 0.6, 1)';
        heatmapInner.style.height     = '0';

        const onEnd = e => {
          if (e.propertyName !== 'height') return;
          heatmapInner.removeEventListener('transitionend', onEnd);

          heatmapSection.removeAttribute('open');
          heatmapInner.style.height     = '';
          heatmapInner.style.overflow   = '';
          heatmapInner.style.transition = '';

          /* ② 미니 셀 스프링 복귀 */
          const minis = [...document.querySelectorAll('.hm-mini-cell')];
          minis.forEach(c => {
            c.style.transition = 'none';
            c.style.transform  = 'scale(0)';
            c.style.opacity    = '0';
          });
          requestAnimationFrame(() => {
            minis.forEach((c, i) => {
              c.style.transition = `transform 260ms ${i * 22}ms cubic-bezier(0.34,1.56,0.64,1),
                                    opacity    160ms ${i * 22}ms ease`;
              c.style.transform  = '';
              c.style.opacity    = '';
            });
            setTimeout(() => { heatmapAnimating = false; }, minis.length * 22 + 260);
          });
        };
        heatmapInner.addEventListener('transitionend', onEnd);
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
      const key = localDate(cur);
      const count = dateMap[key] || 0;
      if (cur.getDay() === 0 && monthsEl) {
        // 이 주(일~토)에 1일이 포함된 경우에만 월 레이블 표시
        const weekEnd = new Date(cur);
        weekEnd.setDate(weekEnd.getDate() + 6);
        let labelMonth = -1;
        if (cur.getDate() === 1) {
          labelMonth = cur.getMonth();               // 일요일이 1일
        } else if (cur.getMonth() !== weekEnd.getMonth()) {
          labelMonth = weekEnd.getMonth();           // 이 주 안에 월이 바뀜
        }
        if (labelMonth !== -1 && labelMonth !== lastMonth) {
          const span = document.createElement('span');
          span.textContent = MONTHS[labelMonth];
          span.style.left  = (colIndex * CELL_STEP) + 'px';
          monthsEl.appendChild(span);
          lastMonth = labelMonth;
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

    /* 툴팁 — body에 붙여서 컨테이너 영향 차단 */
    if (tooltip) {
      document.body.appendChild(tooltip); // fixed 위치 보장
      grid.addEventListener('mouseover', e => {
        const c = e.target.closest('.hm-cell'); if (!c) return;
        const n = Number(c.dataset.count);
        tooltip.textContent   = `${c.dataset.date}  ·  ${n === 0 ? 'no posts' : n === 1 ? '1 post' : n + ' posts'}`;
        tooltip.style.display = 'block';
      });
      grid.addEventListener('mousemove', e => {
        const tipH = tooltip.offsetHeight || 24;
        const tipW = tooltip.offsetWidth  || 160;
        const x    = (e.clientX + 14 + tipW > window.innerWidth) ? e.clientX - tipW - 8 : e.clientX + 14;
        const y    = (e.clientY - tipH - 10 < 0) ? e.clientY + 14 : e.clientY - tipH - 10;
        tooltip.style.left = x + 'px';
        tooltip.style.top  = y + 'px';
      });
      grid.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    }
  }

  /* ══════════════════════════════════════
     Share button
     ══════════════════════════════════════ */
  const shareBtn    = document.getElementById('share-btn');
  const shareCopied = document.getElementById('share-copied');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const url   = location.href;
      const title = document.title;
      if (navigator.share) {
        try { await navigator.share({ title, url }); return; } catch (e) { /* cancelled */ }
      }
      try {
        await navigator.clipboard.writeText(url);
      } catch (e) {
        // fallback: execCommand
        const ta = document.createElement('textarea');
        ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      shareCopied?.classList.add('is-visible');
      setTimeout(() => shareCopied?.classList.remove('is-visible'), 2000);
    });
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
});
