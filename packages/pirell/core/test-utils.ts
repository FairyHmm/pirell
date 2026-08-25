import type { Pirell as PirellT } from "./types.js";

export const double = (data: PirellT<any, number[]>) => ({
  shape: data.shape,
  value: data.value.map((n: number) => n * 2),
});

export const sumAll = (data: PirellT<any, number[]>) => ({
  shape: [] as const,
  value: data.value.reduce((a: number, b: number) => a + b, 0),
});
