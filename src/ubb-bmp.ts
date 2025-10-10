// @ts-ignore - bmp-js doesn't have type definitions
const bmpjs = require('bmp-js');

export interface BMPData {
  width: number;
  height: number;
  bitPP: number;
  compress: number;
  fileSize: number;
  offset: number;
  rawSize: number;
  is_with_alpha: boolean;
  bottom_up: boolean;
}

/**
 * Immutable value object representing a BMP file validated against UBB protocol rules
 */
export class UBBBMP {
  private readonly _buffer: Buffer;
  private _bmpData: BMPData | null = null;
  private _errors: readonly string[] | null = null;
  private _warnings: readonly string[] | null = null;
  private _isValid: boolean | null = null;

  constructor(buffer: Buffer) {
    this._buffer = buffer;
  }

  /**
   * Whether the BMP is valid according to UBB protocol rules
   */
  get isValid(): boolean {
    this._ensureValidated();
    return this._isValid!;
  }

  /**
   * Array of validation errors
   */
  get validationErrors(): readonly string[] {
    this._ensureValidated();
    return this._errors!;
  }

  /**
   * Array of validation warnings
   */
  get validationWarnings(): readonly string[] {
    this._ensureValidated();
    return this._warnings!;
  }

  /**
   * BMP width in pixels
   */
  get width(): number {
    this._ensureValidated();
    return this._bmpData!.width;
  }

  /**
   * BMP height in pixels
   */
  get height(): number {
    this._ensureValidated();
    return this._bmpData!.height;
  }

  /**
   * Bits per pixel (24 or 32)
   */
  get bitsPerPixel(): number {
    this._ensureValidated();
    return this._bmpData!.bitPP;
  }

  /**
   * Compression type (should be 0 for BI_RGB)
   */
  get compression(): number {
    this._ensureValidated();
    return this._bmpData!.compress;
  }

  /**
   * Actual file size in bytes
   */
  get fileSize(): number {
    this._ensureValidated();
    return this._bmpData!.fileSize;
  }

  /**
   * Expected file size based on dimensions
   */
  get expectedFileSize(): number {
    this._ensureValidated();
    return this.calculateExpectedFileSize(this._bmpData!);
  }

  /**
   * Row stride in bytes (padded to 4-byte boundary)
   */
  get stride(): number {
    this._ensureValidated();
    return this.calculateStride(this._bmpData!.width, this._bmpData!.bitPP);
  }

  /**
   * Plot area in pixels
   */
  get area(): number {
    return this.width * this.height;
  }

  /**
   * Absolute height for placement (handles BMP top-down vs bottom-up)
   */
  get absoluteHeight(): number {
    return Math.abs(this.height);
  }

  /**
   * Whether this is a 24-bit RGB BMP
   */
  get is24Bit(): boolean {
    return this.bitsPerPixel === 24;
  }

  /**
   * Whether this is a 32-bit RGBA BMP
   */
  get is32Bit(): boolean {
    return this.bitsPerPixel === 32;
  }

  /**
   * Whether compression is BI_RGB (uncompressed)
   */
  get isUncompressed(): boolean {
    return this.compression === 0;
  }

  /**
   * Whether file size matches expected size
   */
  get hasCorrectFileSize(): boolean {
    return this.fileSize === this.expectedFileSize;
  }

  /**
   * Get detailed validation report
   */
  getValidationReport(): {
    isValid: boolean;
    errors: readonly string[];
    warnings: readonly string[];
    bmpInfo: {
      width: number;
      height: number;
      bitsPerPixel: number;
      compression: number;
      fileSize: number;
      expectedFileSize: number;
      stride: number;
    };
  } {
    this._ensureValidated();
    return {
      isValid: this._isValid!,
      errors: this._errors!,
      warnings: this._warnings!,
      bmpInfo: {
        width: this.width,
        height: this.height,
        bitsPerPixel: this.bitsPerPixel,
        compression: this.compression,
        fileSize: this.fileSize,
        expectedFileSize: this.expectedFileSize,
        stride: this.stride,
      }
    };
  }

