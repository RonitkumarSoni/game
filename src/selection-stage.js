import * as THREE from 'three';

// A dedicated, low-resolution 3D showroom. It exists only while pilot select is
// visible, so gameplay never pays for a second WebGL renderer.
export class SelectionStage {
  constructor(host, createModel) {
    this.host = host;
    this.createModel = createModel;
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    this.camera.position.set(3.6, 2.55, 4.3);
    this.camera.lookAt(0, 1.1, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    host.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xbcefff, 0x1c3355, 1.45));
    const key = new THREE.DirectionalLight(0xe9faff, 2.4);
    key.position.set(4, 8, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6e59ff, 1.65);
    rim.position.set(-4, 4, -5);
    this.scene.add(rim);

    this.turntable = new THREE.Group();
    this.turntable.scale.setScalar(1.18);
    this.scene.add(this.turntable);
    this.podium = new THREE.Mesh(
      new THREE.CylinderGeometry(3.1, 3.4, 0.35, 32),
      new THREE.MeshStandardMaterial({ color: 0x173856, metalness: 0.7, roughness: 0.35 }),
    );
    this.podium.position.y = -0.2;
    this.scene.add(this.podium);
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.8, 0.055, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x24dfff }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.01;
    this.scene.add(this.ring);
    this.model = null;
    this.lastFrame = 0;
    this.running = true;
    this.frame = (stamp) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(this.frame);
      if (stamp - this.lastFrame < 32) return;
      const dt = Math.min((stamp - this.lastFrame) / 1000 || 0, 0.1);
      this.lastFrame = stamp;
      const width = Math.max(1, this.host.clientWidth);
      const height = Math.max(1, this.host.clientHeight);
      if (this.width !== width || this.height !== height) {
        this.width = width; this.height = height;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
      }
      this.turntable.rotation.y += dt * 0.42;
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(this.frame);
  }

  setPilot(character, vehicle = null) {
    if (this.model) {
      this.turntable.remove(this.model.root);
      this.model.dispose?.();
    }
    this.model = this.createModel(character, vehicle);
    if (!this.model?.root) return;
    this.turntable.add(this.model.root);
    this.turntable.rotation.y = -0.35;
    this.ring.material.color.setHex(character.color);
  }

  captureKart(character, vehicle) {
    this.setPilot(character, vehicle);
    const oldPos = this.camera.position.clone();
    const oldAspect = this.camera.aspect;
    const oldWidth = this.width || this.host.clientWidth || 400;
    const oldHeight = this.height || this.host.clientHeight || 240;
    this.podium.visible = false;
    this.ring.visible = false;
    this.camera.position.set(2.3, 1.85, 2.75);
    this.camera.lookAt(0, 0.72, 0);
    this.camera.aspect = 1.45;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(420, 290, false);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.renderer.setSize(oldWidth, oldHeight, false);
    this.camera.position.copy(oldPos);
    this.camera.lookAt(0, 1.1, 0);
    this.camera.aspect = oldAspect;
    this.camera.updateProjectionMatrix();
    this.podium.visible = true;
    this.ring.visible = true;
    this.width = 0;
    return url;
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.model) this.model.dispose?.();
    this.podium.geometry.dispose(); this.podium.material.dispose();
    this.ring.geometry.dispose(); this.ring.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.model = null;
  }
}
