/**
 * Neon Rift Racers — Main Entry Point
 *
 * During Phase 1 migration, this file bootstraps the legacy game systems
 * through Vite's module resolution (replacing the old import map approach).
 *
 * As new TypeScript modules are built, they will replace these legacy imports
 * one system at a time.
 */

// ============================================================================
// Phase 1: Bridge to legacy game
// The old main.js is imported directly. Vite resolves 'three' from node_modules
// instead of from the CDN import map.
// ============================================================================

// @ts-ignore — legacy JS module, will be replaced incrementally
import './main.js';

// ============================================================================
// New TypeScript core modules (being built incrementally)
// ============================================================================
// These will be uncommented as each module is completed:
// import { EventBus } from '@core/EventBus';
// import { SeededRandom } from '@core/SeededRandom';
// import { GameLoop } from './app/GameLoop';
// import { Settings } from './app/Settings';
// import { SaveManager } from './app/SaveManager';

console.log(
  '%c⚡ NEON RIFT RACERS %cv0.1.0-alpha',
  'color: #00ffff; font-size: 20px; font-weight: bold; text-shadow: 0 0 10px #00ffff;',
  'color: #ff00ff; font-size: 14px;',
);
