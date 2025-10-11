/* UBB Indexer Web - Frontend App */
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/indexer-web/frontend/state-loader.ts
var StateLoader;
var init_state_loader = __esm({
  "src/indexer-web/frontend/state-loader.ts"() {
    "use strict";
    StateLoader = class {
      constructor(apiBase = "", config) {
        this.apiBase = apiBase;
        this.config = config || window.UBB_CONFIG;
      }
      async loadTipState() {
        try {
          const stateUrl = `${this.apiBase}${this.config.dataPath}/states/${this.config.tipHash}`;
          console.log("Loading tip state from:", stateUrl);
          const response = await fetch(stateUrl);
          console.log("Response status:", response.status);
          console.log("Response headers:", response.headers);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const responseText = await response.text();
          console.log("Response text (first 200 chars):", responseText.substring(0, 200));
          const state = JSON.parse(responseText);
          console.log("Parsed state:", state);
          return state;
        } catch (error) {
          console.error("Error loading state:", error);
          throw error;
        }
      }
      getConfig() {
        return this.config;
      }
      getImageUrl(txid) {
        return `${this.apiBase}${this.config.dataPath}/images/${txid}.bmp`;
      }
    };
  }
});

// src/indexer-web/frontend/ui-helpers.ts
var UIHelpers;
var init_ui_helpers = __esm({
  "src/indexer-web/frontend/ui-helpers.ts"() {
    "use strict";
    UIHelpers = class {
      /**
       * Set the network environment for generating explorer URLs
       */
      static setEnvironment(environment) {
        this.environment = environment;
      }
      /**
       * Show speech bubble tooltip for a plot on the canvas
       */
      static showPlotTooltip(plot, screenX, screenY) {
        const tooltip = document.getElementById("plot-tooltip");
        const ownerEl = document.getElementById("tooltip-owner");
        const txidEl = document.getElementById("tooltip-txid");
        const uriEl = document.getElementById("tooltip-uri");
        if (!tooltip || !ownerEl || !txidEl || !uriEl)
          return;
        if (plot.status === "BRICKED") {
          ownerEl.textContent = "Owner: N/A (Bricked)";
          ownerEl.style.color = "#ff6b6b";
        } else {
          ownerEl.textContent = `Owner: ${plot.owner}`;
          ownerEl.style.color = "#00ff00";
        }
        const mempoolUrl = this.getMempoolUrl(plot.txid);
        if (mempoolUrl) {
          const shortTxid = plot.txid.substring(0, 8) + "..." + plot.txid.substring(plot.txid.length - 8);
          txidEl.innerHTML = `TX: <a href="${mempoolUrl}" target="_blank" rel="noopener noreferrer" class="tooltip-link">${shortTxid} \u2197</a>`;
        } else {
          const shortTxid = plot.txid.substring(0, 8) + "..." + plot.txid.substring(plot.txid.length - 8);
          txidEl.innerHTML = `<span style="color: #888;">TX: ${shortTxid}</span>`;
        }
        if (plot.uri) {
          uriEl.innerHTML = `<a href="${plot.uri}" target="_blank" rel="noopener noreferrer" class="tooltip-link">${plot.uri} \u2197</a>`;
        } else {
          uriEl.innerHTML = '<span style="color: #888;">No URI</span>';
        }
        tooltip.style.left = `${screenX}px`;
        tooltip.style.top = `${screenY - 140}px`;
        tooltip.classList.remove("hidden");
      }
      /**
       * Hide the plot tooltip
       */
      static hidePlotTooltip() {
        const tooltip = document.getElementById("plot-tooltip");
        if (tooltip) {
          tooltip.classList.add("hidden");
        }
      }
      /**
       * Show the plot list modal with search functionality
       */
      static showPlotListModal(state, onPlotSelect, imageUrlGetter, environment = "mainnet") {
        this.allPlots = state.plots;
        this.onPlotSelected = onPlotSelect;
        this.imageUrlGetter = imageUrlGetter;
        this.environment = environment;
        const modal = document.getElementById("plot-list-modal");
        if (!modal)
          return;
        const searchOwner = document.getElementById("search-owner");
        const searchTxid = document.getElementById("search-txid");
        if (searchOwner)
          searchOwner.value = "";
        if (searchTxid)
          searchTxid.value = "";
        this.renderPlotList(state.plots);
        this.setupPlotListSearch();
        modal.classList.add("active");
      }
      /**
       * Close the plot list modal
       */
      static closePlotListModal() {
        const modal = document.getElementById("plot-list-modal");
        if (modal) {
          modal.classList.remove("active");
        }
      }
      /**
       * Show the about modal
       */
      static showAboutModal() {
        const modal = document.getElementById("about-modal");
        if (modal) {
          modal.classList.add("active");
        }
      }
      /**
       * Close the about modal
       */
      static closeAboutModal() {
        const modal = document.getElementById("about-modal");
        if (modal) {
          modal.classList.remove("active");
        }
      }
      /**
       * Setup search functionality for plot list
       */
      static setupPlotListSearch() {
        const searchOwner = document.getElementById("search-owner");
        const searchTxid = document.getElementById("search-txid");
        const performSearch = () => {
          const ownerQuery = searchOwner?.value.toLowerCase().trim() || "";
          const txidQuery = searchTxid?.value.toLowerCase().trim() || "";
          const filtered = this.allPlots.filter((plot) => {
            const matchesOwner = !ownerQuery || plot.owner.toLowerCase().includes(ownerQuery);
            const matchesTxid = !txidQuery || plot.txid.toLowerCase().includes(txidQuery);
            return matchesOwner && matchesTxid;
          });
          this.renderPlotList(filtered);
        };
        if (searchOwner) {
          searchOwner.removeEventListener("input", performSearch);
          searchOwner.addEventListener("input", performSearch);
        }
        if (searchTxid) {
          searchTxid.removeEventListener("input", performSearch);
          searchTxid.addEventListener("input", performSearch);
        }
      }
      /**
       * Render the plot list
       */
      static renderPlotList(plots) {
        const listBody = document.getElementById("plot-list-body");
        const filterCount = document.getElementById("filter-count");
        if (!listBody)
          return;
        if (filterCount) {
          filterCount.textContent = `${plots.length} plot${plots.length !== 1 ? "s" : ""}`;
        }
        if (plots.length === 0) {
          listBody.innerHTML = '<div style="text-align: center; color: #888; padding: 40px;">No plots found</div>';
          return;
        }
        const sorted = [...plots].sort((a, b) => {
          const statusOrder = { "PLACED": 0, "UNPLACED": 1, "BRICKED": 2 };
          const aOrder = statusOrder[a.status] ?? 3;
          const bOrder = statusOrder[b.status] ?? 3;
          return aOrder - bOrder;
        });
        listBody.innerHTML = sorted.map((plot) => this.createPlotListItem(plot)).join("");
        listBody.querySelectorAll(".plot-list-item").forEach((item, index) => {
          item.addEventListener("click", () => {
            if (this.onPlotSelected) {
              this.onPlotSelected(sorted[index]);
              this.closePlotListModal();
            }
          });
        });
      }
      /**
       * Get mempool.space URL for a transaction
       */
      static getMempoolUrl(txid) {
        if (this.environment === "mainnet") {
          return `https://mempool.space/tx/${txid}`;
        } else if (this.environment === "testnet") {
          return `https://mempool.space/testnet/tx/${txid}`;
        }
        return null;
      }
      /**
       * Create HTML for a single plot list item
       */
      static createPlotListItem(plot) {
        const uriSection = plot.uri ? `
      <div><strong>URI:</strong> <code>${plot.uri}</code></div>
    ` : "";
        const imageUrl = this.imageUrlGetter ? this.imageUrlGetter(plot.txid) : "";
        const mempoolUrl = this.getMempoolUrl(plot.txid);
        const txidDisplay = mempoolUrl ? `<a href="${mempoolUrl}" target="_blank" rel="noopener noreferrer" class="txid-link">${plot.txid}</a>` : `<code>${plot.txid}</code>`;
        return `
      <div class="plot-list-item">
        <div class="plot-item-header">
          <span class="plot-status ${plot.status.toLowerCase()}">${plot.status}</span>
        </div>
        <div class="plot-item-content">
          <img class="plot-item-image" src="${imageUrl}" alt="Plot ${plot.txid}" />
          <div class="plot-item-details">
            <div><strong>Position:</strong> <code>(${plot.x0}, ${plot.y0})</code></div>
            <div><strong>Size:</strong> <code>${plot.width}\xD7${plot.height}</code></div>
            <div><strong>Owner:</strong> <code>${plot.owner}</code></div>
            <div><strong>TX ID:</strong> ${txidDisplay}</div>
            ${uriSection}
          </div>
        </div>
      </div>
    `;
      }
      /**
       * Initialize modal event listeners
       */
      static initializeModalEventListeners() {
        const closePlotListBtn = document.getElementById("close-plot-list");
        if (closePlotListBtn) {
          closePlotListBtn.addEventListener("click", () => {
            this.closePlotListModal();
          });
        }
        const plotListModal = document.getElementById("plot-list-modal");
        if (plotListModal) {
          plotListModal.addEventListener("click", (e) => {
            if (e.target.id === "plot-list-modal") {
              this.closePlotListModal();
            }
          });
        }
        const closeAboutBtn = document.getElementById("close-about");
        if (closeAboutBtn) {
          closeAboutBtn.addEventListener("click", () => {
            this.closeAboutModal();
          });
        }
        const aboutModal = document.getElementById("about-modal");
        if (aboutModal) {
          aboutModal.addEventListener("click", (e) => {
            if (e.target.id === "about-modal") {
              this.closeAboutModal();
            }
          });
        }
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            this.closePlotListModal();
            this.closeAboutModal();
            this.hidePlotTooltip();
          }
        });
      }
      /**
       * Show technical details panel
       */
      static showTechnicalDetails(state) {
        const panel = document.getElementById("technical-details");
        const content = document.getElementById("details-content");
        if (!panel || !content)
          return;
        const placedCount = state.plots.filter((p) => p.status === "PLACED").length;
        const unplacedCount = state.plots.filter((p) => p.status === "UNPLACED").length;
        const brickedPlacedCount = state.plots.filter((p) => p.status === "BRICKED" && p.wasPlacedBeforeBricking).length;
        const brickedUnplacedCount = state.plots.filter((p) => p.status === "BRICKED" && !p.wasPlacedBeforeBricking).length;
        content.innerHTML = `
      <div class="detail-item">
        <div class="detail-label">Latest Block Hash</div>
        <div class="detail-value">${state.blockHash}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Parent Block Hash</div>
        <div class="detail-value">${state.parentHash}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Block Height</div>
        <div class="detail-value">${state.blockHeight === -1 ? "N/A (regtest)" : state.blockHeight.toLocaleString()}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Total Plots</div>
        <div class="detail-value">${state.plots.length}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Placed Plots</div>
        <div class="detail-value">${placedCount}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Unplaced Plots</div>
        <div class="detail-value">${unplacedCount}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Bricked (Placed)</div>
        <div class="detail-value">${brickedPlacedCount}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Bricked (Unplaced)</div>
        <div class="detail-value">${brickedUnplacedCount}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Deed UTXOs</div>
        <div class="detail-value">${state.deedUTXOs.length}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">Transactions in Latest Block</div>
        <div class="detail-value">${state.transactionCount}</div>
      </div>
    `;
        panel.classList.remove("hidden");
      }
      /**
       * Hide technical details panel
       */
      static hideTechnicalDetails() {
        const panel = document.getElementById("technical-details");
        if (panel) {
          panel.classList.add("hidden");
        }
      }
      /**
       * Toggle technical details panel
       */
      static toggleTechnicalDetails(state) {
        const panel = document.getElementById("technical-details");
        if (!panel)
          return;
        if (panel.classList.contains("hidden")) {
          this.showTechnicalDetails(state);
        } else {
          this.hideTechnicalDetails();
        }
      }
    };
    UIHelpers.allPlots = [];
    UIHelpers.onPlotSelected = null;
    UIHelpers.imageUrlGetter = null;
    UIHelpers.environment = "mainnet";
  }
});

