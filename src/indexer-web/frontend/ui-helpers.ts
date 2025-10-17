import { PlotState, StateData } from '../backend/types.js';

export class UIHelpers {
  private static allPlots: PlotState[] = [];
  private static onPlotSelected: ((plot: PlotState) => void) | null = null;
  private static imageUrlGetter: ((txid: string) => string) | null = null;
  private static environment: 'mainnet' | 'testnet' | 'regtest' = 'mainnet';

  /**
   * Escape HTML to prevent XSS attacks
   */
  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Sanitize URL to prevent javascript: and data: URI attacks
   * Only allows http:, https:, and relative URLs
   */
  private static sanitizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return '';
    
    // Check for dangerous protocols
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('javascript:') || 
        lower.startsWith('data:') || 
        lower.startsWith('vbscript:') ||
        lower.startsWith('file:')) {
      return ''; // Block dangerous protocols
    }
    
    return trimmed;
  }

  /**
   * Set the network environment for generating explorer URLs
   */
  static setEnvironment(environment: 'mainnet' | 'testnet' | 'regtest'): void {
    this.environment = environment;
  }

  /**
   * Show speech bubble tooltip for a plot on the canvas
   */
  static showPlotTooltip(plot: PlotState, screenX: number, screenY: number): void {
    const tooltip = document.getElementById('plot-tooltip');
    const ownerEl = document.getElementById('tooltip-owner');
    const txidEl = document.getElementById('tooltip-txid');
    const uriEl = document.getElementById('tooltip-uri');
    
    if (!tooltip || !ownerEl || !txidEl || !uriEl) return;

    // Update tooltip content - handle bricked plots specially
    // Using textContent is safe from XSS as it doesn't parse HTML
    if (plot.status === 'BRICKED') {
      ownerEl.textContent = 'Owner: N/A (Bricked)';
      ownerEl.style.color = '#ff6b6b';
    } else {
      ownerEl.textContent = `Owner: ${plot.owner}`;
      ownerEl.style.color = '#00ff00';
    }
    
    // Add transaction link
    const mempoolUrl = this.getMempoolUrl(plot.txid);
    const shortTxid = this.escapeHtml(plot.txid.substring(0, 8) + '...' + plot.txid.substring(plot.txid.length - 8));
    if (mempoolUrl) {
      txidEl.innerHTML = `TX: <a href="${this.escapeHtml(mempoolUrl)}" target="_blank" rel="noopener noreferrer" class="tooltip-link">${shortTxid} ↗</a>`;
    } else {
      txidEl.innerHTML = `<span style="color: #888;">TX: ${shortTxid}</span>`;
    }
    
    if (plot.uri) {
      const sanitizedUrl = this.sanitizeUrl(plot.uri);
      const escapedUrl = this.escapeHtml(plot.uri);
      
      if (sanitizedUrl) {
        uriEl.innerHTML = `<a href="${this.escapeHtml(sanitizedUrl)}" target="_blank" rel="noopener noreferrer" class="tooltip-link">${escapedUrl} ↗</a>`;
      } else {
        uriEl.innerHTML = `<span style="color: #ff6b6b;" title="Blocked: potentially dangerous URI">${escapedUrl} ⚠️</span>`;
      }
    } else {
      uriEl.innerHTML = '<span style="color: #888;">No URI</span>';
    }
    
    // Position the tooltip above the cursor
    tooltip.style.left = `${screenX}px`;
    tooltip.style.top = `${screenY - 140}px`;
    
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
  static showPlotListModal(state: StateData, onPlotSelect: (plot: PlotState) => void, imageUrlGetter: (txid: string) => string, environment: 'mainnet' | 'testnet' | 'regtest' = 'mainnet'): void {
    this.allPlots = state.plots;
    this.onPlotSelected = onPlotSelect;
    this.imageUrlGetter = imageUrlGetter;
    this.environment = environment;
    
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
   * Show the about modal
   */
  static showAboutModal(): void {
    const modal = document.getElementById('about-modal');
    if (modal) {
      modal.classList.add('active');
    }
  }

  /**
   * Close the about modal
   */
  static closeAboutModal(): void {
    const modal = document.getElementById('about-modal');
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
   * Get mempool.space URL for a transaction
   */
  private static getMempoolUrl(txid: string): string | null {
    if (this.environment === 'mainnet') {
      return `https://mempool.space/tx/${txid}`;
    } else if (this.environment === 'testnet') {
      return `https://mempool.space/testnet/tx/${txid}`;
    }
    // No public explorer for regtest
    return null;
  }

  /**
   * Create HTML for a single plot list item
   */
  private static createPlotListItem(plot: PlotState): string {
    let uriSection = '';
    if (plot.uri) {
      const sanitizedUrl = this.sanitizeUrl(plot.uri);
      const escapedUrl = this.escapeHtml(plot.uri);
      
      if (sanitizedUrl) {
        uriSection = `
          <div><strong>URI:</strong> <a href="${this.escapeHtml(sanitizedUrl)}" target="_blank" rel="noopener noreferrer" class="txid-link">${escapedUrl}</a></div>
        `;
      } else {
        uriSection = `
          <div><strong>URI:</strong> <code style="color: #ff6b6b;" title="Blocked: potentially dangerous URI">${escapedUrl} ⚠️</code></div>
        `;
      }
    }
    
    const imageUrl = this.imageUrlGetter ? this.imageUrlGetter(plot.txid) : '';
    
    // Create transaction link for mempool.space
    const mempoolUrl = this.getMempoolUrl(plot.txid);
    const escapedTxid = this.escapeHtml(plot.txid);
    const txidDisplay = mempoolUrl 
      ? `<a href="${this.escapeHtml(mempoolUrl)}" target="_blank" rel="noopener noreferrer" class="txid-link">${escapedTxid}</a>`
      : `<code>${escapedTxid}</code>`;
    
    const escapedOwner = this.escapeHtml(plot.owner);
    const escapedStatus = this.escapeHtml(plot.status);
    
    return `
      <div class="plot-list-item">
        <div class="plot-item-header">
          <span class="plot-status ${plot.status.toLowerCase()}">${escapedStatus}</span>
        </div>
        <div class="plot-item-content">
          <img class="plot-item-image" src="${this.escapeHtml(imageUrl)}" alt="Plot image" />
          <div class="plot-item-details">
            <div><strong>Position:</strong> <code>(${plot.x0}, ${plot.y0})</code></div>
            <div><strong>Size:</strong> <code>${plot.width}×${plot.height}</code></div>
            <div><strong>Owner:</strong> <code>${escapedOwner}</code></div>
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
    
    // Close about modal
    const closeAboutBtn = document.getElementById('close-about');
    if (closeAboutBtn) {
      closeAboutBtn.addEventListener('click', () => {
        this.closeAboutModal();
      });
    }
    
    // Close about modal when clicking outside
    const aboutModal = document.getElementById('about-modal');
    if (aboutModal) {
      aboutModal.addEventListener('click', (e: MouseEvent) => {
        if ((e.target as HTMLElement).id === 'about-modal') {
          this.closeAboutModal();
        }
      });
    }
    
    // Close modals on Escape key
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closePlotListModal();
        this.closeAboutModal();
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