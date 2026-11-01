# Manual test checklist

`npm test` covers noise, quality presets, sign data, the generated layout and whether it can be walked, player movement and touch controls, page states and quality pills, vending, food shops, neon food, footprints, puddles, adaptive scale and the FPS counter. `npm run test:browser` runs the browser tests in Chromium, after `npx playwright install chromium`, with no network needed: texture and sign pixels (also on their own with `npm run test:textures`), a smoke test of the production build on every preset, what pressing E does, every sound without errors, and mouse look on a touchscreen laptop (F1, still open and expected to fail). The texture snapshot is per platform and machine, so a failure on another machine doesn't by itself mean a texture changed. All test files are in `tests/`. `npm run perf` records a performance baseline on the real GPU, to run before and after a performance change, plugged in on a laptop. Compare rendering changes by `gpuMs`: `frameMs` has a floor of about 4 ms on a fast GPU, and differences within about 5% between runs are noise. This checklist covers what they can't judge. Run it before each deploy and after any change to rendering, input or audio.

## Devices and browsers
- [ ] Real phone: joystick (left side) moves, dragging the right side looks around, no page scroll or zoom
- [ ] Touchscreen laptop: mouse look works (see F1), touch controls don't take over the mouse
- [ ] Chrome, Firefox and Safari: loads with no console errors and no shader compile errors
- [ ] Each quality preset (`?q=low`, `medium`, `high`, `ultra`) loads and looks right

## Input and state
- [ ] Click to start: pointer locks, WASD/arrows move, Shift runs, mouse looks
- [ ] Esc pauses; resume re-locks the pointer (try pressing Esc and clicking back in straight away, see F2)
- [ ] Pause menu: Sound and Graphics don't unpause, clicking outside the panel doesn't unpause, and Resume does
- [ ] Changing graphics from the pause menu reloads with the player in the same spot
- [ ] Tab away and back: no stuck keys
- [ ] Walls and props block the player; no walking out of the alley
- [ ] Buying food: the neon goes, the hatch slides open, the base lifts the dish through it with a whirr and clunk, and no dish shows through the side of a riser

## Audio
- [ ] Audio starts only after the first click
- [ ] Mute toggle works both ways, and the hum stays quiet while muted or paused
- [ ] Footsteps follow movement speed

## Display
- [ ] Resize the window and rotate the phone: no stretching, and the render resolution recovers
- [ ] Adaptive scale (B7): on a slow preset the FPS counter (F) shows a percentage, with no repeated hitching or visible pumping in sharpness
- [ ] Sign canvas size cap (B5): on Ultra, the 7 m "夜市" banner is sharp and nothing is blurry or missing
- [ ] Neon signs flicker as expected and light the walls around them
- [ ] Wet-ground reflections show the signs and move correctly with the camera
- [ ] Fog looks smooth, with no visible banding or blockiness (A2)
- [ ] Snow and steam render, with flakes the right size
- [ ] Snow piles (A36) look rounded on bollards, AC units and the cross-street banks, with no white sheet under awnings or signs
- [ ] Boot marks (A12) appear when walking, pale on asphalt and dark in snow, and are gone after about 20 seconds
- [ ] AC drip stains (A18) show below wall units, with no flicker on the wall from a distance
- [ ] FPS counter reads sensibly when the frame rate is low (F3)
