// Planar reflection of the scene in the ground plane y = 0, drawn into a render target
// with mipmaps so the wet ground can blur it by roughness (see ground.js).
import * as THREE from 'three';

export class PlanarReflection {
  constructor(scale) {
    this.scale = scale;
    this.rt = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.cam = new THREE.PerspectiveCamera();
    this.matrix = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._u = new THREE.Vector3();
    this._r = new THREE.Matrix4();
  }

  setSize(w, h) {
    this.rt.setSize(Math.max(2, Math.floor(w * this.scale)), Math.max(2, Math.floor(h * this.scale)));
  }

  update(renderer, scene, camera, hide) {
    const cam = this.cam;
    camera.updateMatrixWorld();
    const cp = this._p.setFromMatrixPosition(camera.matrixWorld);
    this._r.extractRotation(camera.matrixWorld);
    const look = this._t.set(0, 0, -1).applyMatrix4(this._r).add(cp);
    const up = this._u.set(0, 1, 0).applyMatrix4(this._r);
    // mirror across the ground plane y = 0
    cam.position.set(cp.x, -cp.y, cp.z);
    look.y = -look.y;
    up.y = -up.y;
    cam.up.copy(up);
    cam.lookAt(look);
    cam.near = camera.near;
    cam.far = camera.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);
    cam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.matrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);

    for (const o of hide) o.visible = false;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.setRenderTarget(prev);
    for (const o of hide) o.visible = true;
  }
}
