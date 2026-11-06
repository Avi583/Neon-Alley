// What the biker carries: cans from the vending machine and food taken off the shop counters.
// Items with the same id stack in one slot. No DOM here, ui.js draws it.
export const INVENTORY_SLOTS = 12;

export class Inventory {
  constructor(slots = INVENTORY_SLOTS) {
    this.slots = slots;
    this.items = []; // { id, name, color, count }, in the order first picked up
    this.onChange = null;
  }

  get total() {
    return this.items.reduce((n, it) => n + it.count, 0);
  }

  count(id) {
    return this.items.find((it) => it.id === id)?.count ?? 0;
  }

  // Room for one more of this id: it stacks onto a slot already held, or there's a free slot.
  canAdd(id) {
    return this.items.some((it) => it.id === id) || this.items.length < this.slots;
  }

  // Returns true if the item went in.
  add({ id, name, color = null }) {
    if (!this.canAdd(id)) return false;
    const held = this.items.find((it) => it.id === id);
    if (held) held.count++;
    else this.items.push({ id, name, color, count: 1 });
    this.onChange?.(this);
    return true;
  }

  // Takes one of this id out. The slot frees up, and later slots move up, once its stack runs out.
  // Returns the item as it was, or null if none was held.
  remove(id) {
    const i = this.items.findIndex((it) => it.id === id);
    if (i < 0) return null;
    const item = { ...this.items[i] };
    if (--this.items[i].count === 0) this.items.splice(i, 1);
    this.onChange?.(this);
    return item;
  }
}
