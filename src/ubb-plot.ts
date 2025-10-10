import { UBBBMP } from './ubb-bmp';

/**
 * Immutable value object representing a plot placement on the UBB canvas
 */
export class UBBPlot {
  private readonly CANVAS_SIZE = 65536; // Canvas is 65536x65536 (coordinates 0-65535)
  
  private readonly _bmp: UBBBMP;
  private readonly _x0: number;
  private readonly _y0: number;
  private readonly _errors: readonly string[];
  private readonly _isValid: boolean;

  constructor(bmp: UBBBMP, x0: number, y0: number) {
    this._bmp = bmp;
    this._x0 = x0;
    this._y0 = y0;
    
    const validation = this._validatePlacement();
    this._errors = validation.errors;
    this._isValid = validation.isValid;
  }

  /**
   * The BMP file for this plot
   */
  get bmp(): UBBBMP {
    return this._bmp;
  }

  /**
   * Plot X coordinate (top-left corner)
   */
  get x0(): number {
    return this._x0;
  }

  /**
   * Plot Y coordinate (top-left corner)
   */
  get y0(): number {
    return this._y0;
  }

  /**
   * Whether the plot placement is valid
   */
  get isValid(): boolean {
    return this._isValid && this._bmp.isValid;
  }

  /**
   * Array of placement validation errors
   */
  get validationErrors(): readonly string[] {
    return this._errors;
  }

  /**
   * All validation errors (BMP + placement)
   */
  get allValidationErrors(): readonly string[] {
    return [...this._bmp.validationErrors, ...this._errors];
  }

  /**
   * Whether the plot fits within the UBB canvas
   */
  get withinCanvas(): boolean {
    return this.isWithinCanvas(this._x0, this._y0, this._bmp.width, this._bmp.height);
  }

  /**
   * Plot area in pixels
   */
  get area(): number {
    return this._bmp.area;
  }

  /**
   * Create a new plot at different coordinates
   */
  atPosition(x0: number, y0: number): UBBPlot {
    return new UBBPlot(this._bmp, x0, y0);
  }

  private _validatePlacement(): {
    errors: readonly string[];
    isValid: boolean;
  } {
    const errors: string[] = [];

    // Check if plot is within canvas bounds
    if (!this.isWithinCanvas(this._x0, this._y0, this._bmp.width, this._bmp.height)) {
      errors.push(
        `Plot extends outside canvas bounds. ` +
        `Position: (${this._x0}, ${this._y0}), Size: ${this._bmp.width}x${this._bmp.height}, ` +
        `Canvas: ${this.CANVAS_SIZE}x${this.CANVAS_SIZE}`
      );
    }

    // Check for valid coordinates
    if (this._x0 < 0 || this._y0 < 0) {
      errors.push(`Plot coordinates must be non-negative. Position: (${this._x0}, ${this._y0})`);
    }

    // Check if plot would be too large for the canvas
    if (this._x0 + this._bmp.width > this.CANVAS_SIZE || this._y0 + this._bmp.height > this.CANVAS_SIZE) {
      errors.push(
        `Plot extends beyond canvas boundaries. ` +
        `Right edge: ${this._x0 + this._bmp.width}, Bottom edge: ${this._y0 + this._bmp.height}, ` +
        `Canvas limit: ${this.CANVAS_SIZE}`
      );
    }

    return {
      errors: Object.freeze([...errors]),
      isValid: errors.length === 0
    };
  }

  private isWithinCanvas(x0: number, y0: number, width: number, height: number): boolean {
    return x0 >= 0 && 
           y0 >= 0 && 
           x0 + width <= this.CANVAS_SIZE && 
           y0 + height <= this.CANVAS_SIZE &&
           width > 0 && 
           height > 0;
  }
}
