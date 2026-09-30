import { describe, expect, it } from 'vitest';
import { ITEMS, ABILITY_LABELS } from '../src/config.js';
import { Kart } from '../src/kart.js';
import { ItemSystem } from '../src/items.js';

describe('new tactical abilities', () => {
  it('includes both abilities in the playable roster', () => {
    expect(ITEMS).toHaveLength(10);
    expect(ABILITY_LABELS.phase_shield).toBe('Phase Shield');
    expect(ABILITY_LABELS.shockwave).toBe('Shockwave Pulse');
  });

  it('phase shield absorbs exactly one hit', () => {
    const kart = new Kart();
    kart.startShield(8);
    expect(kart.shieldVisual.visible).toBe(true);
    expect(kart.applyHit('tumble')).toBe(false);
    expect(kart.shieldTimer).toBe(0);
    expect(kart.shieldVisual.visible).toBe(false);
    expect(kart.applyHit('spin')).toBe(true);
    kart.dispose();
  });

  it('shockwave hits nearby rivals but not distant rivals or its owner', () => {
    const owner = new Kart({ index: 0 });
    const near = new Kart({ index: 1 });
    const far = new Kart({ index: 2 });
    near.position.set(10, 0, 0);
    far.position.set(20, 0, 0);
    const items = new ItemSystem({ karts: [owner, near, far] });
    owner.item = 'shockwave'; owner.itemCount = 1;
    items._useItem(owner);
    expect(owner.item).toBeNull();
    expect(owner.spinTimer).toBe(0);
    expect(near.spinTimer).toBeGreaterThan(0);
    expect(far.spinTimer).toBe(0);
    items.dispose();
    owner.dispose(); near.dispose(); far.dispose();
  });

  it('shield blocks projectile damage without reporting a successful hit', () => {
    const attacker = new Kart({ index: 0 });
    const defender = new Kart({ index: 1 });
    const items = new ItemSystem({ karts: [attacker, defender] });
    defender.startShield(8);
    expect(items._hitKart(defender, 'tumble', 'red_shell', attacker)).toBe(false);
    expect(defender.spinTimer).toBe(0);
    expect(defender.shieldTimer).toBe(0);
    expect(items._hitKart(defender, 'tumble', 'red_shell', attacker)).toBe(true);
    items.dispose(); attacker.dispose(); defender.dispose();
  });
});
