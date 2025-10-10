declare module 'bmp-js' {
  interface BMPData {
    data: Buffer;
    width: number;
    height: number;
  }
  
  export function decode(buffer: Buffer): BMPData;
  export function encode(data: BMPData): Buffer;
}
