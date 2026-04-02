(function () {
  'use strict';

  const GRAPH_CONFIG = {
    repulsion: -760,
    linkDistance: 12,
    linkStrength: 0.34,
    velocityDecay: 0.68,
    springStrength: 0.35,
    damping: 0.90,
    gridSize: 40,
    centerStrength: 0.08,
    orbitRadiusRatio: 0.22,
    orbitStrength: 0.14,
    dragShiftFactor: 0.38,
    dragVelocityFactor: 0.22,
    dragAlphaTarget: 0.24,
    labelRevealScale: 1.55,
  };

  let graphDataPromise = null;

  function loadGraphData() {
    if (graphDataPromise) return graphDataPromise;

    const base = window.SITE_BASEURL || '';
    graphDataPromise = fetch(`${base}/graph-data.json`)
      .then((res) => {
        if (!res.ok) throw new Error('graph-data.json not found');
        return res.json();
      })
      .catch((error) => {
        console.warn('[graph] Failed to load graph data:', error.message);
        graphDataPromise = null;
        return null;
      });

    return graphDataPromise;
  }

  function cloneGraphData(data) {
    const nodes = (data.nodes || []).map((node) => ({
      ...node,
      label: node.title || node.label || '',
      linkCount: 0,
    }));

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const links = (data.links || []).map((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      const sourceNode = nodeMap.get(sourceId);
      const targetNode = nodeMap.get(targetId);
      if (sourceNode) sourceNode.linkCount += 1;
      if (targetNode) targetNode.linkCount += 1;

      return {
        ...link,
        source: sourceId,
        target: targetId,
      };
    });

    return { nodes, links };
  }

  function truncateLabel(label, max) {
    if (!label) return '';
    return label.length > max ? `${label.slice(0, max)}…` : label;
  }

  function createTooltip(container) {
    container.querySelectorAll('.graph-tooltip').forEach((el) => el.remove());

    const tooltip = document.createElement('div');
    tooltip.className = 'graph-tooltip';
    tooltip.style.display = 'none';
    container.appendChild(tooltip);
    return tooltip;
  }

  function connectedIdsFor(node, links) {
    const ids = new Set([node.id]);
    links.forEach((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      if (sourceId === node.id) ids.add(targetId);
      if (targetId === node.id) ids.add(sourceId);
    });
    return ids;
  }

  function seedNodePositions(nodes, width, height, burstOnMount) {
    const centerX = width / 2;
    const centerY = height / 2;

    nodes.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1);
      const radius = burstOnMount ? (6 + (index % 6) * 1.8) : (22 + (index % 8) * 3);
      const spread = burstOnMount ? 3 : 10;

      node.x = centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * spread;
      node.y = centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * spread;
      node.vx = burstOnMount ? Math.cos(angle) * (2.6 + Math.random() * 1.1) : (Math.random() - 0.5) * 0.6;
      node.vy = burstOnMount ? Math.sin(angle) * (2.6 + Math.random() * 1.1) : (Math.random() - 0.5) * 0.6;
    });
  }

  function dragNode(simulation) {
    return d3.drag()
      .on('start', (event, node) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        node.fx = node.x;
        node.fy = node.y;
      })
      .on('drag', (event, node) => {
        node.fx = event.x;
        node.fy = event.y;
      })
      .on('end', (event, node) => {
        if (!event.active) simulation.alphaTarget(0);
        node.fx = null;
        node.fy = null;
      });
  }

  function renderGraphInto(data, options) {
    const container = document.getElementById(options.containerId);
    const svgElement = document.getElementById(options.svgId);
    if (!container || !svgElement || typeof d3 === 'undefined') return null;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const currentUrl = ((options.currentUrl || '').replace(/\/$/, '')) || '/';
    const currentNode = data.nodes.find((node) => node.url === currentUrl) || null;
    const linkedIds = currentNode ? connectedIdsFor(currentNode, data.links) : new Set();

    d3.select(svgElement).selectAll('*').remove();
    container.style.setProperty('--graph-grid-x', '0px');
    container.style.setProperty('--graph-grid-y', '0px');

    seedNodePositions(data.nodes, width, height, !!options.burstOnMount);

    const tooltip = createTooltip(container);

    const svg = d3.select(svgElement)
      .attr('width', width)
      .attr('height', height);

    const mainGroup = svg.append('g').attr('class', 'main-group');

    let currentScale = 1;

    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        currentScale = event.transform.k;
        mainGroup.attr('transform', event.transform);
        mainGroup.classed('labels-visible', currentScale >= GRAPH_CONFIG.labelRevealScale);
      });

    svg.call(zoom)
      .on('mousedown.zoom', null);

    const simulation = d3.forceSimulation(data.nodes)
      .force(
        'link',
        d3.forceLink(data.links)
          .id((node) => node.id)
          .distance(GRAPH_CONFIG.linkDistance)
          .strength(GRAPH_CONFIG.linkStrength)
      )
      .force('charge', d3.forceManyBody().strength(GRAPH_CONFIG.repulsion))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(GRAPH_CONFIG.centerStrength))
      .force(
        'orbit',
        d3.forceRadial(
          Math.min(width, height) * GRAPH_CONFIG.orbitRadiusRatio,
          width / 2,
          height / 2
        ).strength(GRAPH_CONFIG.orbitStrength)
      )
      .velocityDecay(GRAPH_CONFIG.velocityDecay);

    if (options.burstOnMount) {
      simulation.alpha(1).alphaTarget(0.16).restart();
      window.setTimeout(() => simulation.alphaTarget(0), 760);
    }

    const link = mainGroup.append('g')
      .attr('class', 'graph-links')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('class', 'graph-link');

    const node = mainGroup.append('g')
      .attr('class', 'graph-nodes')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .attr('class', (datum) => `graph-node${currentNode && datum.id === currentNode.id ? ' current' : ''}`)
      .call(dragNode(simulation));

    const nodeFill = (datum) => {
      if (currentNode && datum.id === currentNode.id) return '#d9dce3';
      if (linkedIds.has(datum.id)) return '#e4e7eb';
      return '#d8d8d8';
    };

    node.append('circle')
      .attr('r', (datum) => (currentNode && datum.id === currentNode.id ? 7 : 6))
      .attr('fill', nodeFill)
      .attr('stroke', nodeFill)
      .attr('stroke-width', 4)
      .attr('paint-order', 'stroke fill');

    node.append('text')
      .text((datum) => truncateLabel(datum.title || datum.label, 22))
      .attr('x', 10)
      .attr('y', 4);

    mainGroup.classed('labels-visible', currentScale >= GRAPH_CONFIG.labelRevealScale);

    node
      .on('mouseover', function (event, datum) {
        const connectedIds = connectedIdsFor(datum, data.links);

        node.classed('dimmed', (candidate) => !connectedIds.has(candidate.id));
        link.classed('dimmed', (candidate) => {
          const sourceId = typeof candidate.source === 'object' ? candidate.source.id : candidate.source;
          const targetId = typeof candidate.target === 'object' ? candidate.target.id : candidate.target;
          return sourceId !== datum.id && targetId !== datum.id;
        });
        link.classed('highlighted', (candidate) => {
          const sourceId = typeof candidate.source === 'object' ? candidate.source.id : candidate.source;
          const targetId = typeof candidate.target === 'object' ? candidate.target.id : candidate.target;
          return sourceId === datum.id || targetId === datum.id;
        });

        tooltip.textContent = datum.title || datum.label || '';
        tooltip.style.display = 'block';
      })
      .on('mousemove', function (event) {
        const rect = container.getBoundingClientRect();
        tooltip.style.left = `${event.clientX - rect.left + 14}px`;
        tooltip.style.top = `${event.clientY - rect.top - 12}px`;
      })
      .on('mouseout', function () {
        node.classed('dimmed', false);
        link.classed('dimmed', false).classed('highlighted', false);
        tooltip.style.display = 'none';
      })
      .on('click', function (event, datum) {
        if (!datum.url) return;
        const base = window.SITE_BASEURL || '';
        const href = `${base}${datum.url}`;
        if (typeof options.onNodeClick === 'function') {
          options.onNodeClick(href, datum);
          return;
        }
        window.location.href = href;
      });

    let dragGridX = 0;
    let dragGridY = 0;
    let lastDragPoint = null;

    svg.call(
      d3.drag()
        .on('start', (event) => {
          if (event.sourceEvent.target !== svgElement) return;
          lastDragPoint = { x: event.x, y: event.y };
          simulation.alphaTarget(GRAPH_CONFIG.dragAlphaTarget).restart();
        })
        .on('drag', (event) => {
          if (event.sourceEvent.target !== svgElement || !lastDragPoint) return;

          const dx = event.x - lastDragPoint.x;
          const dy = event.y - lastDragPoint.y;
          lastDragPoint = { x: event.x, y: event.y };

          dragGridX += dx;
          dragGridY += dy;
          container.style.setProperty('--graph-grid-x', `${dragGridX % GRAPH_CONFIG.gridSize}px`);
          container.style.setProperty('--graph-grid-y', `${dragGridY % GRAPH_CONFIG.gridSize}px`);

          data.nodes.forEach((datum) => {
            datum.x += dx * GRAPH_CONFIG.dragShiftFactor;
            datum.y += dy * GRAPH_CONFIG.dragShiftFactor;
            datum.vx = (datum.vx || 0) + dx * GRAPH_CONFIG.dragVelocityFactor;
            datum.vy = (datum.vy || 0) + dy * GRAPH_CONFIG.dragVelocityFactor;
          });
        })
        .on('end', () => {
          lastDragPoint = null;
          simulation.alphaTarget(0);
        })
    );

    simulation.on('tick', () => {
      const margin = 10;

      data.nodes.forEach((datum) => {
        if (datum.x < margin) {
          datum.vx += (margin - datum.x) * GRAPH_CONFIG.springStrength;
          datum.vx *= GRAPH_CONFIG.damping;
        } else if (datum.x > width - margin) {
          datum.vx -= (datum.x - (width - margin)) * GRAPH_CONFIG.springStrength;
          datum.vx *= GRAPH_CONFIG.damping;
        }

        if (datum.y < margin) {
          datum.vy += (margin - datum.y) * GRAPH_CONFIG.springStrength;
          datum.vy *= GRAPH_CONFIG.damping;
        } else if (datum.y > height - margin) {
          datum.vy -= (datum.y - (height - margin)) * GRAPH_CONFIG.springStrength;
          datum.vy *= GRAPH_CONFIG.damping;
        }
      });

      link
        .attr('x1', (datum) => datum.source.x)
        .attr('y1', (datum) => datum.source.y)
        .attr('x2', (datum) => datum.target.x)
        .attr('y2', (datum) => datum.target.y);

      node.attr('transform', (datum) => `translate(${datum.x},${datum.y})`);
    });

    return simulation;
  }

  async function mountGraph(options) {
    const sourceData = await loadGraphData();
    if (!sourceData || !sourceData.nodes || !sourceData.nodes.length) return null;
    const localData = cloneGraphData(sourceData);
    return renderGraphInto(localData, options);
  }

  let fullPageSimulation = null;

  async function initFullPageGraph() {
    const container = document.getElementById('graph-container-full');
    const svgElement = document.getElementById('knowledge-graph-full');
    if (!container || !svgElement) return;

    if (fullPageSimulation) fullPageSimulation.stop();
    fullPageSimulation = await mountGraph({
      containerId: 'graph-container-full',
      svgId: 'knowledge-graph-full',
      currentUrl: window.CURRENT_PAGE || '/',
    });
  }

  window.BlogPhysicsGraph = {
    mount: mountGraph,
    initFullPage: initFullPageGraph,
  };

  function init() {
    initFullPageGraph();

    window.addEventListener('resize', () => {
      if (document.getElementById('graph-container-full')) {
        initFullPageGraph();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
