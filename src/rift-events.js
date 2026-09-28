// Dynamic, clearly telegraphed race event. A Rift Lane appears before activation and rewards
// racers who move onto the announced side of the road instead of following one static line.
import * as THREE from 'three';
import { bus } from './events.js';

const wrapDelta = (a, b) => { let d = a - b; d -= Math.round(d); return d; };

export class RiftEventManager {
  constructor({ scene, track, karts, random = Math.random, enabled = true }) {
    this.scene = scene;
    this.track = track;
    this.karts = karts || [];
    this.random = typeof random === 'function' ? random : Math.random;
    this.enabled = enabled;
    this.phase = 'idle';
    this.nextAt = 16;
    this.phaseTime = 0;
    this.zoneT = 0.25;
    this.zoneSide = 1;
    this.cooldowns = new WeakMap();
    this.group = new THREE.Group();
    this.group.name = 'RiftShiftEvent';
    this.group.visible = false;
    scene?.add(this.group);
    this.material = new THREE.MeshStandardMaterial({ color: 0xff35e8, emissive: 0xff00cc, emissiveIntensity: 2.2, transparent: true, opacity: 0.5, depthWrite: false });
    this.geometry = new THREE.BoxGeometry(3.8, 0.08, 5.2);
    for (let i = -2; i <= 2; i++) {
      const mesh = new THREE.Mesh(this.geometry, this.material);
      mesh.userData.offset = i * 0.007;
      this.group.add(mesh);
    }
  }

  _chooseZone() {
    const points = [0.18, 0.34, 0.53, 0.72, 0.87];
    this.zoneT = points[Math.floor(this.random() * points.length)];
    this.zoneSide = this.random() < 0.5 ? -1 : 1;
    const lateral = this.zoneSide * (this.track.roadWidth || 24) * 0.22;
    for (const mesh of this.group.children) {
      const t = (this.zoneT + mesh.userData.offset + 1) % 1;
      const p = this.track.getPointAt(t);
      const tan = this.track.getTangentAt(t);
      mesh.position.set(p.x - tan.z * lateral, p.y + 0.09, p.z + tan.x * lateral);
      mesh.rotation.y = Math.atan2(tan.x, tan.z);
    }
  }

  update(dt, raceTime, racePhase) {
    if (!this.enabled || racePhase !== 'racing') return;
    if (this.phase === 'idle' && raceTime >= this.nextAt) {
      this._chooseZone();
      this.phase = 'warning'; this.phaseTime = 4; this.group.visible = true;
      bus.emit('rift:warning', { side: this.zoneSide < 0 ? 'RIGHT' : 'LEFT', seconds: 4 });
    } else if (this.phase === 'warning') {
      this.phaseTime -= dt;
      this.material.opacity = 0.25 + Math.sin(raceTime * 12) * 0.12;
      this.material.color.setHex(0xff35e8); this.material.emissive.setHex(0xff00cc);
      if (this.phaseTime <= 0) {
        this.phase = 'active'; this.phaseTime = 8;
        bus.emit('rift:start', { side: this.zoneSide < 0 ? 'RIGHT' : 'LEFT' });
      }
    } else if (this.phase === 'active') {
      this.phaseTime -= dt;
      this.material.opacity = 0.68 + Math.sin(raceTime * 9) * 0.12;
      this.material.color.setHex(0x00f5ff); this.material.emissive.setHex(0x00d9ff);
      for (const kart of this.karts) {
        if (!kart || kart.finished) continue;
        const along = Math.abs(wrapDelta(kart.trackT || 0, this.zoneT));
        const targetLat = this.zoneSide * (this.track.roadWidth || 24) * 0.22;
        if (along < 0.025 && Math.abs((kart.lateral || 0) - targetLat) < 3.2) {
          const cd = this.cooldowns.get(kart) || 0;
          if (raceTime >= cd) {
            kart.applyBoost?.(0.8, 0.9, 'riftLane');
            this.cooldowns.set(kart, raceTime + 1.2);
            if (kart.isPlayer) bus.emit('rift:hit', {});
          }
        }
      }
      if (this.phaseTime <= 0) {
        this.phase = 'idle'; this.group.visible = false;
        this.nextAt = raceTime + 18 + this.random() * 9;
        bus.emit('rift:end', {});
      }
    }
  }

  dispose() {
    this.scene?.remove(this.group);
    this.geometry.dispose();
    this.material.dispose();
    this.group.clear();
  }
}

