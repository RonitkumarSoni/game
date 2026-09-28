import { describe, it, expect } from 'vitest';
import { ObjectPool, Poolable } from '@core/ObjectPool';

class TestParticle implements Poolable {
  active = false;
  x = 0;
  y = 0;
  life = 0;
  resetCount = 0;

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.life = 1;
    this.resetCount++;
  }
}

describe('ObjectPool', () => {
  it('should pre-allocate the initial size', () => {
    const pool = new ObjectPool(() => new TestParticle(), 10);
    expect(pool.getCapacity()).toBe(10);
    expect(pool.getActiveCount()).toBe(0);
  });

  it('should acquire and release objects', () => {
    const pool = new ObjectPool(() => new TestParticle(), 5);
    const p1 = pool.acquire();
    expect(p1).not.toBeNull();
    expect(p1!.active).toBe(true);
    expect(pool.getActiveCount()).toBe(1);

    pool.release(p1!);
    expect(p1!.active).toBe(false);
    expect(pool.getActiveCount()).toBe(0);
  });

  it('should reset objects when acquired', () => {
    const pool = new ObjectPool(() => new TestParticle(), 2);
    const p = pool.acquire()!;
    expect(p.life).toBe(1);
    expect(p.resetCount).toBe(1);

    p.x = 100;
    p.life = 0;
    pool.release(p);

    const p2 = pool.acquire()!;
    expect(p2).toBe(p); // same object reused
    expect(p2.x).toBe(0); // reset was called
    expect(p2.life).toBe(1);
    expect(p2.resetCount).toBe(2);
  });

  it('should grow when pool is exhausted and under max', () => {
    const pool = new ObjectPool(() => new TestParticle(), 2, 5);
    pool.acquire();
    pool.acquire();
    expect(pool.getCapacity()).toBe(2);

    const p3 = pool.acquire();
    expect(p3).not.toBeNull();
    expect(pool.getCapacity()).toBe(3);
  });

  it('should return null when at max capacity', () => {
    const pool = new ObjectPool(() => new TestParticle(), 2, 2);
    pool.acquire();
    pool.acquire();
    const p3 = pool.acquire();
    expect(p3).toBeNull();
  });

  it('should release all objects', () => {
    const pool = new ObjectPool(() => new TestParticle(), 5);
    pool.acquire();
    pool.acquire();
    pool.acquire();
    expect(pool.getActiveCount()).toBe(3);

    pool.releaseAll();
    expect(pool.getActiveCount()).toBe(0);
  });

  it('should iterate over active items', () => {
    const pool = new ObjectPool(() => new TestParticle(), 5);
    const p1 = pool.acquire()!;
    pool.acquire()!;
    const p3 = pool.acquire()!;
    pool.release(p1); // p1 inactive

    const active: TestParticle[] = [];
    pool.forEachActive((p) => active.push(p));
    expect(active.length).toBe(2);
    expect(active).not.toContain(p1);
    expect(active).toContain(p3);
  });

  it('should not double-decrement on repeated release', () => {
    const pool = new ObjectPool(() => new TestParticle(), 3);
    const p = pool.acquire()!;
    pool.release(p);
    pool.release(p); // should be safe
    expect(pool.getActiveCount()).toBe(0);
  });

  it('dispose should empty the pool', () => {
    const pool = new ObjectPool(() => new TestParticle(), 5);
    pool.acquire();
    pool.acquire();
    pool.dispose();
    expect(pool.getCapacity()).toBe(0);
    expect(pool.getActiveCount()).toBe(0);
  });
});
