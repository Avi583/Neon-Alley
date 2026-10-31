// Performance run for ?bench=<frames>, driven by tests/perf-baseline.js. Walks a
// fixed camera path by frame number, so every run draws the same views however
// fast it goes. The result ends up on window.__bench.

const WARMUP = 60; // frames left out while shaders and caches settle

export function createBench(renderer, player, bounds, total) {
  const startZ = bounds.walkZMax - 2, endZ = bounds.walkZMin + 2;
  const times = [];
  const pixel = new Uint8Array(4);
  let frame = 0, calls = 0, triangles = 0, loadMs = 0, frameStart = 0;

  renderer.info.autoReset = false; // the info must cover every pass of a frame, not just the last

  function gpuName() {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  }

  function percentile(sorted, p) {
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  }

  function finish() {
    const sorted = [...times].sort((a, b) => a - b);
    const n = times.length;
    const round = (v) => Math.round(v * 100) / 100;
    window.__bench = {
      gpu: gpuName(),
      frames: n,
      loadMs: Math.round(loadMs),
      frameMsAvg: round(times.reduce((a, b) => a + b, 0) / n),
      frameMsP50: round(percentile(sorted, 0.5)),
      frameMsP95: round(percentile(sorted, 0.95)),
      drawCalls: Math.round(calls / n),
      triangles: Math.round(triangles / n),
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      programs: renderer.info.programs.length,
    };
  }

  return {
    get done() { return frame >= WARMUP + total; },
    // The page is ready to play: everything up to here counts as load time.
    loaded() { loadMs = performance.now(); },
    // Before rendering: place the camera and start the clock.
    begin() {
      frameStart = performance.now();
      const f = frame / (WARMUP + total);
      player.pos.set(Math.sin(f * Math.PI * 6) * 0.8, startZ + (endZ - startZ) * f);
      player.yaw = Math.sin(f * Math.PI * 10) * 0.5;
      player.pitch = 0.05;
      renderer.info.reset();
    },
    // After rendering: stop the clock and count what the frame drew. GPU work is
    // queued, so without reading a pixel back this would only time the submission.
    end() {
      const gl = renderer.getContext();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      if (frame >= WARMUP) {
        times.push(performance.now() - frameStart);
        calls += renderer.info.render.calls;
        triangles += renderer.info.render.triangles;
      }
      frame++;
      if (this.done) finish();
    },
  };
}
