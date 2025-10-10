import { PlotState, StateData } from '../backend/types.js';

export class UIHelpers {
  private static allPlots: PlotState[] = [];
  private static onPlotSelected: ((plot: PlotState) => void) | null = null;
  private static imageUrlGetter: ((txid: string) => string) | null = null;

  /**
   * Show speech bubble tooltip for a plot on the canvas
   */
  static showPlotTooltip(plot: PlotState, screenX: number, screenY: number): void {
    const tooltip = document.getElementById('plot-tooltip');
    const ownerEl = document.getElementById('tooltip-owner');
    const uriEl = document.getElementById('tooltip-uri');
    
    if (!tooltip || !ownerEl || !uriEl) return;

    // Update tooltip content - handle bricked plots specially
    if (plot.status === 'BRICKED') {
      ownerEl.textContent = 'Owner: N/A (Bricked)';
      ownerEl.style.color = '#ff6b6b';
    } else {
      ownerEl.textContent = `Owner: ${plot.owner}`;
      ownerEl.style.color = '#00ff00';
    }
    
    if (plot.uri) {
      uriEl.innerHTML = `<a href="${plot.uri}" target="_blank" rel="noopener noreferrer">${plot.uri} ↗</a>`;
    } else {
      uriEl.innerHTML = '<span style="color: #888;">No URI</span>';
    }
    
    // Position the tooltip above the cursor
    tooltip.style.left = `${screenX}px`;
    tooltip.style.top = `${screenY - 120}px`;
    
    // Show tooltip
    tooltip.classList.remove('hidden');
  }
  
  /**
   * Hide the plot tooltip
   */
  static hidePlotTooltip(): void {
    const tooltip = document.getElementById('plot-tooltip');
    if (tooltip) {
      tooltip.classList.add('hidden');
    }
  }

  /**
   * Show the plot list modal with search functionality
   */
  static showPlotListModal(state: StateData, onPlotSelect: (plot: PlotState) => void, imageUrlGetter: (txid: string) => string): void {
    this.allPlots = state.plots;
    this.onPlotSelected = onPlotSelect;
    this.imageUrlGetter = imageUrlGetter;
    
    const modal = document.getElementById('plot-list-modal');
    if (!modal) return;

    // Initialize search inputs
    const searchOwner = document.getElementById('search-owner') as HTMLInputElement;
    const searchTxid = document.getElementById('search-txid') as HTMLInputElement;
    
    if (searchOwner) searchOwner.value = '';
    if (searchTxid) searchTxid.value = '';
    
    // Render all plots initially
    this.renderPlotList(state.plots);
    
    // Setup search event listeners
    this.setupPlotListSearch();
    
    // Show modal
    modal.classList.add('active');
  }
  
