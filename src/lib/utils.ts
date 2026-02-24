import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cmToPx(cm: number, dpi: number = 300): number {
  return (cm * dpi) / 2.54;
}

export function pxToCm(px: number, dpi: number = 300): number {
  return (px * 2.54) / dpi;
}

export function inchToCm(inch: number): number {
  return inch * 2.54;
}
