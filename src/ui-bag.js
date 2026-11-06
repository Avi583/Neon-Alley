// The inventory panel: one cell per bag slot, and the number-row keys that use them.

// The key for each bag slot, in order: 1-9, 0, - and =, as along the number row.
export const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];
const SLOT_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

// Fills els.slots with one cell per slot, in pick-up order, with the rest left empty, and updates
// els.count and els.button. A filled cell uses its item when clicked or tapped (onPick gets the slot's index).
export function renderBag(els, inventory, onPick = null) {
  const cells = [];
  for (let i = 0; i < inventory.slots; i++) {
    const item = inventory.items[i];
    const cell = document.createElement('div');
    cell.className = item ? 'bag-slot' : 'bag-slot empty';
    if (item) {
      cell.textContent = item.name;
      if (item.color) cell.style.setProperty?.('--slot', item.color);
      if (SLOT_LABELS[i]) {
        const k = document.createElement('span');
        k.className = 'k';
        k.textContent = SLOT_LABELS[i];
        cell.appendChild(k);
      }
      if (onPick) cell.addEventListener('click', () => onPick(i));
      if (item.count > 1) {
        const n = document.createElement('span');
        n.className = 'n';
        n.textContent = `×${item.count}`;
        cell.appendChild(n);
      }
    }
    cells.push(cell);
  }
  els.slots.replaceChildren(...cells);
  els.count.textContent = `${inventory.items.length}/${inventory.slots}`;
  els.button.textContent = `BAG ${inventory.total}`;
}
