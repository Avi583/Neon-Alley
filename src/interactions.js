// What the E key (or a tap on the prompt) does where the player stands: buy or take a can at the
// vending machine, buy or take food at a shop counter, or knock on a door. find() runs every frame
// for the prompt, so the actions and their labels are built once and reused.
import * as THREE from 'three';
import { inReach } from './math.js';
import { ALLEY } from './alley.js';
import { VEND_TURN } from './vending.js';
import { FOOD_LIFT } from './food-shop.js';
import { KNOCK_LEAD, KNOCK_REACH, PICK_STAND } from './character.js';
import { CAN_PRICE, CAN_FLAVOURS, FOOD, yen, foodLabel, canItem, foodItem } from './items.js';

export const BUY = `BUY A DRINK ${yen(CAN_PRICE)}`, TAKE = 'TAKE THE DRINK', KNOCK = 'KNOCK', BAG_FULL = 'BAG FULL';
const KNOCK_COOLDOWN = 1000; // ms, no shorter than a knock (KNOCK_TIME in character.js)
const FOOD_COOLDOWN = 400; // ms, so a held key can't clear a counter
const AT_SPOT = 0.12; // m: near enough to the spot to pick up without walking to it first

export function createInteractions({ player, character, alley, vending, foodShop, neonFood, inventory, audio }) {
  const cans = Array.from({ length: CAN_FLAVOURS }, (_, f) => canItem(f));
  const kinds = Object.keys(FOOD);
  const foods = Object.fromEntries(kinds.map((k) => [k, foodItem(k)]));
  const buyLabels = Object.fromEntries(kinds.map((k) => [k, foodLabel({ kind: k })]));
  const takeLabels = Object.fromEntries(kinds.map((k) => [k, `TAKE ${FOOD[k].name}`]));
  const reaches = (spot) => inReach(spot, player.pos.x, player.pos.y, player.yaw);
  let nextKnock = 0, nextFood = 0;

  const knockAt = (door) => {
    if (performance.now() < nextKnock || character.picking) return;
    nextKnock = performance.now() + KNOCK_COOLDOWN;
    const knock = () => {
      nextKnock = performance.now() + KNOCK_COOLDOWN;
      character.knock(door);
      audio.knock(KNOCK_LEAD);
    };
    // The prompt shows from further back than the glove reaches, so the biker first walks up
    // to stand square in front of the door, as near as the walk bounds allow.
    if (Math.hypot(door.face - player.pos.x, door.z - player.pos.y) <= KNOCK_REACH) knock();
    else {
      const x = THREE.MathUtils.clamp(door.face - Math.sign(door.face) * KNOCK_REACH * 0.9, -ALLEY.walkX, ALLEY.walkX);
      player.walkTo(x, door.z, knock);
    }
  };

  // Taking a can: the biker walks up square to the bin if not there already, crouches and reaches in.
  // The can leaves the bin as the glove closes on it, and goes in the bag once the biker has stood up.
  const pickCan = () => {
    if (character.picking || character.knocking) return;
    const at = vending.nextPosition();
    if (!at) return;
    let item = null;
    const pick = () => character.pickUp(at, {
      onGrab: () => {
        const flavour = vending.take();
        if (flavour === null) return null;
        item = cans[flavour];
        audio.pickup();
        return vending.heldCan(flavour);
      },
      onDone: () => inventory.add(item),
    });
    const { side } = alley.vending; // side points into the wall, so the biker stands out from the can the other way
    const x = THREE.MathUtils.clamp(at.x - side * PICK_STAND, -ALLEY.walkX, ALLEY.walkX);
    if (Math.hypot(x - player.pos.x, at.z - player.pos.y) <= AT_SPOT) pick();
    else player.walkTo(x, at.z, pick);
  };

  // The one action of each kind, and the spot the last find() aimed it at.
  let dish = null, food = null, door = null;
  const full = { label: BAG_FULL, use: () => {} };
  const buyCan = { label: BUY, use: () => { if (vending.buy()) audio.whirr(VEND_TURN); } };
  const takeCan = { label: TAKE, use: pickCan };
  const takeDish = {
    label: '',
    use: () => {
      const item = foods[dish.kind];
      if (foodShop.take(dish)) { inventory.add(item); audio.pickup(); }
    },
  };
  const buyFood = {
    label: '',
    use: () => {
      if (performance.now() < nextFood) return;
      nextFood = performance.now() + FOOD_COOLDOWN;
      foodShop.buy(food);
      neonFood.hide(food.form, food.index);
      audio.purchase();
      audio.whirr(FOOD_LIFT);
    },
  };
  const knockDoor = { label: KNOCK, use: () => knockAt(door) };

  // The action in reach as { label, use }, or null. A full bag still shows, so the player knows why.
  function find() {
    if (!player.enabled) return null;
    const { x, y: z } = player.pos, yaw = player.yaw;
    if (reaches(alley.vending)) {
      const flavour = vending.nextFlavour();
      if (flavour === null) return buyCan;
      return inventory.canAdd(cans[flavour].id) ? takeCan : full;
    }
    dish = foodShop.takeTarget(x, z, yaw);
    if (dish) {
      if (!inventory.canAdd(foods[dish.kind].id)) return full;
      takeDish.label = takeLabels[dish.kind];
      return takeDish;
    }
    food = foodShop.target(x, z, yaw);
    if (food) {
      buyFood.label = buyLabels[food.kind];
      return buyFood;
    }
    door = alley.doors.find(reaches);
    return door ? knockDoor : null;
  }

  return { find, use: () => find()?.use() };
}
