/**
 * Neon Rift Racers — Typed Event Bus
 *
 * A strongly-typed pub/sub event system. All cross-system communication
 * flows through this bus. Error isolation prevents one handler from
 * crashing others.
 *
 * Ported from the legacy events.js with full TypeScript generics.
 */

/** Map of event names to their payload types. Extend this interface to register new events. */
export interface GameEvents {
  // --- Race lifecycle ---
  'race:countdown': { n: number };
  'race:go': Record<string, never>;
  'race:lap': { kartIndex: number; lap: number; lapTime: number };
  'race:finalLap': Record<string, never>;
  'race:finish': { kartIndex: number; place: number; time: number };
  'race:end': { results: unknown[] };
  'race:wrongWay': { active: boolean };

  // --- Vehicle events ---
  'vehicle:driftStart': { kartIndex: number };
  'vehicle:driftLevel': { kartIndex: number; level: number };
  'vehicle:driftEnd': { kartIndex: number };
  'vehicle:miniTurbo': { kartIndex: number; level: number };
  'vehicle:boost': { kartIndex: number; source: string };
  'vehicle:hit': { kartIndex: number; kind: string };
  'vehicle:wallBump': { kartIndex: number; intensity: number };
  'vehicle:jump': { kartIndex: number };
  'vehicle:land': { kartIndex: number; airTime: number };
  'vehicle:bump': { a: number; b: number; intensity: number };

  // --- Ability events ---
  'ability:pickup': { kartIndex: number };
  'ability:roulette': { kartIndex: number };
  'ability:got': { kartIndex: number; ability: string };
  'ability:use': { kartIndex: number; ability: string };
  'ability:hit': { kartIndex: number; ability: string; byIndex: number };
  'ability:explode': { position: { x: number; y: number; z: number } };

  // --- Game state ---
  'game:state': { state: string };
  'game:settingsChanged': { key: string; value: unknown };

  // --- UI events ---
  'ui:back': Record<string, never>;
  'ui:toast': { message: string; duration?: number };
}

type EventHandler<T> = (data: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler<unknown>>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<K extends keyof GameEvents>(name: K, fn: EventHandler<GameEvents[K]>): () => void {
    const key = name as string;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    const set = this.handlers.get(key)!;
    set.add(fn as EventHandler<unknown>);
    return () => this.off(name, fn);
  }

  /**
   * Unsubscribe from an event.
   */
  off<K extends keyof GameEvents>(name: K, fn: EventHandler<GameEvents[K]>): void {
    const key = name as string;
    this.handlers.get(key)?.delete(fn as EventHandler<unknown>);
  }

  /**
   * Emit an event. All handlers are called with error isolation.
   */
  emit<K extends keyof GameEvents>(name: K, data: GameEvents[K]): void {
    const key = name as string;
    const set = this.handlers.get(key);
    if (!set) return;

    for (const fn of [...set]) {
      try {
        fn(data);
      } catch (err) {
        console.error(`[EventBus] handler for "${key}" threw:`, err);
      }
    }
  }

  /**
   * Remove all handlers for all events.
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Remove all handlers for a specific event.
   */
  clearEvent<K extends keyof GameEvents>(name: K): void {
    this.handlers.delete(name as string);
  }

  /**
   * Get the number of handlers for a specific event (useful for debugging).
   */
  listenerCount<K extends keyof GameEvents>(name: K): number {
    return this.handlers.get(name as string)?.size ?? 0;
  }
}

/** Global event bus instance */
export const bus = new EventBus();
