# Manual test checklist

Automated tests (`npm test`) cover noise, quality presets and sign data. This checklist covers what they can't judge. Run it before each deploy and after any change to rendering, input or audio.

## Devices and browsers
- [ ] Real phone: joystick (left side) moves, dragging the right side looks around, no page scroll or zoom
- [ ] Touchscreen laptop: mouse look works (see F1), touch controls don't take over the mouse
- [ ] Chrome, Firefox and Safari: loads with no console errors and no shader compile errors
- [ ] Each quality preset (`?q=low`, `medium`, `high`, `ultra`) loads and looks right

## Input and state
- [ ] Click to start: pointer locks, WASD/arrows move, Shift runs, mouse looks
- [ ] Esc pauses; resume re-locks the pointer (try pressing Esc and clicking back in straight away, see F2)
- [ ] Tab away and back: no stuck keys
- [ ] Walls and props block the player; no walking out of the alley

## Audio
- [ ] Audio starts only after the first click
- [ ] Mute toggle works both ways, and the hum stays quiet while muted or paused
- [ ] Footsteps follow movement speed

## Display
- [ ] Resize the window and rotate the phone: no stretching, and the render resolution recovers
- [ ] Sign canvas size cap (B5): on Ultra, the 7 m "夜市" banner is sharp and nothing is blurry or missing
- [ ] Neon signs flicker as expected and light the walls around them
- [ ] Wet-ground reflections show the signs and move correctly with the camera
- [ ] Fog looks smooth, with no visible banding or blockiness (A2)
- [ ] Snow and steam render, with flakes the right size
- [ ] FPS counter reads sensibly when the frame rate is low (F3)
