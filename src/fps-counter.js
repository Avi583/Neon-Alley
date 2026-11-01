// Averages the frame rate over about half a second. Takes the real time between
// frames, not the game's clamped time step, so slow frames read as slow.
export class FpsCounter {
  frames = 0;
  time = 0;

  // Returns the frame rate once enough time has passed, otherwise null.
  sample(elapsedMs) {
    this.frames++;
    this.time += elapsedMs / 1000;
    if (this.time <= 0.5) return null;
    const fps = this.frames / this.time;
    this.frames = 0;
    this.time = 0;
    return fps;
  }
}
