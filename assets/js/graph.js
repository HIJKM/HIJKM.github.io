(function () {
  'use strict';

  const GRAPH_CONFIG = {
    repulsion: -900,
    linkDistance: 10,
    linkStrength: 0.30,
    velocityDecay: 0.60,
    springStrength: 0.35,
    damping: 0.90,
    gridSize: 40,
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

  function createStatus(container, nodes, links) {
    container.querySelectorAll('.graph-status').forEach((el) => el.remove());

    const status = document.createElement('div');
    status.className = 'graph-status';
    status.innerHTML = `
      <div>SYSTEM_STATUS: ACTIVE</div>
      <div>NODE_COUNT: ${nodes.length}</div>
      <div>LINK_COUNT: ${links.length}</div>
    `;
    container.appendChild(status);
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

    const tooltip = createTooltip(container);
    createStatus(container, data.nodes, data.links);

    const svg = d3.select(svgElement)
      .attr('width', width)
      .attr('height', height);

    const mainGroup = svg.append('g').attr('class', 'main-group');

    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        mainGroup.attr('transform', event.transform);
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
      .velocityDecay(GRAPH_CONFIG.velocityDecay);

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

    node.append('circle')
      .attr('r', (datum) => (currentNode && datum.id === currentNode.id ? 7 : 6))
      .attr('fill', (datum) => {
        if (currentNode && datum.id === currentNode.id) return '#d9dce3';
        if (linkedIds.has(datum.id)) return '#e4e7eb';
        return '#d8d8d8';
      });

    node.append('text')
      .text((datum) => truncateLabel(datum.title || datum.label, 22))
      .attr('x', 10)
      .attr('y', 4);

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

    svg.call(
      d3.drag()
        .on('start', (event) => {
          if (event.sourceEvent.target !== svgElement) return;
          simulation.alphaTarget(0.3).restart();
          data.nodes.forEach((datum) => {
            datum.baseX = datum.x;
            datum.baseY = datum.y;
          });
        })
        .on('drag', (event) => {
          if (event.sourceEvent.target !== svgElement) return;

          const dx = event.x - event.subject.x;
          const dy = event.y - event.subject.y;
          const gridX = `${dx % GRAPH_CONFIG.gridSize}px`;
          const gridY = `${dy % GRAPH_CONFIG.gridSize}px`;

          container.style.setProperty('--graph-grid-x', gridX);
          container.style.setProperty('--graph-grid-y', gridY);

          data.nodes.forEach((datum) => {
            datum.x = (datum.baseX || 0) + dx;
            datum.y = (datum.baseY || 0) + dy;
            datum.vx = (datum.vx || 0) + (dx * 0.002);
            datum.vy = (datum.vy || 0) + (dy * 0.002);
          });
        })
        .on('end', () => {
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
