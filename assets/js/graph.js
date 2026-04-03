(function () {
  'use strict';

  const GRAPH_CONFIG = {
    repulsion: -900,
    linkDistance: 10,
    linkStrength: 0.30,
    velocityDecay: 0.60,
    gridSize: 40,
    centerStrength: 0.05,
    collisionPadding: 10,
    dragVelocityFactor: 0.002,
    dragAlphaTarget: 0.3,
    viewportBoundaryPadding: 72,
    viewportBoundaryStrength: 0.11,
    viewportDragResistance: 0.3,
    viewportOverscrollSlack: 96,
    worldPadding: 220,
    burstFitPadding: 140,
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

  function nodeRadius(node, currentNode) {
    const baseRadius = 4.5 + Math.min(node.linkCount || 0, 8) * 0.55;
    if (currentNode && node.id === currentNode.id) return baseRadius + 1.5;
    return baseRadius;
  }

  function graphBounds(nodes, currentNode) {
    if (!nodes.length) {
      return {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodes.forEach((node) => {
      const radius = nodeRadius(node, currentNode) + GRAPH_CONFIG.collisionPadding;
      const x = node.x || 0;
      const y = node.y || 0;
      minX = Math.min(minX, x - radius);
      maxX = Math.max(maxX, x + radius);
      minY = Math.min(minY, y - radius);
      maxY = Math.max(maxY, y + radius);
    });

    return { minX, maxX, minY, maxY };
  }

  function rubberBandDelta(nextValue, min, max, delta, resistance) {
    if (nextValue < min) {
      const overflow = min - nextValue;
      return delta / (1 + overflow * resistance * 0.04);
    }
    if (nextValue > max) {
      const overflow = nextValue - max;
      return delta / (1 + overflow * resistance * 0.04);
    }
    return delta;
  }

  function createWorldBounds(bounds, width, height) {
    const paddingX = Math.max(GRAPH_CONFIG.worldPadding, width * 0.35);
    const paddingY = Math.max(GRAPH_CONFIG.worldPadding, height * 0.35);

    return {
      minX: bounds.minX - paddingX,
      maxX: bounds.maxX + paddingX,
      minY: bounds.minY - paddingY,
      maxY: bounds.maxY + paddingY,
    };
  }

  function worldPanLimits(worldBounds, width, height) {
    return {
      minShiftX: width - worldBounds.maxX,
      maxShiftX: -worldBounds.minX,
      minShiftY: height - worldBounds.maxY,
      maxShiftY: -worldBounds.minY,
    };
  }

  function fitTransformForBounds(bounds, width, height, padding) {
    const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const scale = Math.max(
      0.45,
      Math.min(
        1.05,
        Math.min((width - padding * 2) / boundsWidth, (height - padding * 2) / boundsHeight)
      )
    );

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    return d3.zoomIdentity
      .translate(width / 2 - centerX * scale, height / 2 - centerY * scale)
      .scale(scale);
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
      .filter((event) => {
        if (event.type === 'wheel') return true;
        if (event.type === 'touchstart' || event.type === 'touchmove' || event.type === 'touchend') {
          return event.touches && event.touches.length > 1;
        }
        return false;
      })
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
      .force('x', d3.forceX(width / 2).strength(GRAPH_CONFIG.centerStrength))
      .force('y', d3.forceY(height / 2).strength(GRAPH_CONFIG.centerStrength))
      .force('collision', d3.forceCollide().radius((node) => nodeRadius(node, currentNode) + GRAPH_CONFIG.collisionPadding))
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

    const boundaryRect = mainGroup.append('rect')
      .attr('class', 'graph-boundary')
      .attr('fill', 'none');

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
      .attr('r', (datum) => nodeRadius(datum, currentNode))
      .attr('fill', nodeFill)
      .attr('stroke', nodeFill)
      .attr('stroke-width', 4)
      .attr('paint-order', 'stroke fill');

    node.append('text')
      .text((datum) => truncateLabel(datum.title || datum.label, 22))
      .attr('x', 10)
      .attr('y', 4);

    mainGroup.classed('labels-visible', currentScale >= GRAPH_CONFIG.labelRevealScale);

    const contentBounds = graphBounds(data.nodes, currentNode);
    const worldBounds = createWorldBounds(contentBounds, width, height);
    const panLimits = worldPanLimits(worldBounds, width, height);

    svg.call(
      zoom.transform,
      fitTransformForBounds(
        options.burstOnMount ? worldBounds : contentBounds,
        width,
        height,
        options.burstOnMount ? GRAPH_CONFIG.burstFitPadding : GRAPH_CONFIG.viewportBoundaryPadding
      )
    );

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
    let totalPanX = 0;
    let totalPanY = 0;
    let dragOriginPanX = 0;
    let dragOriginPanY = 0;

    svg.call(
      d3.drag()
        .on('start', (event) => {
          if (event.sourceEvent.target !== svgElement) return;
          data.nodes.forEach((datum) => {
            datum.baseX = datum.x;
            datum.baseY = datum.y;
          });
          dragOriginPanX = totalPanX;
          dragOriginPanY = totalPanY;
          lastDragPoint = { x: event.x, y: event.y };
          simulation.alphaTarget(GRAPH_CONFIG.dragAlphaTarget).restart();
        })
        .on('drag', (event) => {
          if (event.sourceEvent.target !== svgElement || !lastDragPoint) return;

          const dx = event.x - lastDragPoint.x;
          const dy = event.y - lastDragPoint.y;
          const totalDx = event.x - event.subject.x;
          const totalDy = event.y - event.subject.y;
          lastDragPoint = { x: event.x, y: event.y };

          const nextPanX = dragOriginPanX + totalDx;
          const nextPanY = dragOriginPanY + totalDy;

          const appliedDx = rubberBandDelta(
            nextPanX,
            panLimits.minShiftX,
            panLimits.maxShiftX,
            dx,
            GRAPH_CONFIG.viewportDragResistance
          );
          const appliedDy = rubberBandDelta(
            nextPanY,
            panLimits.minShiftY,
            panLimits.maxShiftY,
            dy,
            GRAPH_CONFIG.viewportDragResistance
          );

          totalPanX += appliedDx;
          totalPanY += appliedDy;

          dragGridX += appliedDx;
          dragGridY += appliedDy;
          container.style.setProperty('--graph-grid-x', `${dragGridX % GRAPH_CONFIG.gridSize}px`);
          container.style.setProperty('--graph-grid-y', `${dragGridY % GRAPH_CONFIG.gridSize}px`);

          data.nodes.forEach((datum) => {
            datum.x = (datum.baseX || 0) + totalPanX;
            datum.y = (datum.baseY || 0) + totalPanY;
            datum.vx = (datum.vx || 0) + appliedDx * GRAPH_CONFIG.dragVelocityFactor;
            datum.vy = (datum.vy || 0) + appliedDy * GRAPH_CONFIG.dragVelocityFactor;
          });
        })
        .on('end', () => {
          lastDragPoint = null;
          simulation.alphaTarget(0);
        })
    );

    simulation.on('tick', () => {
      if (
        totalPanX < panLimits.minShiftX ||
        totalPanX > panLimits.maxShiftX ||
        totalPanY < panLimits.minShiftY ||
        totalPanY > panLimits.maxShiftY
      ) {
        const pullX = totalPanX < panLimits.minShiftX
          ? (panLimits.minShiftX - totalPanX)
          : totalPanX > panLimits.maxShiftX
            ? (panLimits.maxShiftX - totalPanX)
            : 0;
        const pullY = totalPanY < panLimits.minShiftY
          ? (panLimits.minShiftY - totalPanY)
          : totalPanY > panLimits.maxShiftY
            ? (panLimits.maxShiftY - totalPanY)
            : 0;

        data.nodes.forEach((datum) => {
          datum.vx = (datum.vx || 0) + pullX * GRAPH_CONFIG.viewportBoundaryStrength;
          datum.vy = (datum.vy || 0) + pullY * GRAPH_CONFIG.viewportBoundaryStrength;
        });

        totalPanX += pullX * GRAPH_CONFIG.viewportBoundaryStrength;
        totalPanY += pullY * GRAPH_CONFIG.viewportBoundaryStrength;
      }

      boundaryRect
        .attr('x', worldBounds.minX)
        .attr('y', worldBounds.minY)
        .attr('width', Math.max(worldBounds.maxX - worldBounds.minX, 0))
        .attr('height', Math.max(worldBounds.maxY - worldBounds.minY, 0));

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
