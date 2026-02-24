export interface PhotoSize {
  id: string;
  name: string;
  widthCm: number;
  heightCm: number;
  isCustom?: boolean;
}

export const STANDARD_SIZES: PhotoSize[] = [
  { id: '10x15', name: '10x15 (4x6")', widthCm: 10, heightCm: 15 },
  { id: '13x18', name: '13x18 (5x7")', widthCm: 13, heightCm: 18 },
  { id: '15x21', name: '15x21 (6x8")', widthCm: 15, heightCm: 21 },
  { id: '20x25', name: '20x25 (8x10")', widthCm: 20, heightCm: 25 },
  { id: '10x10', name: '10x10 (4x4")', widthCm: 10, heightCm: 10 },
  { id: '5x7', name: '5x7 (2x3")', widthCm: 5, heightCm: 7 },
  { id: '3x4', name: '3x4', widthCm: 3, heightCm: 4 },
];

export const A4_WIDTH_CM = 21;
export const A4_HEIGHT_CM = 29.7;
export const DPI = 300;
export const CM_TO_INCH = 0.393701;

export interface ImageFile {
  id: string;
  file: File;
  previewUrl: string;
  copies: number;
  width: number;
  height: number;
}

export interface PrintSettings {
  sizeId: string;
  customWidth: number;
  customHeight: number;
  customUnit: 'cm' | 'inch' | 'px';
  hasBorder: boolean;
  isPolaroid: boolean;
  orientation: 'auto' | 'portrait' | 'landscape';
  spacing: number; // in cm
  margin: number; // in cm
  fitMode: 'cover' | 'contain';
}
