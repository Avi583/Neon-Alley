// What can be bought and carried: the vending machine's cans and the shops' food, with their
// prices. The menus, labels and prompts all read from here.
export const yen = (price) => `¥${price}`;

export const CAN_PRICE = 120;
// [label colour, ink, name] for each flavour, in the order of the cells on the can label strip.
export const CAN_LABELS = [
  ['#e0162e', '#ffffff', 'COLA'],
  ['#1a5cff', '#d8f4ff', 'SODA'],
  ['#ffc21f', '#c81e32', 'LEMON'],
  ['#14b866', '#f4fff0', 'MATCHA'],
  ['#8a35e0', '#ffe0ff', 'GRAPE'],
  ['#ff7a14', '#fff4d8', 'MIKAN'],
];
export const CAN_FLAVOURS = CAN_LABELS.length;

// radius is the hatch's in the shop counter, wide enough for the dish to come through.
export const FOOD = {
  onigiri: { name: 'ONIGIRI', price: 180, radius: 0.09 },
  nigiri: { name: 'SUSHI', price: 240, radius: 0.08 },
  maki: { name: 'SUSHI', price: 240, radius: 0.08 },
  ramen: { name: 'RAMEN', price: 980, radius: 0.13 },
  beer: { name: 'BEER', price: 600, radius: 0.09 },
  sake: { name: 'SAKE', price: 800, radius: 0.13 },
  soju: { name: 'SOJU', price: 500, radius: 0.105 },
};

export const foodLabel = (spot) => `BUY ${FOOD[spot.kind].name} ${yen(FOOD[spot.kind].price)}`;

// Bag items: one id per kind, so the same kind stacks in one slot.
export const canItem = (flavour) => ({ id: `can:${CAN_LABELS[flavour][2]}`, name: CAN_LABELS[flavour][2], color: CAN_LABELS[flavour][0] });
export const foodItem = (kind) => ({ id: `food:${FOOD[kind].name}`, name: FOOD[kind].name });