  /**
   * Ensures validation has been performed (lazy initialization)
   */
  private _ensureValidated(): void {
    if (this._isValid !== null) {
      return; // Already validated
    }

    const validation = this._validateBMP();
    this._bmpData = validation.bmpData;
    this._errors = validation.errors;
    this._warnings = validation.warnings;
    this._isValid = validation.isValid;
  }

  private _validateBMP(): {
    bmpData: BMPData;
    errors: readonly string[];
    warnings: readonly string[];
    isValid: boolean;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let isValid = true;
    let bmpData: BMPData;

    try {
      // Parse BMP file using bmp-js
      const bmpResult = bmpjs.decode(this._buffer);
      
      // Store the parsed BMP data
      bmpData = {
        width: bmpResult.width,
        height: bmpResult.height,
        bitPP: bmpResult.bitPP,
        compress: bmpResult.compress,
        fileSize: bmpResult.fileSize,
        offset: bmpResult.offset,
        rawSize: bmpResult.rawSize,
        is_with_alpha: bmpResult.is_with_alpha,
        bottom_up: bmpResult.bottom_up,
      };

      // Validate BMP format requirements
      this._validateBMPFormat(bmpData, errors, warnings);
      
      // Check file size validation
      this._validateFileSize(bmpData, errors, warnings);

      isValid = errors.length === 0;

    } catch (error) {
      isValid = false;
      errors.push(`Failed to parse BMP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Provide default BMP data for error cases
      bmpData = {
        width: 0,
        height: 0,
        bitPP: 0,
        compress: -1,
        fileSize: 0,
        offset: 0,
        rawSize: 0,
        is_with_alpha: false,
        bottom_up: false,
      };
    }

    return {
      bmpData,
      errors: Object.freeze([...errors]),
      warnings: Object.freeze([...warnings]),
      isValid
    };
  }

  private calculateStride(width: number, bitsPerPixel: number): number {
    const bytesPerPixel = bitsPerPixel / 8;
    return Math.ceil((width * bytesPerPixel) / 4) * 4;
  }

  private calculateExpectedFileSize(bmpData: BMPData): number {
    const stride = this.calculateStride(bmpData.width, bmpData.bitPP);
    return bmpData.offset + (stride * Math.abs(bmpData.height));
  }

  private _validateBMPFormat(bmpData: BMPData, errors: string[], warnings: string[]): void {
    // Check bits per pixel (must be 24 or 32)
    if (bmpData.bitPP !== 24 && bmpData.bitPP !== 32) {
      errors.push(`Invalid bits per pixel: ${bmpData.bitPP}. Must be 24 or 32.`);
    }

    // Check compression (must be BI_RGB = 0)
    if (bmpData.compress !== 0) {
      errors.push(`Invalid compression: ${bmpData.compress}. Must be BI_RGB (0) - uncompressed only.`);
    }

    // Check for zero-sized plots
    if (bmpData.width === 0 || bmpData.height === 0) {
      errors.push(`Zero-sized plots are forbidden. Width: ${bmpData.width}, Height: ${bmpData.height}`);
    }

    // Check if dimensions are reasonable (not negative)
    if (bmpData.width < 0 || bmpData.height < 0) {
      errors.push(`Negative dimensions not allowed. Width: ${bmpData.width}, Height: ${bmpData.height}`);
    }
  }

  private _validateFileSize(bmpData: BMPData, errors: string[], warnings: string[]): void {
    const expectedSize = this.calculateExpectedFileSize(bmpData);
    const actualBufferSize = this._buffer.length;
    
    // Check if header's claimed fileSize matches expected size based on dimensions
    if (bmpData.fileSize !== expectedSize) {
      errors.push(
        `File size mismatch. Expected: ${expectedSize} bytes, Actual: ${bmpData.fileSize} bytes. ` +
        `This indicates the BMP file may be corrupted or not properly formatted.`
      );
    }
    
    // Check if actual buffer length matches the header's claimed fileSize
    // This catches truncated files where the header claims more data than is present
    if (actualBufferSize !== bmpData.fileSize) {
      errors.push(
        `Buffer size mismatch. Header claims: ${bmpData.fileSize} bytes, Buffer contains: ${actualBufferSize} bytes. ` +
        `This indicates the BMP file has been truncated or padded.`
      );
    }
  }
}
