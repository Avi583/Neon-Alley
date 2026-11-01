// Performance run for ?bench=<frames>, driven by tests/perf-baseline.js. Walks a
// fixed camera path by frame number, so every run draws the same views however
// fast it goes. The result ends up on window.__bench.
//
// Three timings, as they answer different questions:
//   cpuMs    begin to end of the JS, which only queues the GPU work
//   gpuMs    GPU time from a timer query, the one to trust when comparing rendering
//            changes. Null where the browser has no timer query.
//   frameMs  cpuMs plus waiting for a pixel read back, so it includes the trip
//            through the browser's GPU process. On a fast GPU that trip dominates
//            (about 4 ms on both Low and High on an RTX 5070 Ti), so it can't rank light work.

const WARMUP = 300; // frames walking the whole path first, while shaders, caches and GPU clocks settle
const QUERY_WAIT = 2000; // ms to wait for the last timer queries

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

const round = (v) => Math.round(v * 100) / 100;

// Avg, P50 and P95 under the given prefix, or nulls if nothing was measured.
function summarise(prefix, list) {
  const sorted = [...list].sort((a, b) => a - b);
  const n = list.length;
  return {
    [`${prefix}Avg`]: n ? round(list.reduce((a, b) => a + b, 0) / n) : null,
    [`${prefix}P50`]: n ? round(percentile(sorted, 0.5)) : null,
    [`${prefix}P95`]: n ? round(percentile(sorted, 0.95)) : null,
  };
}

export function createBench(renderer, player, bounds, total) {
  const startZ = bounds.walkZMax - 2, endZ = bounds.walkZMin + 2;
  const gl = renderer.getContext();
  const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const times = [], cpuTimes = [], gpuTimes = [], pending = [];
  const pixel = new Uint8Array(4);
  let frame = 0, calls = 0, triangles = 0, loadMs = 0, frameStart = 0, query = null, discarded = 0;

  renderer.info.autoReset = false; // the info must cover every pass of a frame, not just the last

  function gpuName() {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
  }

  // Timer results arrive some frames later. A disjoint event (say a clock change)
  // makes the results in flight meaningless, so those are dropped and counted.
  function collectQueries() {
    if (!timer) return;
    const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT);
    while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = pending.shift();
      if (disjoint) discarded++;
      else gpuTimes.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
    }
  }

  function publish() {
    window.__bench = {
      gpu: gpuName(),
      buffer: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`,
      frames: times.length,
      loadMs: Math.round(loadMs),
      ...summarise('gpuMs', gpuTimes),
      ...summarise('cpuMs', cpuTimes),
      ...summarise('frameMs', times),
      gpuDiscarded: discarded,
      drawCalls: Math.round(calls / times.length),
      triangles: Math.round(triangles / times.length),
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      programs: renderer.info.programs.length,
    };
  }

  // Results only become available once the page gets back to its event loop.
  function finish(deadline = performance.now() + QUERY_WAIT) {
    collectQueries();
    if (pending.length && performance.now() < deadline) setTimeout(finish, 20, deadline);
    else publish();
  }

  return {
    get done() { return frame >= WARMUP + total; },
    // The page is ready to play: everything up to here counts as load time.
    loaded() { loadMs = performance.now(); },
    // Before rendering: place the camera and start the clocks.
    begin() {
      collectQueries();
      frameStart = performance.now();
      const f = frame < WARMUP ? frame / WARMUP : (frame - WARMUP) / total;
      player.pos.set(Math.sin(f * Math.PI * 6) * 0.8, startZ + (endZ - startZ) * f);
      player.yaw = Math.sin(f * Math.PI * 10) * 0.5;
      player.pitch = 0.05;
      renderer.info.reset();
      if (timer && frame >= WARMUP) {
        query = gl.createQuery();
        gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
      }
    },
    // After rendering: stop the clocks and count what the frame drew. GPU work is
    // queued, so without reading a pixel back this would only time the submission.
    end() {
      if (query) {
        gl.endQuery(timer.TIME_ELAPSED_EXT);
        pending.push(query);
        query = null;
      }
      const cpuEnd = performance.now();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      if (frame >= WARMUP) {
        times.push(performance.now() - frameStart);
        cpuTimes.push(cpuEnd - frameStart);
        calls += renderer.info.render.calls;
        triangles += renderer.info.render.triangles;
      }
      frame++;
      window.__benchFrame = frame; // lets the script tell a slow run from a stalled one
      if (this.done) finish();
    },
  };
}
