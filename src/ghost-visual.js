import * as THREE from 'three';
import { sampleGhost } from './ghost.js';

// A separate scene object: replay cannot affect collisions, lap checks or kart physics.
export class GhostVisual {
  constructor(scene, recording) {
    this.recording = recording;
    this.enabled = true;
    this.root = new THREE.Group();
    this.root.visible = false;
    this.parts = [];
    const body = new THREE.MeshBasicMaterial({ color: 0x39e8ff, transparent: true, opacity: 0.36, depthWrite: false });
    const accent = new THREE.MeshBasicMaterial({ color: 0xa66bff, transparent: true, opacity: 0.48, depthWrite: false });
    const add = (geometry, material, x, y, z) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      this.root.add(mesh);
      this.parts.push(mesh);
      return mesh;
    };
    add(new THREE.BoxGeometry(1.7, 0.42, 2.8), body, 0, 0.48, 0);
    add(new THREE.BoxGeometry(1.2, 0.55, 1.1), accent, 0, 0.91, -0.1);
    add(new THREE.BoxGeometry(1.9, 0.13, 0.3), accent, 0, 0.93, -1.18);
    for (const x of [-0.94, 0.94]) for (const z of [-0.86, 0.86]) {
      const wheel = add(new THREE.CylinderGeometry(0.34, 0.34, 0.21, 10), accent, x, 0.31, z);
      wheel.rotation.z = Math.PI / 2;
    }
    scene.add(this.root);
  }

  update(time) {
    const pose = this.enabled ? sampleGhost(this.recording, time) : null;
    this.root.visible = !!pose;
    if (!pose) return;
    this.root.position.set(pose.x, pose.y, pose.z);
    this.root.rotation.y = pose.heading;
  }

  setEnabled(enabled) { this.enabled = !!enabled; this.root.visible = this.enabled && this.root.visible; }

  dispose() {
    this.root.parent?.remove(this.root);
    for (const part of this.parts) part.geometry.dispose();
    const materials = new Set(this.parts.map((part) => part.material));
    for (const material of materials) material.dispose();
    this.parts.length = 0;
  }
}