  /**
   * Close the plot list modal
   */
  static closePlotListModal(): void {
    const modal = document.getElementById('plot-list-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  /**
   * Setup search functionality for plot list
   */
  private static setupPlotListSearch(): void {
    const searchOwner = document.getElementById('search-owner') as HTMLInputElement;
    const searchTxid = document.getElementById('search-txid') as HTMLInputElement;
    
    const performSearch = () => {
      const ownerQuery = searchOwner?.value.toLowerCase().trim() || '';
      const txidQuery = searchTxid?.value.toLowerCase().trim() || '';
      
      const filtered = this.allPlots.filter(plot => {
        const matchesOwner = !ownerQuery || plot.owner.toLowerCase().includes(ownerQuery);
        const matchesTxid = !txidQuery || plot.txid.toLowerCase().includes(txidQuery);
        return matchesOwner && matchesTxid;
      });
      
      this.renderPlotList(filtered);
    };
    
    if (searchOwner) {
      searchOwner.removeEventListener('input', performSearch);
      searchOwner.addEventListener('input', performSearch);
    }
    
    if (searchTxid) {
      searchTxid.removeEventListener('input', performSearch);
      searchTxid.addEventListener('input', performSearch);
    }
  }

  /**
   * Render the plot list
   */
  private static renderPlotList(plots: PlotState[]): void {
    const listBody = document.getElementById('plot-list-body');
    const filterCount = document.getElementById('filter-count');
    
    if (!listBody) return;
    
    // Update count
    if (filterCount) {
      filterCount.textContent = `${plots.length} plot${plots.length !== 1 ? 's' : ''}`;
    }
    
    if (plots.length === 0) {
      listBody.innerHTML = '<div style="text-align: center; color: #888; padding: 40px;">No plots found</div>';
      return;
    }
    
    // Sort plots by status (PLACED first, then UNPLACED, then BRICKED)
    const sorted = [...plots].sort((a, b) => {
      const statusOrder = { 'PLACED': 0, 'UNPLACED': 1, 'BRICKED': 2 };
      const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
      const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
      return aOrder - bOrder;
    });
    
    listBody.innerHTML = sorted.map(plot => this.createPlotListItem(plot)).join('');
    
    // Add click handlers
    listBody.querySelectorAll('.plot-list-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        if (this.onPlotSelected) {
          this.onPlotSelected(sorted[index]);
          this.closePlotListModal();
        }
      });
    });
  }

  /**
   * Create HTML for a single plot list item
   */
  private static createPlotListItem(plot: PlotState): string {
    const uriSection = plot.uri ? `
      <div><strong>URI:</strong> <code>${plot.uri}</code></div>
    ` : '';
    
    const imageUrl = this.imageUrlGetter ? this.imageUrlGetter(plot.txid) : '';
    
    return `
      <div class="plot-list-item">
        <div class="plot-item-header">
          <span class="plot-status ${plot.status.toLowerCase()}">${plot.status}</span>
        </div>
        <div class="plot-item-content">
          <img class="plot-item-image" src="${imageUrl}" alt="Plot ${plot.txid}" />
          <div class="plot-item-details">
            <div><strong>Position:</strong> <code>(${plot.x0}, ${plot.y0})</code></div>
            <div><strong>Size:</strong> <code>${plot.width}×${plot.height}</code></div>
            <div><strong>Owner:</strong> <code>${plot.owner}</code></div>
            <div><strong>TX ID:</strong> <code>${plot.txid}</code></div>
            ${uriSection}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Initialize modal event listeners
   */
  static initializeModalEventListeners(): void {
    // Close plot list modal
    const closePlotListBtn = document.getElementById('close-plot-list');
    if (closePlotListBtn) {
      closePlotListBtn.addEventListener('click', () => {
        this.closePlotListModal();
      });
    }
    
    // Close modal when clicking outside
    const plotListModal = document.getElementById('plot-list-modal');
    if (plotListModal) {
      plotListModal.addEventListener('click', (e: MouseEvent) => {
        if ((e.target as HTMLElement).id === 'plot-list-modal') {
          this.closePlotListModal();
        }
      });
    }
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closePlotListModal();
        this.hidePlotTooltip();
      }
    });
  }

  /**
   * Show technical details panel
   */
  static showTechnicalDetails(state: StateData): void {
    const panel = document.getElementById('technical-details');
    const content = document.getElementById('details-content');
    
    if (!panel || !content) return;
    
    const placedCount = state.plots.filter(p => p.status === 'PLACED').length;
    const unplacedCount = state.plots.filter(p => p.status === 'UNPLACED').length;
    const brickedPlacedCount = state.plots.filter(p => p.status === 'BRICKED' && p.wasPlacedBeforeBricking).length;
    const brickedUnplacedCount = state.plots.filter(p => p.status === 'BRICKED' && !p.wasPlacedBeforeBricking).length;
    
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
        <div class="detail-value">${state.blockHeight === -1 ? 'N/A (regtest)' : state.blockHeight.toLocaleString()}</div>
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
    
    panel.classList.remove('hidden');
  }
  
  /**
   * Hide technical details panel
   */
  static hideTechnicalDetails(): void {
    const panel = document.getElementById('technical-details');
    if (panel) {
      panel.classList.add('hidden');
    }
  }
  
  /**
   * Toggle technical details panel
   */
  static toggleTechnicalDetails(state: StateData): void {
    const panel = document.getElementById('technical-details');
    if (!panel) return;
    
    if (panel.classList.contains('hidden')) {
      this.showTechnicalDetails(state);
    } else {
      this.hideTechnicalDetails();
    }
  }
}