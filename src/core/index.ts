/**
 * Neon Rift Racers — Core Module Barrel Export
 *
 * Re-exports all core utilities for clean imports:
 * import { EventBus, SeededRandom, ObjectPool } from '@core';
 */

export { EventBus, bus } from './EventBus';
export type { GameEvents } from './EventBus';
export { SeededRandom } from './SeededRandom';
export { ObjectPool } from './ObjectPool';
export type { Poolable } from './ObjectPool';
