import { StateData, UBBConfig } from '../backend/types.js';

export class StateLoader {
  private apiBase: string;
  private config: UBBConfig;

  constructor(apiBase: string = '', config?: UBBConfig) {
    this.apiBase = apiBase;
    // Use provided config or fall back to window.UBB_CONFIG
    this.config = config || window.UBB_CONFIG;
  }

  async loadTipState(): Promise<StateData> {
    try {
      // In static mode, fetch the tip state directly using the hardcoded tip hash
      const stateUrl = `${this.apiBase}${this.config.dataPath}/states/${this.config.tipHash}`;
      console.log('Loading tip state from:', stateUrl);
      
      const response = await fetch(stateUrl);
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseText = await response.text();
      console.log('Response text (first 200 chars):', responseText.substring(0, 200));
      
      const state = JSON.parse(responseText) as StateData;
      console.log('Parsed state:', state);
      
      return state;
    } catch (error) {
      console.error('Error loading state:', error);
      throw error;
    }
  }

  getConfig(): UBBConfig {
    return this.config;
  }

  getImageUrl(txid: string): string {
    return `${this.apiBase}${this.config.dataPath}/images/${txid}.bmp`;
  }
}
