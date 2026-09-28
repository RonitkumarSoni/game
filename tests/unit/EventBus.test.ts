import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '@core/EventBus';

describe('EventBus', () => {
  it('should call handlers when an event is emitted', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('race:countdown', handler);
    bus.emit('race:countdown', { n: 3 });
    expect(handler).toHaveBeenCalledWith({ n: 3 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should support multiple handlers for the same event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('race:go', h1);
    bus.on('race:go', h2);
    bus.emit('race:go', {});
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('should not call handler after unsubscribe via off()', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('race:go', handler);
    bus.off('race:go', handler);
    bus.emit('race:go', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('should return an unsubscribe function from on()', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('race:go', handler);
    unsub();
    bus.emit('race:go', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('should isolate errors — one handler throwing should not prevent others', () => {
    const bus = new EventBus();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    bus.on('race:go', bad);
    bus.on('race:go', good);
    bus.emit('race:go', {});
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('should clear all handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('race:go', handler);
    bus.on('race:countdown', handler);
    bus.clear();
    bus.emit('race:go', {});
    bus.emit('race:countdown', { n: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('should clear handlers for a specific event', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('race:go', h1);
    bus.on('race:countdown', h2);
    bus.clearEvent('race:go');
    bus.emit('race:go', {});
    bus.emit('race:countdown', { n: 2 });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('should report correct listener count', () => {
    const bus = new EventBus();
    expect(bus.listenerCount('race:go')).toBe(0);
    const unsub = bus.on('race:go', () => {});
    expect(bus.listenerCount('race:go')).toBe(1);
    unsub();
    expect(bus.listenerCount('race:go')).toBe(0);
  });

  it('should not throw when emitting an event with no handlers', () => {
    const bus = new EventBus();
    expect(() => bus.emit('race:go', {})).not.toThrow();
  });
});