// src/indexer-web/frontend/billboard-canvas.ts
var BillboardCanvas;
var init_billboard_canvas = __esm({
  "src/indexer-web/frontend/billboard-canvas.ts"() {
    "use strict";
    init_ui_helpers();
    BillboardCanvas = class {
      constructor(canvasId, state, imageUrlGetter) {
        // World configuration
        this.WORLD_SIZE = 65536;
        this.CENTER_PIXEL = 32767;
        // Camera state
        this.camera = {
          x: 0,
          y: 0,
          zoom: 1
        };
        // Image cache
        this.imageCache = {};
        // Interaction state
        this.isMouseDown = false;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.DRAG_THRESHOLD = 5;
        // Touch interaction
        this.touches = [];
        this.lastTouchDistance = 0;
        // Placed plots (includes BRICKED plots that were placed)
        this.placedPlots = [];
        // Stats tracking
        this.visiblePlotCount = 0;
        this.lastFrameTime = 0;
        this.fps = 0;
        // Active tooltip
        this.activeTooltipPlot = null;
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
          throw new Error("Canvas element not found");
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Failed to get canvas 2D context");
        }
        this.canvas = canvas;
        this.ctx = ctx;
        this.state = state;
        this.placedPlots = state.plots.filter(
          (p) => p.status === "PLACED" || p.status === "BRICKED" && p.wasPlacedBeforeBricking
        );
        this.initializeUI();
        this.preloadImages(imageUrlGetter).then(() => {
          this.resizeCanvas();
          this.setupEventListeners();
          this.startRenderLoop();
        });
      }
      initializeUI() {
        this.zoomDisplay = document.getElementById("zoom-display");
        this.positionDisplay = document.getElementById("position-display");
        this.visiblePlotsDisplay = document.getElementById("visible-plots");
      }
      async preloadImages(imageUrlGetter) {
        const imagePromises = this.placedPlots.map((plot) => {
          return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              this.imageCache[plot.txid] = img;
              resolve();
            };
            img.onerror = () => {
              console.error("Failed to load image:", plot.txid);
              resolve();
            };
            img.src = imageUrlGetter(plot.txid);
          });
        });
        await Promise.all(imagePromises);
      }
      resizeCanvas() {
        const headerHeight = 140;
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight - headerHeight;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.style.width = `${displayWidth}px`;
        this.canvas.style.height = `${displayHeight}px`;
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.camera.x = this.CENTER_PIXEL - displayWidth / (2 * this.camera.zoom);
        this.camera.y = this.CENTER_PIXEL - displayHeight / (2 * this.camera.zoom);
        this.render();
      }
      getZoomConstraints() {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        const minZoomX = displayWidth / this.WORLD_SIZE;
        const minZoomY = displayHeight / this.WORLD_SIZE;
        const minZoom = Math.min(minZoomX, minZoomY, 0.01);
        const maxZoom = 20;
        return { minZoom, maxZoom };
      }
      clampCamera() {
        const { minZoom, maxZoom } = this.getZoomConstraints();
        this.camera.zoom = Math.max(minZoom, Math.min(maxZoom, this.camera.zoom));
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        const viewWidth = displayWidth / this.camera.zoom;
        const viewHeight = displayHeight / this.camera.zoom;
        const maxX = viewWidth > this.WORLD_SIZE ? (viewWidth - this.WORLD_SIZE) / 2 : this.WORLD_SIZE - viewWidth;
        const maxY = viewHeight > this.WORLD_SIZE ? (viewHeight - this.WORLD_SIZE) / 2 : this.WORLD_SIZE - viewHeight;
        const minX = viewWidth > this.WORLD_SIZE ? -(viewWidth - this.WORLD_SIZE) / 2 : 0;
        const minY = viewHeight > this.WORLD_SIZE ? -(viewHeight - this.WORLD_SIZE) / 2 : 0;
        this.camera.x = Math.max(minX, Math.min(this.camera.x, maxX));
        this.camera.y = Math.max(minY, Math.min(this.camera.y, maxY));
      }
      startRenderLoop() {
        const loop = (timestamp) => {
          if (this.lastFrameTime > 0) {
            const delta = timestamp - this.lastFrameTime;
            this.fps = Math.round(1e3 / delta);
          }
          this.lastFrameTime = timestamp;
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }
      render() {
        this.ctx.fillStyle = "#0a0a0a";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const worldLeft = this.camera.x;
        const worldTop = this.camera.y;
        const worldRight = this.camera.x + this.canvas.width / this.camera.zoom;
        const worldBottom = this.camera.y + this.canvas.height / this.camera.zoom;
        this.ctx.save();
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);
        this.drawZoomDependentGrid(worldLeft, worldTop, worldRight, worldBottom);
        this.drawWorldBoundary();
        this.visiblePlotCount = 0;
        this.placedPlots.forEach((plot) => {
          const plotRight = plot.x0 + plot.width;
          const plotBottom = plot.y0 + plot.height;
          if (plotRight < worldLeft || plot.x0 > worldRight || plotBottom < worldTop || plot.y0 > worldBottom) {
            return;
          }
          this.visiblePlotCount++;
          const img = this.imageCache[plot.txid];
          if (img) {
            this.ctx.drawImage(img, plot.x0, plot.y0, plot.width, plot.height);
            if (this.activeTooltipPlot && this.activeTooltipPlot.txid === plot.txid) {
              this.ctx.strokeStyle = "#667eea";
              this.ctx.lineWidth = 3 / this.camera.zoom;
              this.ctx.strokeRect(plot.x0, plot.y0, plot.width, plot.height);
            }
          }
        });
        this.ctx.restore();
        this.updateUIDisplays();
      }
      drawZoomDependentGrid(worldLeft, worldTop, worldRight, worldBottom) {
        let gridSize;
        if (this.camera.zoom < 0.1) {
          gridSize = 1e4;
        } else if (this.camera.zoom < 1) {
          gridSize = 1e3;
        } else {
          gridSize = 100;
        }
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        this.ctx.lineWidth = 1 / this.camera.zoom;
        const gridLeft = Math.max(0, worldLeft);
        const gridTop = Math.max(0, worldTop);
        const gridRight = Math.min(this.WORLD_SIZE, worldRight);
        const gridBottom = Math.min(this.WORLD_SIZE, worldBottom);
        const startX = Math.floor(gridLeft / gridSize) * gridSize;
        const endX = Math.ceil(gridRight / gridSize) * gridSize;
        const startY = Math.floor(gridTop / gridSize) * gridSize;
        const endY = Math.ceil(gridBottom / gridSize) * gridSize;
        for (let x = startX; x <= endX; x += gridSize) {
          if (x >= 0 && x <= this.WORLD_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, gridTop);
            this.ctx.lineTo(x, gridBottom);
            this.ctx.stroke();
          }
        }
        for (let y = startY; y <= endY; y += gridSize) {
          if (y >= 0 && y <= this.WORLD_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(gridLeft, y);
            this.ctx.lineTo(gridRight, y);
            this.ctx.stroke();
          }
        }
      }
      drawWorldBoundary() {
        this.ctx.strokeStyle = "#F7931A";
        this.ctx.lineWidth = 4 / this.camera.zoom;
        this.ctx.strokeRect(0, 0, this.WORLD_SIZE, this.WORLD_SIZE);
        const markerSize = 200 / this.camera.zoom;
        this.ctx.strokeStyle = "#F7931A";
        this.ctx.lineWidth = 3 / this.camera.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(0, markerSize);
        this.ctx.lineTo(0, 0);
        this.ctx.lineTo(markerSize, 0);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(this.WORLD_SIZE - markerSize, 0);
        this.ctx.lineTo(this.WORLD_SIZE, 0);
        this.ctx.lineTo(this.WORLD_SIZE, markerSize);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.WORLD_SIZE - markerSize);
        this.ctx.lineTo(0, this.WORLD_SIZE);
        this.ctx.lineTo(markerSize, this.WORLD_SIZE);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(this.WORLD_SIZE - markerSize, this.WORLD_SIZE);
        this.ctx.lineTo(this.WORLD_SIZE, this.WORLD_SIZE);
        this.ctx.lineTo(this.WORLD_SIZE, this.WORLD_SIZE - markerSize);
        this.ctx.stroke();
      }
      updateUIDisplays() {
        this.zoomDisplay.textContent = `Zoom: ${Math.round(this.camera.zoom * 100)}%`;
        this.visiblePlotsDisplay.textContent = `Visible: ${this.visiblePlotCount}`;
      }
      updateCursorPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const worldX = this.camera.x + canvasX / this.camera.zoom;
        const worldY = this.camera.y + canvasY / this.camera.zoom;
        this.positionDisplay.textContent = `Position: (${Math.round(worldX)}, ${Math.round(worldY)})`;
      }
      handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const worldX = this.camera.x + canvasX / this.camera.zoom;
        const worldY = this.camera.y + canvasY / this.camera.zoom;
        const clickedPlot = this.placedPlots.find((plot) => {
          return worldX >= plot.x0 && worldX <= plot.x0 + plot.width && worldY >= plot.y0 && worldY <= plot.y0 + plot.height;
        });
        if (clickedPlot) {
          this.activeTooltipPlot = clickedPlot;
          UIHelpers.showPlotTooltip(clickedPlot, e.clientX, e.clientY);
          this.render();
        } else {
          this.activeTooltipPlot = null;
          UIHelpers.hidePlotTooltip();
          this.render();
        }
      }
      setupEventListeners() {
        this.canvas.addEventListener("mousedown", (e) => {
          this.isMouseDown = true;
          this.isDragging = false;
          this.dragStartX = e.clientX;
          this.dragStartY = e.clientY;
          this.lastMouseX = e.clientX;
          this.lastMouseY = e.clientY;
        });
        this.canvas.addEventListener("mousemove", (e) => {
          this.updateCursorPosition(e);
          if (this.isMouseDown) {
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > this.DRAG_THRESHOLD) {
              this.isDragging = true;
            }
            if (this.isDragging) {
              const dx2 = (e.clientX - this.lastMouseX) / this.camera.zoom;
              const dy2 = (e.clientY - this.lastMouseY) / this.camera.zoom;
              this.camera.x -= dx2;
              this.camera.y -= dy2;
              this.clampCamera();
              this.lastMouseX = e.clientX;
              this.lastMouseY = e.clientY;
              this.render();
            }
          }
        });
        this.canvas.addEventListener("mouseup", (e) => {
          const wasDragging = this.isDragging;
          this.isMouseDown = false;
          this.isDragging = false;
          if (!wasDragging) {
            this.handleCanvasClick(e);
          }
        });
        this.canvas.addEventListener("mouseleave", () => {
          this.isMouseDown = false;
          this.isDragging = false;
        });
        this.canvas.addEventListener("wheel", (e) => {
          e.preventDefault();
          const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
          const rect = this.canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const worldX = this.camera.x + mouseX / this.camera.zoom;
          const worldY = this.camera.y + mouseY / this.camera.zoom;
          this.camera.zoom *= zoomFactor;
          this.camera.x = worldX - mouseX / this.camera.zoom;
          this.camera.y = worldY - mouseY / this.camera.zoom;
          this.clampCamera();
          this.render();
        });
        this.canvas.addEventListener("touchstart", (e) => {
          this.touches = Array.from(e.touches);
          if (this.touches.length === 2) {
            const dx = this.touches[0].clientX - this.touches[1].clientX;
            const dy = this.touches[0].clientY - this.touches[1].clientY;
            this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
          }
        });
        this.canvas.addEventListener("touchmove", (e) => {
          e.preventDefault();
          this.touches = Array.from(e.touches);
          if (this.touches.length === 2) {
            const dx = this.touches[0].clientX - this.touches[1].clientX;
            const dy = this.touches[0].clientY - this.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (this.lastTouchDistance > 0) {
              const zoomFactor = distance / this.lastTouchDistance;
              const centerX = (this.touches[0].clientX + this.touches[1].clientX) / 2;
              const centerY = (this.touches[0].clientY + this.touches[1].clientY) / 2;
              const rect = this.canvas.getBoundingClientRect();
              const canvasX = centerX - rect.left;
              const canvasY = centerY - rect.top;
              const worldX = this.camera.x + canvasX / this.camera.zoom;
              const worldY = this.camera.y + canvasY / this.camera.zoom;
              this.camera.zoom *= zoomFactor;
              this.camera.x = worldX - canvasX / this.camera.zoom;
              this.camera.y = worldY - canvasY / this.camera.zoom;
              this.clampCamera();
            }
            this.lastTouchDistance = distance;
            this.render();
          } else if (this.touches.length === 1 && this.isDragging) {
            const dx = (this.touches[0].clientX - this.lastMouseX) / this.camera.zoom;
            const dy = (this.touches[0].clientY - this.lastMouseY) / this.camera.zoom;
            this.camera.x -= dx;
            this.camera.y -= dy;
            this.clampCamera();
            this.lastMouseX = this.touches[0].clientX;
            this.lastMouseY = this.touches[0].clientY;
            this.render();
          }
        });
        this.canvas.addEventListener("touchend", (e) => {
          if (e.touches.length < 2) {
            this.lastTouchDistance = 0;
          }
          if (e.touches.length === 0) {
            this.isDragging = false;
          }
        });
        window.addEventListener("resize", () => {
          this.resizeCanvas();
        });
      }
      zoomIn() {
        this.camera.zoom *= 1.3;
        this.clampCamera();
        this.render();
      }
      zoomOut() {
        this.camera.zoom *= 0.7;
        this.clampCamera();
        this.render();
      }
      resetView() {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        this.camera.x = this.CENTER_PIXEL - displayWidth / 2;
        this.camera.y = this.CENTER_PIXEL - displayHeight / 2;
        this.camera.zoom = 1;
        this.clampCamera();
        this.render();
      }
      goToCoordinates(x, y) {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        this.camera.x = x - displayWidth / (2 * this.camera.zoom);
        this.camera.y = y - displayHeight / (2 * this.camera.zoom);
        this.clampCamera();
        this.render();
      }
      centerOnPlot(plot) {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        const centerX = plot.x0 + plot.width / 2;
        const centerY = plot.y0 + plot.height / 2;
        const zoomX = displayWidth / (plot.width * 3);
        const zoomY = displayHeight / (plot.height * 3);
        this.camera.zoom = Math.min(zoomX, zoomY, 10);
        this.camera.x = centerX - displayWidth / (2 * this.camera.zoom);
        this.camera.y = centerY - displayHeight / (2 * this.camera.zoom);
        this.clampCamera();
        this.render();
      }
    };
  }
});

