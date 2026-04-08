(function () {
  const PHYSICS = {
    repulsion: -Math.pow(10, 3),
    linkDistance: 38,
    linkStrength: 1,
    velocityDecay: 0.45,
    centerStrength: 0.1,
  };

  const NODE_RADIUS = 5;
  const NODE_HOVER_RADIUS = 7;
  const NODE_LABEL_ZOOM_THRESHOLD = 1.0;
  const DEFAULT_NODE_FILL = '#4d4d4d';
  const DEFAULT_LINK_STROKE = 'rgba(77, 77, 77, 0.75)';
  const TOOLTIP_SURFACE = 'rgba(29, 29, 29, 0.94)';
  const CONNECTOR_DRAW_MS = 180;
  const TOOLTIP_REVEAL_DELAY_MS = 110;
  const DOUBLE_TAP_WINDOW_MS = 280;
  const DOUBLE_TAP_MAX_MOVE_PX = 32;

  let graphDataPromise = null;

  function getBaseUrl() {
    return window.SITE_BASEURL || '';
  }

  function getZoomGaugeHeight(zoomLevel) {
    return `${((Math.log(zoomLevel) - Math.log(0.05)) / (Math.log(12) - Math.log(0.05))) * 100}%`;
  }

  function getLinkEndpointId(endpoint) {
    return typeof endpoint === 'string' ? endpoint : endpoint.id;
  }

  function isMobileViewport() {
    return window.matchMedia('(max-width: 680px)').matches;
  }

  function formatNodeLabel(label) {
    if (!label) return '';
    return label.length > 10 ? `${label.slice(0, 10)}...` : label;
  }

  function normalizeLinks(links) {
    return links.map((link) => ({
      ...link,
      source: getLinkEndpointId(link.source),
      target: getLinkEndpointId(link.target),
    }));
  }

  function calculateFitScale(nodes, width, height) {
    if (width === 0 || height === 0) {
      return null;
    }

    const positionedNodes = nodes.filter((node) => node.x !== undefined && node.y !== undefined);
    if (positionedNodes.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    positionedNodes.forEach((node) => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    });

    const padding = Math.min(width, height) * 0.15;
    const graphWidth = maxX - minX + padding * 2;
    const graphHeight = maxY - minY + padding * 2;
    const scale = Math.min(width / graphWidth, height / graphHeight, 1.2);
    const mobileAdjustedScale = isMobileViewport() ? scale * 0.88 : scale;

    return Math.max(0.05, Math.min(mobileAdjustedScale, 12));
  }

  function mergeNodesForSimulation(incomingNodes, existingNodes, width, height) {
    const existingById = new Map(existingNodes.map((node) => [node.id, node]));

    return incomingNodes.map((incomingNode) => {
      const existingNode = existingById.get(incomingNode.id);
      const nextNode = {
        ...incomingNode,
        x: existingNode ? existingNode.x : incomingNode.x,
        y: existingNode ? existingNode.y : incomingNode.y,
        vx: existingNode ? existingNode.vx : incomingNode.vx,
        vy: existingNode ? existingNode.vy : incomingNode.vy,
      };

      if (nextNode.x === undefined || nextNode.y === undefined) {
        nextNode.x = width / 2 + (Math.random() - 0.5) * 50;
        nextNode.y = height / 2 + (Math.random() - 0.5) * 50;
      }

      return nextNode;
    });
  }

  function fetchGraphData() {
    if (graphDataPromise) return graphDataPromise;
    graphDataPromise = fetch(`${getBaseUrl()}/graph-data.json`)
      .then((response) => response.json())
      .then((data) => ({
        nodes: (data.nodes || []).map((node) => ({
          id: node.id,
          label: node.title,
          url: node.url,
          color: DEFAULT_NODE_FILL,
        })),
        links: normalizeLinks(data.links || []),
      }))
      .catch((error) => {
        graphDataPromise = null;
        throw error;
      });
    return graphDataPromise;
  }

  class GraphExplorer {
    constructor(root, options) {
      this.root = root;
      this.options = options || {};
      this.nodes = (this.options.nodes || []).map((node) => ({ ...node }));
      this.links = normalizeLinks(this.options.links || []);

      this.dimensions = { width: 0, height: 0 };
      this.gridOffset = { x: 0, y: 0 };
      this.zoomLevel = 1;
      this.autoFitZoomLevel = 1;
      this.graphNodes = [];
      this.currentTransform = d3.zoomIdentity;
      this.hoveredNodeId = null;
      this.draggedNodeId = null;
      this.activeNode = null;
      this.nodeLabelsVisible = false;
      this.connectorAnimatedNodeId = null;
      this.connectorResetTimer = null;
      this.tooltipRevealTimer = null;
      this.openFitTimer = null;
      this.initialFitPerformed = false;
      this.previousGraphSize = { nodeCount: 0, linkCount: 0 };
      this.resizeObserver = null;
      this.simulation = null;
      this.zoom = null;
      this.linkSelection = null;
      this.nodeSelection = null;
      this.isDestroyed = false;
      this.lastTouchTapTime = 0;
      this.lastTouchTapPoint = null;
      this.doubleTapZoomGesture = null;
      this.boundTouchPointerDown = (event) => this.handleTouchPointerDown(event);
      this.boundTouchPointerMove = (event) => this.handleTouchPointerMove(event);
      this.boundTouchPointerUp = (event) => this.handleTouchPointerUp(event);

      this.renderShell();
      this.bindElements();
      this.bindUi();
      this.observeSize();
    }

    renderShell() {
      this.root.innerHTML = `
        <div class="graph-engine">
          <svg class="graph-engine-overlay" aria-hidden="true">
            <path class="graph-engine-connector"></path>
          </svg>
          <div class="graph-engine-tooltip-anchor">
            <div class="graph-engine-tooltip-box">
              <div class="graph-engine-tooltip"></div>
            </div>
          </div>
          <header class="graph-engine-header">
            <div class="graph-engine-header-main">
              <div class="graph-engine-status-dot"></div>
              <h1 class="graph-engine-title">Graph Engine</h1>
            </div>
            ${
              this.options.onClose
                ? `<button class="graph-engine-close" type="button" aria-label="Close explorer" title="Close">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M4 4l8 8M12 4 4 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                    </svg>
                  </button>`
                : '<div class="graph-engine-spacer"></div>'
            }
          </header>
          <main class="graph-engine-main">
            <div class="graph-engine-zoom-panel" aria-hidden="true">
              <div class="graph-engine-zoom-track">
                <div class="graph-engine-zoom-fill"></div>
                <div class="graph-engine-zoom-mark"></div>
              </div>
              <div class="graph-engine-zoom-value">1.0x</div>
            </div>
            <div class="graph-engine-stats" aria-hidden="true">
              <div class="graph-engine-stat-line graph-engine-stat-nodes"></div>
              <div class="graph-engine-stat-line graph-engine-stat-links"></div>
            </div>
            <svg class="graph-engine-svg" width="100%" height="100%"></svg>
            <div class="graph-engine-grid" aria-hidden="true"></div>
          </main>
          <footer class="graph-engine-footer">
            <div class="graph-engine-footer-status">System Stable</div>
            <button class="graph-engine-fit" type="button">Auto Fit</button>
          </footer>
        </div>
      `;
    }

    bindElements() {
      this.engine = this.root.querySelector('.graph-engine');
      this.main = this.root.querySelector('.graph-engine-main');
      this.svgElement = this.root.querySelector('.graph-engine-svg');
      this.overlayElement = this.root.querySelector('.graph-engine-overlay');
      this.connectorPath = this.root.querySelector('.graph-engine-connector');
      this.tooltipAnchor = this.root.querySelector('.graph-engine-tooltip-anchor');
      this.tooltipElement = this.root.querySelector('.graph-engine-tooltip');
      this.zoomFill = this.root.querySelector('.graph-engine-zoom-fill');
      this.zoomMark = this.root.querySelector('.graph-engine-zoom-mark');
      this.zoomValue = this.root.querySelector('.graph-engine-zoom-value');
      this.nodeCountElement = this.root.querySelector('.graph-engine-stat-nodes');
      this.linkCountElement = this.root.querySelector('.graph-engine-stat-links');
      this.closeButton = this.root.querySelector('.graph-engine-close');
      this.fitButton = this.root.querySelector('.graph-engine-fit');
    }

    bindUi() {
      if (this.closeButton && this.options.onClose) {
        this.closeButton.addEventListener('click', this.options.onClose);
      }
      if (this.fitButton) {
        this.fitButton.addEventListener('click', () => this.fitToView(false));
      }
    }

    observeSize() {
      if (!this.main) return;
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          this.dimensions = {
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          };
          this.setupCanvas();
          this.updateGraph();
        }
      });
      this.resizeObserver.observe(this.main);
    }

    clearTooltipRevealTimer() {
      if (this.tooltipRevealTimer !== null) {
        window.clearTimeout(this.tooltipRevealTimer);
        this.tooltipRevealTimer = null;
      }
    }

    clearConnectorResetTimer() {
      if (this.connectorResetTimer !== null) {
        window.clearTimeout(this.connectorResetTimer);
        this.connectorResetTimer = null;
      }
    }

    clearOpenFitTimer() {
      if (this.openFitTimer !== null) {
        window.clearTimeout(this.openFitTimer);
        this.openFitTimer = null;
      }
    }

    handleTouchPointerDown(event) {
      if (!isMobileViewport() || event.pointerType !== 'touch' || !this.zoom || !this.svgElement) {
        return;
      }

      const now = Date.now();
      const point = { x: event.clientX, y: event.clientY };
      const isSecondTap =
        this.lastTouchTapPoint &&
        now - this.lastTouchTapTime <= DOUBLE_TAP_WINDOW_MS &&
        Math.hypot(point.x - this.lastTouchTapPoint.x, point.y - this.lastTouchTapPoint.y) <= DOUBLE_TAP_MAX_MOVE_PX;

      this.lastTouchTapTime = now;
      this.lastTouchTapPoint = point;

      if (!isSecondTap) {
        this.doubleTapZoomGesture = null;
        return;
      }

      const rect = this.svgElement.getBoundingClientRect();
      const focusX = event.clientX - rect.left;
      const focusY = event.clientY - rect.top;
      const startTransform = this.currentTransform;
      const graphFocusX = (focusX - startTransform.x) / startTransform.k;
      const graphFocusY = (focusY - startTransform.y) / startTransform.k;

      this.doubleTapZoomGesture = {
        pointerId: event.pointerId,
        startY: event.clientY,
        focusX,
        focusY,
        graphFocusX,
        graphFocusY,
        startTransform,
      };

      event.preventDefault();
      event.stopPropagation();
    }

    handleTouchPointerMove(event) {
      const gesture = this.doubleTapZoomGesture;
      if (!gesture || event.pointerType !== 'touch' || event.pointerId !== gesture.pointerId || !this.zoom) {
        return;
      }

      const deltaY = event.clientY - gesture.startY;
      const scaleFactor = Math.exp(deltaY * 0.01);
      const nextScale = Math.max(0.05, Math.min(12, gesture.startTransform.k * scaleFactor));
      const nextTransform = d3.zoomIdentity
        .translate(gesture.focusX, gesture.focusY)
        .scale(nextScale)
        .translate(-gesture.graphFocusX, -gesture.graphFocusY);

      this.svg.interrupt();
      this.svg.call(this.zoom.transform, nextTransform);
      event.preventDefault();
      event.stopPropagation();
    }

    handleTouchPointerUp(event) {
      const gesture = this.doubleTapZoomGesture;
      if (!gesture || event.pointerId !== gesture.pointerId) {
        return;
      }

      this.doubleTapZoomGesture = null;
      event.preventDefault();
      event.stopPropagation();
    }

    bindMobileZoomGesture() {
      if (!this.svgElement) return;
      this.svgElement.removeEventListener('pointerdown', this.boundTouchPointerDown);
      this.svgElement.removeEventListener('pointermove', this.boundTouchPointerMove);
      this.svgElement.removeEventListener('pointerup', this.boundTouchPointerUp);
      this.svgElement.removeEventListener('pointercancel', this.boundTouchPointerUp);
      this.svgElement.addEventListener('pointerdown', this.boundTouchPointerDown, { passive: false });
      this.svgElement.addEventListener('pointermove', this.boundTouchPointerMove, { passive: false });
      this.svgElement.addEventListener('pointerup', this.boundTouchPointerUp, { passive: false });
      this.svgElement.addEventListener('pointercancel', this.boundTouchPointerUp, { passive: false });
    }

    updateViewport(transform) {
      this.currentTransform = transform;
      this.updateNodeLabelVisibility();
      this.zoomLevel = transform.k;
      this.gridOffset = {
        x: transform.x % 40,
        y: transform.y % 40,
      };

      if (this.zoomFill) {
        this.zoomFill.style.height = getZoomGaugeHeight(this.zoomLevel);
      }
      if (this.zoomMark) {
        this.zoomMark.style.bottom = getZoomGaugeHeight(this.autoFitZoomLevel);
      }
      if (this.zoomValue) {
        this.zoomValue.textContent = `${this.zoomLevel.toFixed(1)}x`;
      }
      if (this.main) {
        this.main.style.setProperty('--graph-grid-x', `${this.gridOffset.x}px`);
        this.main.style.setProperty('--graph-grid-y', `${this.gridOffset.y}px`);
      }
    }

    updateNodeLabelVisibility(force) {
      if (!this.nodeSelection) return;

      const shouldShow = this.currentTransform.k >= NODE_LABEL_ZOOM_THRESHOLD;
      if (!force && shouldShow === this.nodeLabelsVisible) return;

      this.nodeLabelsVisible = shouldShow;
      const labelSelection = this.nodeSelection.select('text.node-label').interrupt();

      if (shouldShow) {
        labelSelection
          .style('display', null)
          .transition()
          .duration(180)
          .ease(d3.easeCubicOut)
          .attr('opacity', 0.92);
        return;
      }

      labelSelection
        .transition()
        .duration(160)
        .ease(d3.easeCubicOut)
        .attr('opacity', 0)
        .on('end', function () {
          d3.select(this).style('display', 'none');
        });
    }

    applyInteractionStyles() {
      if (!this.linkSelection || !this.nodeSelection) return;

      const transition = d3.transition().duration(180).ease(d3.easeCubicOut);
      const focusedNodeId = this.activeNode ? this.activeNode.id : null;

      if (!focusedNodeId) {
        this.linkSelection
          .interrupt()
          .transition(transition)
          .attr('stroke', DEFAULT_LINK_STROKE)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', 1.5);

        this.nodeSelection
          .interrupt()
          .transition(transition)
          .attr('opacity', 1);

        this.nodeSelection
          .select('circle.graph-node-core')
          .interrupt()
          .transition(transition)
          .attr('fill', DEFAULT_NODE_FILL)
          .attr('r', NODE_RADIUS)
          .attr('stroke', 'rgba(0,0,0,0.05)')
          .attr('stroke-width', 1);
        return;
      }

      const connectedNodeIds = new Set([focusedNodeId]);
      this.linkSelection.each((link) => {
        const sourceId = getLinkEndpointId(link.source);
        const targetId = getLinkEndpointId(link.target);
        if (sourceId === focusedNodeId || targetId === focusedNodeId) {
          connectedNodeIds.add(sourceId);
          connectedNodeIds.add(targetId);
        }
      });

      this.linkSelection
        .interrupt()
        .transition(transition)
        .attr('stroke', (link) => {
          const sourceId = getLinkEndpointId(link.source);
          const targetId = getLinkEndpointId(link.target);
          return sourceId === focusedNodeId || targetId === focusedNodeId
            ? 'rgba(26, 137, 23, 0.85)'
            : 'rgba(0, 0, 0, 0.08)';
        })
        .attr('stroke-opacity', (link) => {
          const sourceId = getLinkEndpointId(link.source);
          const targetId = getLinkEndpointId(link.target);
          return sourceId === focusedNodeId || targetId === focusedNodeId ? 1 : 0.45;
        })
        .attr('stroke-width', (link) => {
          const sourceId = getLinkEndpointId(link.source);
          const targetId = getLinkEndpointId(link.target);
          return sourceId === focusedNodeId || targetId === focusedNodeId ? 2.25 : 1;
        });

      this.nodeSelection
        .interrupt()
        .transition(transition)
        .attr('opacity', (node) => (connectedNodeIds.has(node.id) ? 1 : 0.22));

      this.nodeSelection
        .select('circle.graph-node-core')
        .interrupt()
        .transition(transition)
        .attr('fill', (node) => (node.id === focusedNodeId ? '#1a8917' : DEFAULT_NODE_FILL))
        .attr('r', (node) => (node.id === focusedNodeId ? NODE_HOVER_RADIUS : NODE_RADIUS))
        .attr('stroke', (node) =>
          node.id === focusedNodeId ? 'rgba(26,137,23,0.28)' : 'rgba(0,0,0,0.05)',
        )
        .attr('stroke-width', (node) => (node.id === focusedNodeId ? 1.5 : 1));
    }

    updateTooltipOverlay() {
      const focusedNodeId = this.activeNode ? this.activeNode.id : null;

      if (!focusedNodeId || !this.tooltipAnchor) {
        if (this.connectorPath) {
          this.connectorPath.setAttribute('d', '');
          this.connectorPath.style.transition = 'none';
          this.connectorPath.style.strokeDasharray = 'none';
          this.connectorPath.style.strokeDashoffset = '0';
        }
        this.connectorAnimatedNodeId = null;
        this.clearConnectorResetTimer();
        return;
      }

      const node = this.graphNodes.find((entry) => entry.id === focusedNodeId);
      if (
        !node ||
        node.x === undefined ||
        node.y === undefined ||
        !this.main ||
        !this.engine ||
        !this.connectorPath
      ) {
        return;
      }

      const transform = this.currentTransform;
      const containerRect = this.main.getBoundingClientRect();
      const rootRect = this.engine.getBoundingClientRect();
      const containerOffsetX = containerRect.left - rootRect.left;
      const containerOffsetY = containerRect.top - rootRect.top;
      const nodeX = containerOffsetX + node.x * transform.k + transform.x;
      const nodeY = containerOffsetY + node.y * transform.k + transform.y;
      const boxWidth = this.tooltipAnchor.offsetWidth || 160;
      const boxHeight = this.tooltipAnchor.offsetHeight || 48;

      let boxX = nodeX + 28;
      let boxY = nodeY - boxHeight - 28;

      if (boxX + boxWidth > containerOffsetX + this.dimensions.width - 16) {
        boxX = nodeX - boxWidth - 28;
      }

      boxX = Math.max(
        containerOffsetX + 16,
        Math.min(boxX, containerOffsetX + this.dimensions.width - boxWidth - 16),
      );
      boxY = Math.max(
        containerOffsetY + 16,
        Math.min(boxY, containerOffsetY + this.dimensions.height - boxHeight - 16),
      );

      this.tooltipAnchor.style.transform = `translate(${boxX}px, ${boxY}px)`;

      if (isMobileViewport()) {
        this.connectorPath.setAttribute('d', '');
        this.connectorPath.style.transition = 'none';
        this.connectorPath.style.strokeDasharray = 'none';
        this.connectorPath.style.strokeDashoffset = '0';
        this.connectorAnimatedNodeId = null;
        this.clearConnectorResetTimer();
        return;
      }

      const rectLeft = boxX;
      const rectRight = boxX + boxWidth;
      const rectTop = boxY;
      const rectBottom = boxY + boxHeight;
      const attachOnLeft = nodeX <= rectLeft + boxWidth / 2;
      const targetX = attachOnLeft ? rectLeft : rectRight;
      const targetY = Math.max(rectTop + 8, Math.min(nodeY, rectBottom - 8));
      const elbowX = attachOnLeft ? targetX - 18 : targetX + 18;
      const connectorPath = `M ${nodeX} ${nodeY} L ${elbowX} ${targetY} L ${targetX} ${targetY}`;
      this.connectorPath.setAttribute('d', connectorPath);

      if (this.connectorAnimatedNodeId !== focusedNodeId) {
        this.connectorAnimatedNodeId = focusedNodeId;
        this.clearConnectorResetTimer();

        const connectorLength = this.connectorPath.getTotalLength();
        this.connectorPath.style.transition = 'none';
        this.connectorPath.style.strokeDasharray = `${connectorLength}`;
        this.connectorPath.style.strokeDashoffset = `${connectorLength}`;
        this.connectorPath.getBoundingClientRect();
        this.connectorPath.style.transition =
          `stroke-dashoffset ${CONNECTOR_DRAW_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`;
        this.connectorPath.style.strokeDashoffset = '0';

        this.connectorResetTimer = window.setTimeout(() => {
          if (!this.connectorPath) return;
          this.connectorPath.style.strokeDasharray = 'none';
          this.connectorPath.style.strokeDashoffset = '0';
        }, CONNECTOR_DRAW_MS);
      }
    }

    syncActiveNode() {
      const nextId = this.draggedNodeId || this.hoveredNodeId;

      if (!nextId) {
        this.activeNode = null;
        if (this.tooltipElement) {
          this.tooltipElement.textContent = '';
          this.tooltipElement.classList.remove('is-visible');
        }
        this.clearTooltipRevealTimer();
        this.applyInteractionStyles();
        this.updateTooltipOverlay();
        return;
      }

      const node = this.graphNodes.find((entry) => entry.id === nextId) || this.nodes.find((entry) => entry.id === nextId);
      if (!node) {
        this.activeNode = null;
        if (this.tooltipElement) {
          this.tooltipElement.textContent = '';
          this.tooltipElement.classList.remove('is-visible');
        }
        this.clearTooltipRevealTimer();
        this.applyInteractionStyles();
        this.updateTooltipOverlay();
        return;
      }

      const previousActiveId = this.activeNode ? this.activeNode.id : null;
      this.activeNode = { id: node.id, label: node.label };

      if (this.tooltipElement) {
        this.tooltipElement.textContent = node.label;
      }

      this.clearTooltipRevealTimer();
      if (!previousActiveId || previousActiveId !== node.id) {
        if (this.tooltipElement) {
          this.tooltipElement.classList.remove('is-visible');
        }
        this.tooltipRevealTimer = window.setTimeout(() => {
          if (this.tooltipElement) {
            this.tooltipElement.classList.add('is-visible');
          }
        }, TOOLTIP_REVEAL_DELAY_MS);
      } else if (this.tooltipElement) {
        this.tooltipElement.classList.add('is-visible');
      }

      this.applyInteractionStyles();
      window.requestAnimationFrame(() => this.updateTooltipOverlay());
    }

    renderGraph() {
      if (this.linkSelection) {
        this.linkSelection
          .attr('x1', (d) => d.source.x || 0)
          .attr('y1', (d) => d.source.y || 0)
          .attr('x2', (d) => d.target.x || 0)
          .attr('y2', (d) => d.target.y || 0);
      }

      if (this.nodeSelection) {
        this.nodeSelection.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
      }

      this.updateTooltipOverlay();
    }

    fitToView(instant) {
      if (!this.svg || !this.zoom || this.dimensions.width === 0 || this.dimensions.height === 0) {
        return;
      }

      const width = this.dimensions.width;
      const height = this.dimensions.height;
      const clampedScale = calculateFitScale(this.graphNodes, width, height);

      if (clampedScale === null) return;
      this.autoFitZoomLevel = clampedScale;
      if (this.zoomMark) {
        this.zoomMark.style.bottom = getZoomGaugeHeight(this.autoFitZoomLevel);
      }

      const positionedNodes = this.graphNodes.filter((node) => node.x !== undefined && node.y !== undefined);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      positionedNodes.forEach((node) => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
      });

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const transform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(clampedScale)
        .translate(-centerX, -centerY);

      this.svg.interrupt();

      if (instant) {
        this.svg.call(this.zoom.transform, transform);
        return;
      }

      this.svg
        .transition()
        .duration(1000)
        .ease(d3.easeCubicOut)
        .call(this.zoom.transform, transform);
    }

    setupCanvas() {
      if (!this.svgElement || this.dimensions.width === 0 || this.dimensions.height === 0) return;
      if (this.simulation) {
        this.svg.interrupt();
        this.svg.on('.zoom', null);
        this.simulation.stop();
      }

      this.svg = d3.select(this.svgElement);
      this.svg.interrupt();
      this.svg.selectAll('*').remove();

      const width = this.dimensions.width;
      const height = this.dimensions.height;
      const mainGroup = this.svg.append('g').attr('class', 'main-group');
      this.linkLayer = mainGroup.append('g').attr('stroke', DEFAULT_LINK_STROKE);
      this.nodeLayer = mainGroup.append('g');
      this.linkSelection = null;
      this.nodeSelection = null;

      let lastTransform = null;
      let lastTimestamp = 0;
      let velocityX = 0;
      let velocityY = 0;

      this.zoom = d3.zoom()
        .scaleExtent([0.05, 12])
        .on('start', () => {
          this.svg.interrupt();
        })
        .on('zoom', (event) => {
          const transform = event.transform;
          mainGroup.attr('transform', transform.toString());
          this.updateViewport(transform);

          const sourceEvent = event.sourceEvent;
          if (sourceEvent && (sourceEvent.type === 'mousemove' || sourceEvent.type === 'touchmove')) {
            const now = Date.now();
            const dt = now - lastTimestamp;
            if (dt > 0 && lastTransform) {
              velocityX = (transform.x - lastTransform.x) / dt;
              velocityY = (transform.y - lastTransform.y) / dt;
            }
            lastTransform = transform;
            lastTimestamp = now;
          }
        })
        .on('end', (event) => {
          const sourceEvent = event.sourceEvent;

          if (sourceEvent && (sourceEvent.type === 'mouseup' || sourceEvent.type === 'touchend')) {
            const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
            if (speed > 0.2) {
              const factor = 150;
              const targetTransform = d3.zoomIdentity
                .translate(
                  event.transform.x + velocityX * factor,
                  event.transform.y + velocityY * factor
                )
                .scale(event.transform.k);

              this.svg
                .transition()
                .duration(Math.min(1500, speed * 800))
                .ease(d3.easeQuadOut)
                .call(this.zoom.transform, targetTransform);
            }
          }

          lastTransform = null;
          lastTimestamp = 0;
          velocityX = 0;
          velocityY = 0;
        });

      this.svg.call(this.zoom);
      this.svg.call(this.zoom.transform, this.currentTransform);
      this.bindMobileZoomGesture();

      this.simulation = d3.forceSimulation()
        .force(
          'link',
          d3.forceLink()
            .id((d) => d.id)
            .distance(PHYSICS.linkDistance)
            .strength(PHYSICS.linkStrength)
        )
        .force('charge', d3.forceManyBody().strength(PHYSICS.repulsion))
        .force('x', d3.forceX(width / 2).strength(PHYSICS.centerStrength))
        .force('y', d3.forceY(height / 2).strength(PHYSICS.centerStrength))
        .velocityDecay(PHYSICS.velocityDecay)
        .on('tick', () => this.renderGraph());
    }

    updateGraph() {
      if (!this.simulation || !this.linkLayer || !this.nodeLayer || this.dimensions.width === 0 || this.dimensions.height === 0) {
        return;
      }

      const nextNodes = mergeNodesForSimulation(
        this.nodes,
        this.graphNodes,
        this.dimensions.width,
        this.dimensions.height
      );
      const nextLinks = normalizeLinks(this.links);
      const previousGraphSize = this.previousGraphSize;
      const nodeDelta = nextNodes.length - previousGraphSize.nodeCount;
      const linkDelta = nextLinks.length - previousGraphSize.linkCount;
      const isSingleNodeInsert = nodeDelta === 1 && linkDelta >= 0 && linkDelta <= 1;
      const isLargeStructuralChange =
        previousGraphSize.nodeCount === 0 || nodeDelta < 0 || Math.abs(linkDelta) > 1;

      this.graphNodes = nextNodes;

      const linkForce = this.simulation.force('link');

      this.linkSelection = this.linkLayer
        .selectAll('line')
        .data(nextLinks)
        .join(
          (enter) => enter.append('line').attr('stroke-width', 1.5),
          (update) => update,
          (exit) => exit.remove()
        );

      this.nodeSelection = this.nodeLayer
        .selectAll('g')
        .data(nextNodes, (d) => d.id)
        .join(
          (enter) => {
            const node = enter
              .append('g')
              .attr('class', 'graph-node')
              .attr('cursor', 'grab')
              .on('mouseover', (_, datum) => {
                this.hoveredNodeId = datum.id;
                this.syncActiveNode();
              })
              .on('mouseout', (_, datum) => {
                if (this.hoveredNodeId === datum.id) {
                  this.hoveredNodeId = null;
                  this.syncActiveNode();
                }
              })
              .on('click', (event, datum) => {
                if (event.defaultPrevented || !datum.url) return;
                window.location.href = datum.url;
              })
              .call(
                d3.drag()
                  .on('start', (event, datum) => {
                    const sourceEvent = event.sourceEvent;
                    if (sourceEvent) {
                      sourceEvent.stopPropagation();
                      sourceEvent.preventDefault();
                    }
                    if (!event.active) {
                      this.simulation.alphaTarget(0.3).restart();
                    }
                    this.draggedNodeId = datum.id;
                    this.syncActiveNode();
                    datum.fx = datum.x;
                    datum.fy = datum.y;
                  })
                  .on('drag', (event, datum) => {
                    datum.fx = event.x;
                    datum.fy = event.y;
                    this.updateTooltipOverlay();
                  })
                  .on('end', (event, datum) => {
                    if (!event.active) {
                      this.simulation.alphaTarget(0);
                    }
                    datum.fx = null;
                    datum.fy = null;
                    if (this.draggedNodeId === datum.id) {
                      this.draggedNodeId = null;
                    }
                    this.syncActiveNode();
                  })
              );

            node
              .append('circle')
              .attr('class', 'graph-node-core')
              .attr('r', NODE_RADIUS)
              .attr('fill', DEFAULT_NODE_FILL)
              .attr('stroke', 'rgba(0,0,0,0.05)')
              .attr('stroke-width', 1);

            node
              .append('text')
              .attr('class', 'node-label')
              .attr('text-anchor', 'middle')
              .attr('y', NODE_RADIUS + 10)
              .attr('font-size', 9)
              .attr('font-weight', 500)
              .attr('fill', 'rgba(0,0,0,0.62)')
              .attr('opacity', this.nodeLabelsVisible ? 0.92 : 0)
              .style('display', this.nodeLabelsVisible ? null : 'none')
              .style('pointer-events', 'none')
              .text((d) => formatNodeLabel(d.label));

            return node;
          },
          (update) => update,
          (exit) => exit.remove()
        );

      this.nodeSelection.select('text.node-label').text((d) => formatNodeLabel(d.label));
      this.updateNodeLabelVisibility(true);

      if (this.nodeCountElement) {
        this.nodeCountElement.textContent = `${nextNodes.length} Nodes`;
      }
      if (this.linkCountElement) {
        this.linkCountElement.textContent = `${nextLinks.length} Links`;
      }

      this.simulation.nodes(nextNodes);
      linkForce.links(nextLinks);
      this.simulation
        .alpha(isSingleNodeInsert ? 0.05 : isLargeStructuralChange ? 0.7 : 0.4)
        .restart();
      this.renderGraph();

      this.previousGraphSize = {
        nodeCount: nextNodes.length,
        linkCount: nextLinks.length,
      };

      const nextAutoFitZoom = calculateFitScale(nextNodes, this.dimensions.width, this.dimensions.height);
      if (nextAutoFitZoom !== null) {
        this.autoFitZoomLevel = nextAutoFitZoom;
        if (this.zoomMark) {
          this.zoomMark.style.bottom = getZoomGaugeHeight(this.autoFitZoomLevel);
        }
      }

      if (!this.initialFitPerformed && nextNodes.length > 0) {
        this.fitToView(true);
        this.initialFitPerformed = true;
      }

      this.syncActiveNode();
    }

    destroy() {
      this.isDestroyed = true;
      this.clearTooltipRevealTimer();
      this.clearConnectorResetTimer();
      this.clearOpenFitTimer();
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
      if (this.simulation) {
        this.simulation.stop();
      }
      if (this.svg) {
        this.svg.interrupt();
        this.svg.on('.zoom', null);
      }
      if (this.svgElement) {
        this.svgElement.removeEventListener('pointerdown', this.boundTouchPointerDown);
        this.svgElement.removeEventListener('pointermove', this.boundTouchPointerMove);
        this.svgElement.removeEventListener('pointerup', this.boundTouchPointerUp);
        this.svgElement.removeEventListener('pointercancel', this.boundTouchPointerUp);
      }
      this.root.innerHTML = '';
    }
  }

  function lockBodyScroll() {
    const previous = {
      overflow: document.body.style.overflow,
      touchAction: document.body.style.touchAction,
      overscrollBehavior: document.body.style.overscrollBehavior,
    };
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';
    return previous;
  }

  function unlockBodyScroll(previous) {
    if (!previous) return;
    document.body.style.overflow = previous.overflow;
    document.body.style.touchAction = previous.touchAction;
    document.body.style.overscrollBehavior = previous.overscrollBehavior;
  }

  function setupModalExplorer() {
    const openButton = document.getElementById('open-graph-modal');
    const modal = document.getElementById('graph-modal');
    const backdrop = modal ? modal.querySelector('.graph-modal-backdrop') : null;
    const mount = document.getElementById('graph-modal-mount');

    if (!openButton || !modal || !mount) return;

    let explorer = null;
    let bodyState = null;
    let closeTimer = null;

    function destroyExplorer() {
      if (explorer) {
        explorer.destroy();
        explorer = null;
      }
    }

    function closeModal() {
      modal.classList.remove('is-preparing');
      modal.classList.remove('is-open');
      modal.classList.add('is-closing');
      modal.setAttribute('aria-hidden', 'true');
      unlockBodyScroll(bodyState);
      bodyState = null;
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        destroyExplorer();
        modal.classList.remove('is-closing');
        modal.classList.remove('is-preparing');
      }, 420);
    }

    function openModal() {
      window.clearTimeout(closeTimer);
      destroyExplorer();
      fetchGraphData().then((data) => {
        bodyState = lockBodyScroll();
        modal.classList.remove('is-closing');
        modal.classList.add('is-preparing');
        modal.setAttribute('aria-hidden', 'false');
        explorer = new GraphExplorer(mount, {
          nodes: data.nodes,
          links: data.links,
          onClose: closeModal,
        });
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (!explorer) return;
            modal.classList.remove('is-preparing');
            modal.classList.add('is-open');
          });
        });
      }).catch(() => {
        mount.innerHTML = '<div class="graph-engine graph-engine-empty"><p>Unable to load graph data.</p></div>';
        bodyState = lockBodyScroll();
        modal.classList.remove('is-closing');
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
      });
    }

    openButton.addEventListener('click', openModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) {
        closeModal();
      }
    });
  }

  function setupStandaloneExplorer() {
    const mount = document.getElementById('graph-page-root');
    if (!mount) return;

    fetchGraphData()
      .then((data) => {
        new GraphExplorer(mount, {
          nodes: data.nodes,
          links: data.links,
        });
      })
      .catch(() => {
        mount.innerHTML = '<div class="graph-engine graph-engine-empty"><p>Unable to load graph data.</p></div>';
      });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupModalExplorer();
    setupStandaloneExplorer();
  });
})();
