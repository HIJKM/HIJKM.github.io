document.addEventListener('DOMContentLoaded', function () {
  const exploreBtn  = document.getElementById('explore-btn');
  const modal       = document.getElementById('graph-modal');
  const closeBtn    = document.getElementById('graph-modal-close');
  const backdrop    = modal?.querySelector('.graph-modal-backdrop');

  let graphInited = false;

  function openModal() {
    modal?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (!graphInited) {
      graphInited = true;
      initModalGraph();
    }
  }

  function closeModal() {
    modal?.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  exploreBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  /* ── 모달 내부 D3 그래프 ── */
  async function initModalGraph() {
    const base = window.SITE_BASEURL || '';
    let data;
    try {
      const res = await fetch(`${base}/graph-data.json`);
      data = await res.json();
    } catch (e) { return; }

    if (!data?.nodes?.length || typeof d3 === 'undefined') return;

    // linkCount 계산
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

    const sim = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id).distance(80).strength(0.35))
      .force('charge', d3.forceManyBody().strength(-200).distanceMax(380))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius(d => 14 + Math.min(d.linkCount || 0, 6) * 1.2));

    const link = g.append('g').selectAll('line').data(data.links).enter()
      .append('line').attr('class', 'graph-link');

    // tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'graph-tooltip';
    tooltip.style.display = 'none';
    container.appendChild(tooltip);

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
        if (linkedIds.has(d.id))      return '#9ece6a';
        return 'rgba(35,29,26,0.25)';
      })
      .attr('stroke', d => d.id === currentNode?.id ? 'rgba(255,107,87,0.3)' : 'none')
      .attr('stroke-width', 4);

    node.append('text')
      .attr('dx', d => (d.id === currentNode?.id ? 9 : 5) + 5)
      .attr('dy', '0.35em')
      .attr('font-size', 10)
      .attr('fill', 'var(--ink-soft)')
      .attr('font-family', 'IBM Plex Sans KR, sans-serif')
      .text(d => d.title.length > 18 ? d.title.slice(0, 18) + '…' : d.title);

    node
      .on('mouseover', function (event, d) {
        const connectedIds = new Set([d.id]);
        data.links.forEach(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          if (s === d.id) connectedIds.add(t);
          if (t === d.id) connectedIds.add(s);
        });
        node.classed('dimmed', n => !connectedIds.has(n.id));
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
        tooltip.textContent = d.title;
        tooltip.style.display = 'block';
      })
      .on('mousemove', function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style.left = (event.clientX - rect.left + 14) + 'px';
        tooltip.style.top  = (event.clientY - rect.top  - 10) + 'px';
      })
      .on('mouseout', function () {
        node.classed('dimmed', false);
        link.classed('dimmed', false).classed('highlighted', false);
        tooltip.style.display = 'none';
      })
      .on('click', function (event, d) {
        if (d.url) {
          closeModal();
          setTimeout(() => { window.location.href = (base || '') + d.url; }, 180);
        }
      });

    sim.on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }
});
