// Mobile modals & sidebar
document.addEventListener('DOMContentLoaded', function () {
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const graphToggle   = document.getElementById('graph-modal-toggle');
  const graphClose    = document.getElementById('graph-modal-close');
  const sidebar       = document.getElementById('sidebar');
  const overlay       = document.getElementById('modal-overlay');
  const graphModal    = document.getElementById('graph-modal');

  function closeAll() {
    sidebar?.classList.remove('open');
    graphModal?.classList.remove('show');
    overlay?.classList.remove('show');
    sidebarToggle?.classList.remove('active');
    graphToggle?.classList.remove('active');
  }

  // 사이드바 토글
  sidebarToggle?.addEventListener('click', function () {
    const isOpen = sidebar?.classList.contains('open');
    closeAll();
    if (!isOpen) {
      sidebar?.classList.add('open');
      overlay?.classList.add('show');
      sidebarToggle?.classList.add('active');
    }
  });

  // 그래프 모달 토글
  graphToggle?.addEventListener('click', function () {
    const isOpen = graphModal?.classList.contains('show');
    closeAll();
    if (!isOpen) {
      graphModal?.classList.add('show');
      overlay?.classList.add('show');
      graphToggle?.classList.add('active');
      // 모바일 그래프 초기화 (최초 1회)
      if (!window._mobileGraphInit) {
        window._mobileGraphInit = true;
        initMobileGraph();
      }
    }
  });

  // 닫기 버튼 & 오버레이
  graphClose?.addEventListener('click', closeAll);
  overlay?.addEventListener('click', closeAll);

  // 모바일 그래프 (graph.js와 별도로 SVG ID 분리)
  async function initMobileGraph() {
    const base = window.SITE_BASEURL || '';
    let data;
    try {
      const res = await fetch(`${base}/graph-data.json`);
      data = await res.json();
    } catch(e) { return; }
    if (!data?.nodes?.length) return;

    data.nodes.forEach(n => n.linkCount = 0);
    data.links.forEach(l => {
      const s = data.nodes.find(n => n.id === (typeof l.source==='object'?l.source.id:l.source));
      const t = data.nodes.find(n => n.id === (typeof l.target==='object'?l.target.id:l.target));
      if (s) s.linkCount++;
      if (t) t.linkCount++;
    });

    const container = document.getElementById('graph-modal-container');
    const svgEl     = document.getElementById('knowledge-graph-mobile');
    if (!container || !svgEl || typeof d3 === 'undefined') return;

    const w = container.clientWidth, h = container.clientHeight || 300;
    const currentUrl = (window.CURRENT_PAGE || '').replace(/\/$/, '') || '/';
    const currentNode = data.nodes.find(n => n.url === currentUrl);
    const linkedIds = new Set();
    if (currentNode) {
      data.links.forEach(l => {
        const s = typeof l.source==='object'?l.source.id:l.source;
        const t = typeof l.target==='object'?l.target.id:l.target;
        if (s===currentNode.id) linkedIds.add(t);
        if (t===currentNode.id) linkedIds.add(s);
      });
    }

    const svg = d3.select(svgEl).attr('width', w).attr('height', h);
    const g = svg.append('g');
    const zoom = d3.zoom().scaleExtent([0.3,4])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(w/2, h/2).scale(0.75));

    const sim = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d=>d.id).distance(60).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(0,0))
      .force('collision', d3.forceCollide().radius(18));

    const link = g.append('g').selectAll('line').data(data.links).enter()
      .append('line').attr('stroke','#3b4261').attr('stroke-opacity',0.5).attr('stroke-width',1.2);

    const node = g.append('g').selectAll('g').data(data.nodes).enter().append('g')
      .call(d3.drag()
        .on('start',(e,d)=>{ if(!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
        .on('drag',(e,d)=>{ d.fx=e.x; d.fy=e.y; })
        .on('end',(e,d)=>{ if(!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; }));

    node.append('circle')
      .attr('r', d => d.id===(currentNode?.id) ? 9 : 5+Math.min(d.linkCount||0,5)*1.2)
      .attr('fill', d => {
        if (d.id===currentNode?.id) return '#7aa2f7';
        if (linkedIds.has(d.id)) return '#9ece6a';
        return '#565f89';
      })
      .attr('stroke', d => d.id===currentNode?.id ? '#fff' : 'none')
      .attr('stroke-width', 1.5);

    node.append('text')
      .attr('dx', d => (d.id===currentNode?.id?9:5) + 4)
      .attr('dy','0.35em')
      .attr('font-size', 9)
      .attr('fill','#a9b1d6')
      .attr('font-family','Noto Sans KR, sans-serif')
      .text(d => d.title.length>16 ? d.title.slice(0,16)+'…' : d.title);

    node.on('click', (e,d) => {
      closeAll();
      setTimeout(() => { window.location.href = (base||'')+d.url; }, 150);
    });

    sim.on('tick', () => {
      link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y)
          .attr('x2',d=>d.target.x).attr('y2',d=>d.target.y);
      node.attr('transform', d=>`translate(${d.x},${d.y})`);
    });
  }

  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      html.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
      localStorage.setItem('theme', html.getAttribute('data-theme'));
    });
  }

  // Restore saved theme
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);

  // Active link highlight
  const links = document.querySelectorAll('.sidebar-nav a');
  const currentPath = window.location.pathname;
  links.forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });

  // Scroll progress bar
  const bar = document.createElement('div');
  bar.id = 'scroll-progress';
  bar.style.cssText = `
    position: fixed; top: 0; left: 0; height: 2px;
    background: var(--accent); z-index: 9999;
    width: 0%; transition: width 0.1s linear;
  `;
  document.body.prepend(bar);

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (scrollTop / docHeight * 100) + '%';
  });
});
