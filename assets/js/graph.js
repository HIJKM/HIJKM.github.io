/**
 * Knowledge Graph — Obsidian-style D3.js force simulation
 * Renders a force-directed graph in the right sidebar panel.
 */

(function () {
  'use strict';

  const COLORS = {
    current:  '#7aa2f7',
    related:  '#9ece6a',
    tagged:   '#bb9af7',
    other:    '#565f89',
    link:     '#3b4261',
    linkHL:   '#7aa2f7',
  };

  let simulation = null;
  let svg = null;
  let graphData = null;

  /**
   * Fetch graph data from graph-data.json
   */
  async function loadGraphData() {
    try {
      const base = window.SITE_BASEURL || '';
      const res = await fetch(`${base}/graph-data.json`);
      if (!res.ok) throw new Error('graph-data.json not found');
      return await res.json();
    } catch (e) {
      console.warn('[graph] Failed to load graph data:', e.message);
      return null;
    }
  }

  /**
   * Determine node color based on relationship to current page
   */
  function nodeColor(node, currentUrl, linkedIds) {
    if (node.url === currentUrl) return COLORS.current;
    if (linkedIds && linkedIds.has(node.id)) return COLORS.related;
    return COLORS.other;
  }

  /**
   * Render the graph
   */
  function renderGraph(data) {
    const container = document.getElementById('graph-container');
    if (!container) return;

    const svgEl = document.getElementById('knowledge-graph');
    if (!svgEl) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous
    d3.select(svgEl).selectAll('*').remove();

    svg = d3.select(svgEl)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g').attr('class', 'graph-root');

    // Zoom & pan
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(0.85));

    const currentUrl = (window.CURRENT_PAGE || '').replace(/\/$/, '') || '/';

    // Find linked node IDs for current page
    const currentNode = data.nodes.find(n => n.url === currentUrl);
    const linkedIds = new Set();
    if (currentNode) {
      data.links.forEach(l => {
        const srcId = typeof l.source === 'object' ? l.source.id : l.source;
        const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
        if (srcId === currentNode.id) linkedIds.add(tgtId);
        if (tgtId === currentNode.id) linkedIds.add(srcId);
      });
    }

    // Tooltip
    let tooltip = document.querySelector('.graph-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'graph-tooltip';
      container.appendChild(tooltip);
    }
    tooltip.style.display = 'none';

    // Force simulation
    simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links)
        .id(d => d.id)
        .distance(70)
        .strength(0.4))
      .force('charge', d3.forceManyBody()
        .strength(-180)
        .distanceMax(300))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide()
        .radius(d => nodeRadius(d, currentNode) + 8))
      .alphaDecay(0.03);

    // Links
    const link = g.append('g').attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('class', 'graph-link')
      .attr('stroke-width', 1.2);

    // Nodes group
    const node = g.append('g').attr('class', 'nodes')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .attr('class', d => {
        let cls = 'graph-node';
        if (d.url === currentUrl) cls += ' current';
        return cls;
      })
      .call(drag(simulation));

    // Circle
    node.append('circle')
      .attr('r', d => nodeRadius(d, currentNode))
      .attr('fill', d => nodeColor(d, currentUrl, linkedIds))
      .attr('stroke', d => d.url === currentUrl ? '#fff' : 'none')
      .attr('stroke-width', d => d.url === currentUrl ? 1.5 : 0);

    // Label
    node.append('text')
      .attr('dx', d => nodeRadius(d, currentNode) + 4)
      .attr('dy', '0.35em')
      .attr('font-size', d => d.url === currentUrl ? 11 : 9)
      .attr('fill', d => d.url === currentUrl ? '#c0caf5' : '#565f89')
      .text(d => truncate(d.title, 18));

    // Interaction
    node.on('mouseover', function(event, d) {
        // Highlight connected nodes
        const connectedIds = new Set([d.id]);
        data.links.forEach(l => {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          if (srcId === d.id) connectedIds.add(tgtId);
          if (tgtId === d.id) connectedIds.add(srcId);
        });

        node.classed('dimmed', n => !connectedIds.has(n.id));
        link.classed('dimmed', l => {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          return srcId !== d.id && tgtId !== d.id;
        });
        link.classed('highlighted', l => {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          return srcId === d.id || tgtId === d.id;
        });

        tooltip.textContent = d.title;
        tooltip.style.display = 'block';
      })
      .on('mousemove', function(event) {
        const rect = container.getBoundingClientRect();
        tooltip.style.left = (event.clientX - rect.left + 12) + 'px';
        tooltip.style.top = (event.clientY - rect.top - 10) + 'px';
      })
      .on('mouseout', function() {
        node.classed('dimmed', false);
        link.classed('dimmed', false).classed('highlighted', false);
        tooltip.style.display = 'none';
      })
      .on('click', function(event, d) {
        if (d.url) {
          const base = window.SITE_BASEURL || '';
          window.location.href = base + d.url;
        }
      });

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Zoom controls
    addZoomControls(container, zoom, svg);
  }

  function nodeRadius(node, currentNode) {
    if (currentNode && node.id === currentNode.id) return 9;
    return 5 + Math.min((node.linkCount || 0), 5) * 1.2;
  }

  function addZoomControls(container, zoom, svg) {
    let ctrl = container.querySelector('.graph-controls');
    if (!ctrl) {
      ctrl = document.createElement('div');
      ctrl.className = 'graph-controls';
      ctrl.innerHTML = `
        <button class="graph-btn" data-action="zoom-in" title="확대"><i class="fa fa-plus"></i></button>
        <button class="graph-btn" data-action="zoom-out" title="축소"><i class="fa fa-minus"></i></button>
        <button class="graph-btn" data-action="reset" title="초기화"><i class="fa fa-crosshairs"></i></button>
      `;
      container.appendChild(ctrl);
    }
    ctrl.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const w = container.clientWidth, h = container.clientHeight;
      if (btn.dataset.action === 'zoom-in')
        svg.transition().duration(300).call(zoom.scaleBy, 1.4);
      else if (btn.dataset.action === 'zoom-out')
        svg.transition().duration(300).call(zoom.scaleBy, 0.7);
      else
        svg.transition().duration(400)
          .call(zoom.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(0.85));
    });
  }

  function drag(sim) {
    return d3.drag()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x; d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
  }

  function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  // Init
  async function init() {
    const data = await loadGraphData();
    if (!data || !data.nodes || data.nodes.length === 0) return;

    // Compute link count for node sizing
    data.nodes.forEach(n => n.linkCount = 0);
    data.links.forEach(l => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      const src = data.nodes.find(n => n.id === srcId);
      const tgt = data.nodes.find(n => n.id === tgtId);
      if (src) src.linkCount++;
      if (tgt) tgt.linkCount++;
    });

    graphData = data;
    renderGraph(data);

    // Resize
    window.addEventListener('resize', () => {
      if (graphData) renderGraph(graphData);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
