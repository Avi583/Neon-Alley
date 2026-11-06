import { describe, it, expect } from 'vitest';
import { Inventory, INVENTORY_SLOTS } from '../src/inventory.js';

const cola = { id: 'can:COLA', name: 'COLA', color: '#e0162e' };
const ramen = { id: 'food:RAMEN', name: 'RAMEN' };

describe('Inventory', () => {
  it('starts empty with the default number of slots', () => {
    const inv = new Inventory();
    expect(inv.slots).toBe(INVENTORY_SLOTS);
    expect(inv.items).toEqual([]);
    expect(inv.total).toBe(0);
  });

  it('stacks the same id in one slot and keeps pick-up order', () => {
    const inv = new Inventory();
    inv.add(cola);
    inv.add(ramen);
    inv.add(cola);
    expect(inv.items.map((it) => it.id)).toEqual(['can:COLA', 'food:RAMEN']);
    expect(inv.count('can:COLA')).toBe(2);
    expect(inv.count('food:RAMEN')).toBe(1);
    expect(inv.count('food:SOJU')).toBe(0);
    expect(inv.total).toBe(3);
    expect(inv.items[0].color).toBe('#e0162e');
    expect(inv.items[1].color).toBe(null);
  });

  it('refuses a new kind once every slot is taken, but still stacks', () => {
    const inv = new Inventory(2);
    expect(inv.add(cola)).toBe(true);
    expect(inv.add(ramen)).toBe(true);
    expect(inv.canAdd('food:SOJU')).toBe(false);
    expect(inv.add({ id: 'food:SOJU', name: 'SOJU' })).toBe(false);
    expect(inv.canAdd('can:COLA')).toBe(true);
    expect(inv.add(cola)).toBe(true);
    expect(inv.total).toBe(3);
  });

  it('reports each change, and not a refused add', () => {
    const inv = new Inventory(1);
    let changes = 0;
    inv.onChange = () => changes++;
    inv.add(cola);
    inv.add(cola);
    inv.add(ramen);
    expect(changes).toBe(2);
  });

  it('removes one at a time, freeing the slot once the stack runs out', () => {
    const inv = new Inventory(2);
    let changes = 0;
    inv.add(cola);
    inv.add(cola);
    inv.add(ramen);
    inv.onChange = () => changes++;
    expect(inv.remove('can:COLA')).toMatchObject({ id: 'can:COLA', count: 2 });
    expect(inv.count('can:COLA')).toBe(1);
    expect(inv.remove('can:COLA')).toMatchObject({ id: 'can:COLA', count: 1 });
    expect(inv.items.map((it) => it.id)).toEqual(['food:RAMEN']);
    expect(inv.remove('can:COLA')).toBe(null);
    expect(changes).toBe(2);
    expect(inv.canAdd('food:SOJU')).toBe(true);
  });
});
