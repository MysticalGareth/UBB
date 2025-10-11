import { StateLoader } from './state-loader.js';
import { BillboardCanvas } from './billboard-canvas.js';
import { UIHelpers } from './ui-helpers.js';
import { StateData } from '../backend/types.js';

class App {
  private stateLoader: StateLoader;
  private canvas: BillboardCanvas | null = null;
  private state: StateData | null = null;

  constructor() {
    this.stateLoader = new StateLoader('');
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Initialize modal event listeners
    UIHelpers.initializeModalEventListeners();
    
    // Load and render state
    await this.loadAndRenderState();
  }

  private async loadAndRenderState(): Promise<void> {
    try {
      // Show loading state
      this.showLoading();
      
      // Get config from window.UBB_CONFIG
      const config = this.stateLoader.getConfig();
      
      // Set environment for UI helpers (used for mempool.space links)
      UIHelpers.setEnvironment(config.environment);
      
      // Update header with environment
      this.updateHeader(config.environment);
      
      // Load state
      this.state = await this.stateLoader.loadTipState();
      
      // Hide loading
      this.hideLoading();
      
      // Render the canvas
      this.canvas = new BillboardCanvas(
        'billboard-canvas',
        this.state,
        (txid) => this.stateLoader.getImageUrl(txid)
      );
      
      // Setup UI controls
      this.setupControls();
      
    } catch (error) {
      console.error('Error loading state:', error);
      this.showError(`Failed to load state: ${(error as Error).message}`);
    }
  }

  private showLoading(): void {
    const existingLoading = document.querySelector('.loading');
    if (!existingLoading) {
      const loading = document.createElement('div');
      loading.className = 'loading';
      loading.textContent = 'Loading state...';
      document.body.appendChild(loading);
    }
  }

  private hideLoading(): void {
    const loading = document.querySelector('.loading');
    if (loading) {
      loading.remove();
    }
  }

  private showError(message: string): void {
    this.hideLoading();
    const error = document.createElement('div');
    error.className = 'error';
    error.innerHTML = `${message}<br><small>Check browser console for details</small>`;
    document.body.appendChild(error);
  }

  private updateHeader(environment: string): void {
    const envBadge = document.getElementById('environment-badge');
    if (envBadge) {
      envBadge.textContent = environment;
      envBadge.className = `environment ${environment}`;
    }
  }

  private setupControls(): void {
    if (!this.state || !this.canvas) return;
    
    // Technical details toggle
    const toggleDetailsBtn = document.getElementById('toggle-details');
    if (toggleDetailsBtn) {
      toggleDetailsBtn.addEventListener('click', () => {
        if (this.state) {
          UIHelpers.toggleTechnicalDetails(this.state);
        }
      });
    }
    
    // Close technical details
    const closeDetailsBtn = document.getElementById('close-details');
    if (closeDetailsBtn) {
      closeDetailsBtn.addEventListener('click', () => {
        UIHelpers.hideTechnicalDetails();
      });
    }
    
    // Show plots button
    const showPlotsBtn = document.getElementById('show-plots');
    if (showPlotsBtn) {
      showPlotsBtn.addEventListener('click', () => {
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
    
    // Reset view button
    const resetViewBtn = document.getElementById('reset-view');
    if (resetViewBtn) {
      resetViewBtn.addEventListener('click', () => {
        if (this.canvas) {
          this.canvas.resetView();
        }
      });
    }
    
    // Coordinate navigation
    const navGoBtn = document.getElementById('nav-go');
    const navXInput = document.getElementById('nav-x') as HTMLInputElement;
    const navYInput = document.getElementById('nav-y') as HTMLInputElement;
    
    const goToCoordinates = () => {
      if (!this.canvas) return;
      
      const x = parseInt(navXInput.value);
      const y = parseInt(navYInput.value);
      
      if (isNaN(x) || isNaN(y)) {
        alert('Please enter valid coordinates');
        return;
      }
      
      if (x < 0 || x > 65535 || y < 0 || y > 65535) {
        alert('Coordinates must be between 0 and 65535');
        return;
      }
      
      this.canvas.goToCoordinates(x, y);
    };
    
    if (navGoBtn) {
      navGoBtn.addEventListener('click', goToCoordinates);
    }
    
    // Allow Enter key in coordinate inputs
    if (navXInput) {
      navXInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          goToCoordinates();
        }
      });
    }
    
    if (navYInput) {
      navYInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          goToCoordinates();
        }
      });
    }
    
    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (!this.canvas) return;
      
      switch(e.key) {
        case '0':
          this.canvas.resetView();
          break;
        case '+':
        case '=':
          this.canvas.zoomIn();
          break;
        case '-':
          this.canvas.zoomOut();
          break;
        case 't':
        case 'T':
          if (this.state) {
            UIHelpers.toggleTechnicalDetails(this.state);
          }
          break;
        case 'p':
        case 'P':
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
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new App());
} else {
  new App();
}