// src/indexer-web/frontend/app.ts
var require_app = __commonJS({
  "src/indexer-web/frontend/app.ts"() {
    init_state_loader();
    init_billboard_canvas();
    init_ui_helpers();
    var App = class {
      constructor() {
        this.canvas = null;
        this.state = null;
        this.stateLoader = new StateLoader("");
        this.initialize();
      }
      async initialize() {
        UIHelpers.initializeModalEventListeners();
        await this.loadAndRenderState();
      }
      async loadAndRenderState() {
        try {
          this.showLoading();
          const config = this.stateLoader.getConfig();
          UIHelpers.setEnvironment(config.environment);
          this.updateHeader(config.environment);
          this.state = await this.stateLoader.loadTipState();
          this.hideLoading();
          this.canvas = new BillboardCanvas(
            "billboard-canvas",
            this.state,
            (txid) => this.stateLoader.getImageUrl(txid)
          );
          this.setupControls();
        } catch (error) {
          console.error("Error loading state:", error);
          this.showError(`Failed to load state: ${error.message}`);
        }
      }
      showLoading() {
        const existingLoading = document.querySelector(".loading");
        if (!existingLoading) {
          const loading = document.createElement("div");
          loading.className = "loading";
          loading.textContent = "Loading state...";
          document.body.appendChild(loading);
        }
      }
      hideLoading() {
        const loading = document.querySelector(".loading");
        if (loading) {
          loading.remove();
        }
      }
      showError(message) {
        this.hideLoading();
        const error = document.createElement("div");
        error.className = "error";
        error.innerHTML = `${message}<br><small>Check browser console for details</small>`;
        document.body.appendChild(error);
      }
      updateHeader(environment) {
        const envBadge = document.getElementById("environment-badge");
        if (envBadge) {
          envBadge.textContent = environment;
          envBadge.className = `environment ${environment}`;
        }
      }
      setupControls() {
        if (!this.state || !this.canvas)
          return;
        const showAboutBtn = document.getElementById("show-about");
        if (showAboutBtn) {
          showAboutBtn.addEventListener("click", () => {
            UIHelpers.showAboutModal();
          });
        }
        const toggleDetailsBtn = document.getElementById("toggle-details");
        if (toggleDetailsBtn) {
          toggleDetailsBtn.addEventListener("click", () => {
            if (this.state) {
              UIHelpers.toggleTechnicalDetails(this.state);
            }
          });
        }
        const closeDetailsBtn = document.getElementById("close-details");
        if (closeDetailsBtn) {
          closeDetailsBtn.addEventListener("click", () => {
            UIHelpers.hideTechnicalDetails();
          });
        }
        const showPlotsBtn = document.getElementById("show-plots");
        if (showPlotsBtn) {
          showPlotsBtn.addEventListener("click", () => {
            if (this.state && this.canvas) {
              const config = this.stateLoader.getConfig();
              UIHelpers.showPlotListModal(this.state, (plot) => {
                if (this.canvas) {
                  this.canvas.centerOnPlot(plot);
                }
              }, (txid) => this.stateLoader.getImageUrl(txid), config.environment);
            }
          });
        }
        const resetViewBtn = document.getElementById("reset-view");
        if (resetViewBtn) {
          resetViewBtn.addEventListener("click", () => {
            if (this.canvas) {
              this.canvas.resetView();
            }
          });
        }
        const navGoBtn = document.getElementById("nav-go");
        const navXInput = document.getElementById("nav-x");
        const navYInput = document.getElementById("nav-y");
        const goToCoordinates = () => {
          if (!this.canvas)
            return;
          const x = parseInt(navXInput.value);
          const y = parseInt(navYInput.value);
          if (isNaN(x) || isNaN(y)) {
            alert("Please enter valid coordinates");
            return;
          }
          if (x < 0 || x > 65535 || y < 0 || y > 65535) {
            alert("Coordinates must be between 0 and 65535");
            return;
          }
          this.canvas.goToCoordinates(x, y);
        };
        if (navGoBtn) {
          navGoBtn.addEventListener("click", goToCoordinates);
        }
        if (navXInput) {
          navXInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
              goToCoordinates();
            }
          });
        }
        if (navYInput) {
          navYInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
              goToCoordinates();
            }
          });
        }
        this.setupKeyboardShortcuts();
      }
      setupKeyboardShortcuts() {
        document.addEventListener("keydown", (e) => {
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
          }
          if (!this.canvas)
            return;
          switch (e.key) {
            case "0":
              this.canvas.resetView();
              break;
            case "+":
            case "=":
              this.canvas.zoomIn();
              break;
            case "-":
              this.canvas.zoomOut();
              break;
            case "t":
            case "T":
              if (this.state) {
                UIHelpers.toggleTechnicalDetails(this.state);
              }
              break;
            case "p":
            case "P":
              if (this.state) {
                const config = this.stateLoader.getConfig();
                UIHelpers.showPlotListModal(this.state, (plot) => {
                  if (this.canvas) {
                    this.canvas.centerOnPlot(plot);
                  }
                }, (txid) => this.stateLoader.getImageUrl(txid), config.environment);
              }
              break;
          }
        });
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => new App());
    } else {
      new App();
    }
  }
});
export default require_app();
//# sourceMappingURL=app.js.map
