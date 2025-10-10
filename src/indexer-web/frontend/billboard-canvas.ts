import { StateData, PlotState } from '../backend/types.js';
import { UIHelpers } from './ui-helpers.js';

export class BillboardCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: StateData;
  
  // World configuration
  private readonly WORLD_SIZE = 65536;
  private readonly CENTER_PIXEL = 32767;
  
  // Camera state
  private camera = {
    x: 0,
    y: 0,
    zoom: 1.0
  };
  
  // Image cache
  private imageCache: Record<string, HTMLImageElement> = {};
  
  // Interaction state
  private isMouseDown = false;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private readonly DRAG_THRESHOLD = 5;
  
  // Touch interaction
  private touches: Touch[] = [];
  private lastTouchDistance = 0;
  
  // Placed plots (includes BRICKED plots that were placed)
  private placedPlots: PlotState[] = [];
  
  // UI elements
  private zoomDisplay!: HTMLElement;
  private positionDisplay!: HTMLElement;
  private visiblePlotsDisplay!: HTMLElement;
  
  // Stats tracking
  private visiblePlotCount = 0;
  private lastFrameTime = 0;
  private fps = 0;
  
  // Active tooltip
  private activeTooltipPlot: PlotState | null = null;

  constructor(canvasId: string, state: StateData, imageUrlGetter: (txid: string) => string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    
    if (!canvas) {
      throw new Error('Canvas element not found');
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }
    
    this.canvas = canvas;
    this.ctx = ctx;
    this.state = state;
    
    // Filter placed plots (PLACED or BRICKED that were placed)
    this.placedPlots = state.plots.filter(p => 
      p.status === 'PLACED' || 
      (p.status === 'BRICKED' && p.wasPlacedBeforeBricking)
    );
    
    this.initializeUI();
    this.preloadImages(imageUrlGetter).then(() => {
      this.resizeCanvas();
      this.setupEventListeners();
      this.startRenderLoop();
    });
  }

  private initializeUI(): void {
    this.zoomDisplay = document.getElementById('zoom-display')!;
    this.positionDisplay = document.getElementById('position-display')!;
    this.visiblePlotsDisplay = document.getElementById('visible-plots')!;
  }

  private async preloadImages(imageUrlGetter: (txid: string) => string): Promise<void> {
    const imagePromises = this.placedPlots.map(plot => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.imageCache[plot.txid] = img;
          resolve();
        };
        img.onerror = () => {
          console.error('Failed to load image:', plot.txid);
          resolve();
        };
        img.src = imageUrlGetter(plot.txid);
      });
    });

    await Promise.all(imagePromises);
  }

  private resizeCanvas(): void {
    // Make canvas fill available space (accounting for header)
    const headerHeight = 140;
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight - headerHeight;
    
    // Get device pixel ratio for high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    
    // Set CSS display size (what user sees)
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
    
    // Set actual canvas resolution (scaled by device pixel ratio for crisp rendering)
    this.canvas.width = displayWidth * dpr;
    this.canvas.height = displayHeight * dpr;
    
    // Scale the context to account for device pixel ratio
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // Recenter camera on billboard center (use display size, not canvas size)
    this.camera.x = this.CENTER_PIXEL - displayWidth / (2 * this.camera.zoom);
    this.camera.y = this.CENTER_PIXEL - displayHeight / (2 * this.camera.zoom);
    
    this.render();
  }

  private getZoomConstraints(): { minZoom: number; maxZoom: number } {
    // Use display dimensions, not canvas dimensions (which are scaled by DPR)
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    const minZoomX = displayWidth / this.WORLD_SIZE;
    const minZoomY = displayHeight / this.WORLD_SIZE;
    // Use minimum so we can zoom out to fit the most constrained dimension
    const minZoom = Math.min(minZoomX, minZoomY, 0.01);
    const maxZoom = 20.0;
    return { minZoom, maxZoom };
  }

  private clampCamera(): void {
    const { minZoom, maxZoom } = this.getZoomConstraints();
    this.camera.zoom = Math.max(minZoom, Math.min(maxZoom, this.camera.zoom));
    
    // Use display dimensions, not canvas dimensions
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    
    // Allow camera to go beyond world boundaries when zoomed out
    const viewWidth = displayWidth / this.camera.zoom;
    const viewHeight = displayHeight / this.camera.zoom;
    
    // Calculate how much we can pan beyond the world
    const maxX = viewWidth > this.WORLD_SIZE ? (viewWidth - this.WORLD_SIZE) / 2 : this.WORLD_SIZE - viewWidth;
    const maxY = viewHeight > this.WORLD_SIZE ? (viewHeight - this.WORLD_SIZE) / 2 : this.WORLD_SIZE - viewHeight;
    const minX = viewWidth > this.WORLD_SIZE ? -(viewWidth - this.WORLD_SIZE) / 2 : 0;
    const minY = viewHeight > this.WORLD_SIZE ? -(viewHeight - this.WORLD_SIZE) / 2 : 0;
    
    this.camera.x = Math.max(minX, Math.min(this.camera.x, maxX));
    this.camera.y = Math.max(minY, Math.min(this.camera.y, maxY));
  }

  private startRenderLoop(): void {
    const loop = (timestamp: number) => {
      // Calculate FPS
      if (this.lastFrameTime > 0) {
        const delta = timestamp - this.lastFrameTime;
        this.fps = Math.round(1000 / delta);
      }
      this.lastFrameTime = timestamp;
      
      requestAnimationFrame(loop);
    };
    
    requestAnimationFrame(loop);
  }

  private render(): void {
    // Clear canvas with dark background
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate visible world bounds
    const worldLeft = this.camera.x;
    const worldTop = this.camera.y;
    const worldRight = this.camera.x + this.canvas.width / this.camera.zoom;
    const worldBottom = this.camera.y + this.canvas.height / this.camera.zoom;

    // Save context state
    this.ctx.save();
    
    // Disable image smoothing for crisp pixel rendering
    this.ctx.imageSmoothingEnabled = false;
    
    // Apply camera transform
    this.ctx.scale(this.camera.zoom, this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);

    // Draw zoom-dependent grid
    this.drawZoomDependentGrid(worldLeft, worldTop, worldRight, worldBottom);

    // Draw world boundary
    this.drawWorldBoundary();

    // Viewport culling: only draw visible plots
    this.visiblePlotCount = 0;
    this.placedPlots.forEach(plot => {
      const plotRight = plot.x0 + plot.width;
      const plotBottom = plot.y0 + plot.height;
      
      // Check if plot is in viewport
      if (plotRight < worldLeft || plot.x0 > worldRight ||
          plotBottom < worldTop || plot.y0 > worldBottom) {
        return;
      }
      
      this.visiblePlotCount++;
      
      const img = this.imageCache[plot.txid];
      if (img) {
        this.ctx.drawImage(img, plot.x0, plot.y0, plot.width, plot.height);
        
        // Draw border around plot if it's the active tooltip
        if (this.activeTooltipPlot && this.activeTooltipPlot.txid === plot.txid) {
          this.ctx.strokeStyle = '#667eea';
          this.ctx.lineWidth = 3 / this.camera.zoom;
          this.ctx.strokeRect(plot.x0, plot.y0, plot.width, plot.height);
        }
      }
    });

    this.ctx.restore();

    // Update UI displays
    this.updateUIDisplays();
  }

  private drawZoomDependentGrid(worldLeft: number, worldTop: number, worldRight: number, worldBottom: number): void {
    // Determine grid size based on zoom level
    let gridSize: number;
    if (this.camera.zoom < 0.1) {
      gridSize = 10000;
    } else if (this.camera.zoom < 1.0) {
      gridSize = 1000;
    } else {
      gridSize = 100;
    }
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1 / this.camera.zoom;
    
    // Clamp grid to world boundaries
    const gridLeft = Math.max(0, worldLeft);
    const gridTop = Math.max(0, worldTop);
    const gridRight = Math.min(this.WORLD_SIZE, worldRight);
    const gridBottom = Math.min(this.WORLD_SIZE, worldBottom);
    
    const startX = Math.floor(gridLeft / gridSize) * gridSize;
    const endX = Math.ceil(gridRight / gridSize) * gridSize;
    const startY = Math.floor(gridTop / gridSize) * gridSize;
    const endY = Math.ceil(gridBottom / gridSize) * gridSize;
    
    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      if (x >= 0 && x <= this.WORLD_SIZE) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, gridTop);
        this.ctx.lineTo(x, gridBottom);
        this.ctx.stroke();
      }
    }
    
    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      if (y >= 0 && y <= this.WORLD_SIZE) {
        this.ctx.beginPath();
        this.ctx.moveTo(gridLeft, y);
        this.ctx.lineTo(gridRight, y);
        this.ctx.stroke();
      }
    }
    
    // Draw origin marker (center of billboard)
    // Crosshair removed - no longer drawn
  }

  private drawWorldBoundary(): void {
    // Draw a prominent border around the world boundaries
    this.ctx.strokeStyle = '#F7931A'; // Bitcoin orange
    this.ctx.lineWidth = 4 / this.camera.zoom;
    this.ctx.strokeRect(0, 0, this.WORLD_SIZE, this.WORLD_SIZE);
    
    // Draw corner markers for better visibility
    const markerSize = 200 / this.camera.zoom;
    this.ctx.strokeStyle = '#F7931A';
    this.ctx.lineWidth = 3 / this.camera.zoom;
    
    // Top-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(0, markerSize);
    this.ctx.lineTo(0, 0);
    this.ctx.lineTo(markerSize, 0);
    this.ctx.stroke();
    
    // Top-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(this.WORLD_SIZE - markerSize, 0);
    this.ctx.lineTo(this.WORLD_SIZE, 0);
    this.ctx.lineTo(this.WORLD_SIZE, markerSize);
    this.ctx.stroke();
    
    // Bottom-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.WORLD_SIZE - markerSize);
    this.ctx.lineTo(0, this.WORLD_SIZE);
    this.ctx.lineTo(markerSize, this.WORLD_SIZE);
    this.ctx.stroke();
    
    // Bottom-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(this.WORLD_SIZE - markerSize, this.WORLD_SIZE);
    this.ctx.lineTo(this.WORLD_SIZE, this.WORLD_SIZE);
    this.ctx.lineTo(this.WORLD_SIZE, this.WORLD_SIZE - markerSize);
    this.ctx.stroke();
  }

  private updateUIDisplays(): void {
    this.zoomDisplay.textContent = `Zoom: ${Math.round(this.camera.zoom * 100)}%`;
    this.visiblePlotsDisplay.textContent = `Visible: ${this.visiblePlotCount}`;
  }

  private updateCursorPosition(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    const worldX = this.camera.x + canvasX / this.camera.zoom;
    const worldY = this.camera.y + canvasY / this.camera.zoom;
    
    this.positionDisplay.textContent = `Position: (${Math.round(worldX)}, ${Math.round(worldY)})`;
  }

  private handleCanvasClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    const worldX = this.camera.x + canvasX / this.camera.zoom;
    const worldY = this.camera.y + canvasY / this.camera.zoom;
    
    const clickedPlot = this.placedPlots.find(plot => {
      return worldX >= plot.x0 && worldX <= plot.x0 + plot.width &&
             worldY >= plot.y0 && worldY <= plot.y0 + plot.height;
    });
    
    if (clickedPlot) {
      // Show speech bubble tooltip
      this.activeTooltipPlot = clickedPlot;
      UIHelpers.showPlotTooltip(clickedPlot, e.clientX, e.clientY);
      this.render();
    } else {
      // Hide tooltip when clicking empty space
      this.activeTooltipPlot = null;
      UIHelpers.hidePlotTooltip();
      this.render();
    }
  }

  private setupEventListeners(): void {
    // Mouse handlers
    this.canvas.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      this.isDragging = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.updateCursorPosition(e);
      
      if (this.isMouseDown) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > this.DRAG_THRESHOLD) {
          this.isDragging = true;
        }
        
        if (this.isDragging) {
          const dx = (e.clientX - this.lastMouseX) / this.camera.zoom;
          const dy = (e.clientY - this.lastMouseY) / this.camera.zoom;
          
          this.camera.x -= dx;
          this.camera.y -= dy;
          this.clampCamera();
          
          this.lastMouseX = e.clientX;
          this.lastMouseY = e.clientY;
          this.render();
        }
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      const wasDragging = this.isDragging;
      this.isMouseDown = false;
      this.isDragging = false;
      
      if (!wasDragging) {
        this.handleCanvasClick(e);
      }
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      this.isMouseDown = false;
      this.isDragging = false;
    });

    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
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

    // Touch handlers
    this.canvas.addEventListener('touchstart', (e) => {
      this.touches = Array.from(e.touches);
      if (this.touches.length === 2) {
        const dx = this.touches[0].clientX - this.touches[1].clientX;
        const dy = this.touches[0].clientY - this.touches[1].clientY;
        this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
      }
    });

    this.canvas.addEventListener('touchmove', (e) => {
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

    this.canvas.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        this.lastTouchDistance = 0;
      }
      if (e.touches.length === 0) {
        this.isDragging = false;
      }
    });

    // Window resize
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
  }

  public zoomIn(): void {
    this.camera.zoom *= 1.3;
    this.clampCamera();
    this.render();
  }

  public zoomOut(): void {
    this.camera.zoom *= 0.7;
    this.clampCamera();
    this.render();
  }

  public resetView(): void {
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    this.camera.x = this.CENTER_PIXEL - displayWidth / 2;
    this.camera.y = this.CENTER_PIXEL - displayHeight / 2;
    this.camera.zoom = 1.0;
    this.clampCamera();
    this.render();
  }

  public goToCoordinates(x: number, y: number): void {
    // Center the camera on the specified coordinates (use display dimensions)
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    this.camera.x = x - displayWidth / (2 * this.camera.zoom);
    this.camera.y = y - displayHeight / (2 * this.camera.zoom);
    this.clampCamera();
    this.render();
  }

  public centerOnPlot(plot: PlotState): void {
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;
    const centerX = plot.x0 + plot.width / 2;
    const centerY = plot.y0 + plot.height / 2;
    
    // Zoom to fit the plot nicely
    const zoomX = displayWidth / (plot.width * 3);
    const zoomY = displayHeight / (plot.height * 3);
    this.camera.zoom = Math.min(zoomX, zoomY, 10.0);
    
    this.camera.x = centerX - displayWidth / (2 * this.camera.zoom);
    this.camera.y = centerY - displayHeight / (2 * this.camera.zoom);
    this.clampCamera();
    this.render();
  }
}