export class RaceRandom {
  constructor(seed?: number | string);
  state: number;
  static hash(seed: number | string): number;
  nextU32(): number;
  next(): number;
  int(maxExclusive: number): number;
  fork(label?: string): RaceRandom;
}
