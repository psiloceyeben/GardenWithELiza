import * as THREE from "three";
import { WorldState, type WorldView } from "../game/WorldState";
import { Atlases } from "./Atlases";
import { createGround, disposeGroup } from "./Ground";
import { TILE, VILLAGE_W, VILLAGE_H, lotGatePx } from "@shared/world";
import { GROW_MS } from "@shared/economy";
import { npcById } from "@shared/missions";
import { COPY } from "../content";
import { sfx } from "../audio";
import { unobstructedCamera } from './camera-obstruction';
import { VisualAvatar, type AvatarAppearance } from './visual-avatar';
import { npcAppearance } from './npc-appearance';
import { plantModel, hasPlantModel, stylePlant, animatePlant, disposePlant } from './plant-model';
import type { MutationId } from '@shared/types';
import type { CarryAppearance } from '@shared/protocol';
import { buildingModel } from './building-model';
import { plazaModel, updatePlazaModel } from './plaza-model';
import { treeModel } from './tree-model';
import { layoutLabels } from './label-layout';
import { decorModel } from './decor-model';
import { defenseModel } from './defense-model';
import { gateKind, gateModel } from './gate-model';
import { gnomePatrol } from '@shared/gnome-patrol';
import { gateDecorLayout } from './gate-decor-layout';
import { viewMode } from '../view-mode';

interface Actor {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  frame: string;
  seen: boolean;
}
interface Label {
  el: HTMLDivElement;
  seen: boolean;
  x:number;
  y:number;
}
/** HD-2D view. Simulation stays in pixels; (x,y) maps to Three (x/32,0,y/32). */
export class Renderer3D implements WorldView {
  readonly renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
  });
  readonly scene = new THREE.Scene();
  readonly perspective = viewMode(location.search).perspective;
  private localAvatar: VisualAvatar | null = null;
  private createAvatar: ((appearance?:Partial<AvatarAppearance>) => VisualAvatar) | null = null;
  private remoteAvatars = new Map<string, VisualAvatar>();
  private npcAvatars = new Map<string, VisualAvatar>();
  private plantModels = new Map<string,{root:THREE.Group;key:string;seen:boolean}>();
  private treeModels = new Map<string,{root:THREE.Group;stage:number;seen:boolean}>();
  private decorModels = new Map<string,{root:THREE.Group;kind:string;seen:boolean}>();
  readonly camera: THREE.OrthographicCamera | THREE.PerspectiveCamera = this.perspective
    ? new THREE.PerspectiveCamera(60, 1, 0.1, 600)
    : new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 400);
  private pitch = 0.7;
  private orbitPointer: number | null = null;
  private orbitLast = { x:0, y:0 };
  private orbitTouch = false;
  private orbitDragged = false;
  readonly atlases = new Atlases();
  readonly state = new WorldState(this);
  private actors = new Map<string, Actor>();
  private labels = new Map<string, Label>();
  private remotePositions = new Map<string, { x: number; y: number }>();
  private firstSeen = new Map<string, number>();
  private frameDelta = 0;
  private overlay = document.createElement("div");
  private ground: THREE.Group | null = null;
  private buildings: THREE.Group | null = null;
  private cameraSolids: THREE.Box3[] = [];
  private modeledBuildings = new Set<string>();
  private plazaModels = new Map<string,THREE.Group>();
  private revision = -1;
  private keys = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private target = new THREE.Vector3();
  private focus = new THREE.Vector3();
  private last = 0;
  private animation = 0;
  private readonly reducedPlantMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private abort = new AbortController();
  private sun = new THREE.DirectionalLight(0xffe8cb, 1.1);
  private ambient = new THREE.HemisphereLight(0xcddcf0, 0x544657, 2.1);
  private marker = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.47, 4),
    new THREE.MeshBasicMaterial({
      color: 0xffdf89,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  private effects: { x: number; y: number; until: number }[] = [];
  private shakeUntil = 0;
  private width = 0;
  private height = 0;
  private graphicsLost = false;
  private graphicsNotice: HTMLDivElement | null = null;
  async start(): Promise<void> {
    await this.atlases.load();
    if (viewMode(location.search).wander) {
      const { PlayerAvatar, DEFAULT_CUSTOM } = await import('./vendor/WanderAvatar.js');
      this.createAvatar = (appearance = {}) => new VisualAvatar((state, options) => new PlayerAvatar(state, options),
        { ...DEFAULT_CUSTOM, preset: 'wanderer', ...appearance });
      this.localAvatar = this.createAvatar();
      this.localAvatar.root.name = 'pons-local-wander-avatar';
      this.localAvatar.root.visible = false;
      this.scene.add(this.localAvatar.root);
    }
    const canvas = this.renderer.domElement;
    canvas.setAttribute("aria-label", "Pons Garden");
    canvas.tabIndex = 0;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    this.state.inputYaw = Math.atan2(38, 58);
    document.getElementById("game")!.append(canvas);
    this.overlay.style.cssText =
      "position:absolute;inset:0;pointer-events:none;overflow:hidden";
    document.getElementById("game")!.append(this.overlay);
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(this.perspective ? 0x99b9bc : 0x181220);
    this.sun.position.set(-30, 60, 25);
    this.scene.add(this.ambient, this.sun);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.rotation.z = Math.PI / 4;
    this.marker.visible = false;
    this.scene.add(this.marker);
    const options = { signal: this.abort.signal };
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault(); // Permit the browser/Three to restore GPU resources.
      this.graphicsLost = true;
      this.keys.clear(); this.state.joy = { x: 0, y: 0 };
      this.state.path = []; this.state.pathAct = null; this.state.moving = false;
      cancelAnimationFrame(this.animation);
      if (!this.graphicsNotice) {
        const notice = document.createElement('div'); notice.id = 'graphics-recovery';
        notice.setAttribute('role', 'alert');
        notice.style.cssText = 'position:fixed;inset:0;z-index:30;background:#181220ee;display:grid;place-content:center;gap:20px;padding:24px;text-align:center;line-height:2';
        const message = document.createElement('p'); message.textContent = COPY.graphicsLost;
        const reload = document.createElement('button'); reload.textContent = COPY.graphicsReload;
        reload.addEventListener('click', () => location.reload(), options);
        notice.append(message, reload); document.body.append(notice);
        this.graphicsNotice = notice; reload.focus();
      }
    }, options);
    canvas.addEventListener('webglcontextrestored', () => {
      if (!this.graphicsLost) return;
      this.graphicsLost = false; this.last = 0;
      this.animation = requestAnimationFrame((t) => this.frame(t));
    }, options);
    window.addEventListener(
      "keydown",
      (e) => {
        if (this.editing()) return;
        const k = e.key.toLowerCase();
        if (
          [
            "w",
            "a",
            "s",
            "d",
            "arrowup",
            "arrowdown",
            "arrowleft",
            "arrowright",
            " ",
          ].includes(k)
        )
          e.preventDefault();
        this.keys.add(k);
        sfx.unlock();
        if (!e.repeat && (k === "e" || k === " ")) this.state.interactNearest();
        if (!e.repeat && k === "z") this.state.toggleZoom();
      },
      options,
    );
    window.addEventListener(
      "keyup",
      (e) => this.keys.delete(e.key.toLowerCase()),
      options,
    );
    window.addEventListener(
      "blur",
      () => {
        this.keys.clear();
        this.state.joy = { x: 0, y: 0 };
        this.orbitPointer = null;
      },
      options,
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        this.keys.clear();
        this.last = 0;
        this.orbitPointer = null;
      },
      options,
    );
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (this.orbitPointer !== null) return;
        if (this.perspective && (e.button === 2 || e.pointerType === 'touch')) {
          if (!this.state.ready || this.graphicsLost) return;
          e.preventDefault(); this.orbitPointer = e.pointerId;
          this.orbitTouch = e.pointerType === 'touch'; this.orbitDragged = false;
          this.orbitLast = { x:e.clientX, y:e.clientY }; canvas.setPointerCapture(e.pointerId); return;
        }
        if (e.button !== 0) return;
        canvas.focus();
        sfx.unlock();
        if (!this.state.ready) return;
        this.tapGround(e.clientX,e.clientY);
      },
      options,
    );
    canvas.addEventListener('contextmenu', e => { if (this.perspective) e.preventDefault(); }, options);
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== this.orbitPointer) return;
      if (this.orbitTouch && !this.orbitDragged && Math.hypot(e.clientX-this.orbitLast.x,e.clientY-this.orbitLast.y) < 8) return;
      this.orbitDragged = true;
      this.state.inputYaw -= (e.clientX-this.orbitLast.x)*0.006;
      this.pitch = THREE.MathUtils.clamp(this.pitch+(e.clientY-this.orbitLast.y)*0.004,0.25,1.3);
      this.orbitLast = { x:e.clientX,y:e.clientY };
    }, options);
    const endOrbit = (e:PointerEvent) => {
      if (e.pointerId !== this.orbitPointer) return;
      this.orbitPointer = null;
      if (e.type === 'pointerup' && this.orbitTouch && !this.orbitDragged) {
        canvas.focus(); sfx.unlock(); this.tapGround(e.clientX,e.clientY);
      }
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener('pointerup',endOrbit,options);
    canvas.addEventListener('pointercancel',endOrbit,options);
    canvas.addEventListener('lostpointercapture',endOrbit,options);
    window.addEventListener("pagehide", () => this.dispose(), {
      once: true,
      signal: this.abort.signal,
    });
    (window as unknown as { pons: WorldState; pons3d: Renderer3D }).pons =
      this.state;
    (window as unknown as { pons3d: Renderer3D }).pons3d = this;
    this.state.start();
    this.animation = requestAnimationFrame((t) => this.frame(t));
  }
  private editing(): boolean {
    return (
      this.graphicsLost || !!document.activeElement?.matches(
        "input,textarea,[contenteditable=true]",
      ) || !document.getElementById("name-modal")!.hidden
    );
  }
  private tapGround(x:number,y:number): void {
    if (!this.state.ready || this.graphicsLost) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(
      ((x-rect.left)/rect.width)*2-1, -((y-rect.top)/rect.height)*2+1,
    ),this.camera);
    if (this.raycaster.ray.intersectPlane(this.plane,this.target)) this.state.onTap(this.target.x*TILE,this.target.z*TILE);
  }
  frameRect(name: string): { x: number; y: number } {
    return this.atlases.frameRect(name);
  }
  effect(kind: string, x: number, y: number): void {
    if (kind === "scream") {
      this.shakeUntil = performance.now() + 200;
      sfx.scream();
    } else this.effects.push({ x, y, until: performance.now() + 650 });
  }
  private sprite(
    id: string,
    sheet: string,
    frame: string,
    x: number,
    y: number,
    height = 0,
    scale = 1,
    flip = false,
    tint = 0xffffff,
  ): Actor {
    let a = this.actors.get(id);
    const f = this.atlases.get(sheet, frame);
    if (!a) {
      a = {
        mesh: new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            map: f.texture,
            alphaTest: 0.5,
            side: THREE.DoubleSide,
          }),
        ),
        frame: "",
        seen: true,
      };
      this.actors.set(id, a);
      this.scene.add(a.mesh);
    }
    if (a.frame !== sheet + ":" + frame) {
      a.mesh.material.map = f.texture;
      a.frame = sheet + ":" + frame;
    }
    a.seen = true;
    a.mesh.material.color.setHex(tint);
    a.mesh.scale.set(
      (f.frame.w / TILE) * scale * (flip ? -1 : 1),
      (f.frame.h / TILE) * scale,
      1,
    );
    // Keep the original bottom anchor while making the atlas quad camera-facing.
    a.mesh.quaternion.copy(this.camera.quaternion);
    const up = new THREE.Vector3(
      0,
      (f.frame.h / TILE) * scale * 0.5,
      0,
    ).applyQuaternion(this.camera.quaternion);
    a.mesh.position.set(x / TILE, height, y / TILE).add(up);
    return a;
  }
  private label(
    id: string,
    text: string,
    x: number,
    y: number,
    height: number,
    color = "#f0e8d2",
  ): void {
    let label = this.labels.get(id);
    if (!label) {
      const el = document.createElement("div");
      el.style.cssText =
        "position:absolute;transform:translate(-50%,-100%);font-size:8px;line-height:1.6;text-align:center;text-shadow:1px 1px #181220,-1px -1px #181220;max-width:190px";
      this.overlay.append(el);
      label = { el, seen: true, x:0, y:0 };
      this.labels.set(id, label);
    }
    label.seen = true;
    if (label.el.textContent !== text) label.el.textContent = text;
    label.el.style.color = color;
    const p = new THREE.Vector3(x / TILE, height, y / TILE).project(
      this.camera,
    );
    label.el.hidden =
      this.state.zoomLevel === 2 ||
      Math.abs(p.x) > 1.15 ||
      Math.abs(p.y) > 1.15 ||
      Math.abs(p.z) > 1;
    label.x=((p.x + 1) / 2) * this.width;
    label.y=((-p.y + 1) / 2) * this.height;
    label.el.style.left = label.x + "px";
    label.el.style.top = label.y + "px";
  }
  private rebuild(): void {
    if (this.ground) disposeGroup(this.ground);
    this.ground = createGround(this.state, this.atlases.ground,!!this.createAvatar);
    this.scene.add(this.ground);
    if (this.buildings) disposeGroup(this.buildings);
    this.buildings = new THREE.Group();
    this.scene.add(this.buildings);
    this.cameraSolids = [];
    this.modeledBuildings.clear();
    for (const p of this.state.village!.props)
      if (p.kind.startsWith("bld_")) {
        const model=this.createAvatar ? buildingModel(p.kind.slice(4),p.w,p.h) : null;
        if(model) {
          model.position.set(p.tx+p.w/2,0,p.ty+p.h/2);
          this.buildings.add(model);model.updateMatrixWorld(true);
          this.cameraSolids.push(new THREE.Box3().setFromObject(model));
          this.modeledBuildings.add(p.kind);continue;
        }
        const f = this.atlases.get("town", p.kind).frame;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(p.w * 0.78, (f.h / TILE) * 0.6, p.h * 0.65),
          new THREE.MeshLambertMaterial({ color: 0x65516b }),
        );
        box.position.set(p.tx + p.w / 2, (f.h / TILE) * 0.3, p.ty + p.h * 0.5);
        this.buildings.add(box);
        box.updateMatrixWorld(true);
        this.cameraSolids.push(new THREE.Box3().setFromObject(box));
      }
    for(const model of this.plazaModels.values())disposeGroup(model);
    this.plazaModels.clear();
    if(this.createAvatar)for(const [i,p] of this.state.village!.props.entries()) {
      const model=plazaModel(p.kind);if(!model)continue;
      model.position.set(p.tx+p.w/2,0,p.ty+p.h/2);this.scene.add(model);
      this.plazaModels.set('prop'+i,model);model.updateMatrixWorld(true);
      if(p.solid)this.cameraSolids.push(new THREE.Box3().setFromObject(model));
    }
    this.revision = this.state.revision;
  }
  private frame(time: number): void {
    if (this.graphicsLost) return;
    const dt = this.last ? Math.min(0.05, (time - this.last) / 1000) : 0;
    this.frameDelta = dt;
    this.last = time;
    const key = (...ks: string[]) => (ks.some((k) => this.keys.has(k)) ? 1 : 0);
    if (this.perspective && !this.editing()) this.state.inputYaw += (key('q')-key('r'))*dt*1.5;
    const input = this.editing()
      ? { x: 0, y: 0 }
      : {
          x: key("d", "arrowright") - key("a", "arrowleft"),
          y: key("s", "arrowdown") - key("w", "arrowup"),
        };
    this.state.tick(dt, input);
    const rect = this.renderer.domElement.getBoundingClientRect(),
      width = Math.round(rect.width),
      height = Math.round(rect.height);
    if (width !== this.width || height !== this.height) {
      this.width = width;
      this.height = height;
      this.renderer.setSize(
        Math.max(1, Math.round(width / 2)),
        Math.max(1, Math.round(height / 2)),
        false,
      );
    }
    if (this.state.ready && this.state.village && this.state.you) {
      if (this.revision !== this.state.revision) this.rebuild();
      const whole = this.state.zoomLevel === 2;
      const desired = new THREE.Vector3(
        whole ? VILLAGE_W / 2 : this.state.player.x / TILE,
        0,
        whole ? VILLAGE_H / 2 : this.state.player.y / TILE,
      );
      if (this.focus.lengthSq() === 0 || whole) this.focus.copy(desired);
      else this.focus.lerp(desired, 1 - Math.exp(-8 * dt));
      const aspect = width / Math.max(1, height),
        angle = this.state.inputYaw;
      const span = whole
        ? Math.max(
            (VILLAGE_H * Math.cos(angle) + VILLAGE_W * Math.sin(angle)) * 0.8,
            (VILLAGE_W * Math.cos(angle) + VILLAGE_H * Math.sin(angle)) /
              aspect,
          ) * 1.12
        : this.state.zoomLevel === 1
          ? 32
          : 18;
      if (this.camera instanceof THREE.OrthographicCamera) {
      this.camera.left = (-span * aspect) / 2;
      this.camera.right = (span * aspect) / 2;
      this.camera.top = span / 2;
      this.camera.bottom = -span / 2;
      this.camera.position.copy(this.focus).add(new THREE.Vector3(38, 80, 58));
      } else {
        this.camera.aspect = aspect;
        const distance = whole ? Math.max(VILLAGE_W,VILLAGE_H)*1.3/Math.min(1,aspect) : this.state.zoomLevel === 1 ? 28 : 15;
        this.camera.position.copy(this.focus).add(new THREE.Vector3(
          Math.sin(angle)*Math.cos(this.pitch)*distance,
          Math.sin(this.pitch)*distance,
          Math.cos(angle)*Math.cos(this.pitch)*distance,
        ));
      }
      if (time < this.shakeUntil)
        this.camera.position.x += Math.sin(time) * 0.1;
      if (this.perspective) this.camera.position.copy(unobstructedCamera(this.focus,this.camera.position,this.cameraSolids));
      this.camera.lookAt(this.focus);
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();
      const night = Math.max(
        0,
        -Math.cos(((((Date.now() / 3600000) % 24) - 12) / 12) * Math.PI),
      );
      this.ambient.intensity = 2.1 - night * 0.6;
      this.sun.intensity = 1.1 - night * 0.6;
      for (const a of this.actors.values()) a.seen = false;
      for (const l of this.labels.values()) l.seen = false;
      for (const p of this.plantModels.values()) p.seen = false;
      for (const p of this.treeModels.values()) p.seen = false;
      for (const p of this.decorModels.values()) p.seen = false;
      this.drawWorld(time, night);
      for (const [id,p] of this.plantModels) if(!p.seen) {
        disposePlant(p.root);this.plantModels.delete(id);this.firstSeen.delete(id);
      }
      for(const [id,p] of this.treeModels)if(!p.seen){disposeGroup(p.root);this.treeModels.delete(id);}
      for(const [id,p] of this.decorModels)if(!p.seen){disposeGroup(p.root);this.decorModels.delete(id);}
      for (const [id, a] of this.actors)
        if (!a.seen) {
          a.mesh.removeFromParent();
          a.mesh.geometry.dispose();
          a.mesh.material.dispose();
          this.actors.delete(id);
          this.firstSeen.delete(id);
        }
      for (const [id, l] of this.labels)
        if (!l.seen) {
          l.el.remove();
          this.labels.delete(id);
        }
    }
    if(this.perspective){
      const boxes=[...this.labels].filter(([,l])=>l.seen&&!l.el.hidden).map(([id,l])=>({id,x:l.x,y:l.y,width:l.el.offsetWidth,height:l.el.offsetHeight}));
      for(const [id,p] of layoutLabels(boxes,this.width)){
        const el=this.labels.get(id)!.el;el.hidden=p.hidden;el.style.left=p.x+'px';el.style.top=p.y+'px';
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.graphicsNotice?.remove(); this.graphicsNotice = null;
    this.animation = requestAnimationFrame((t) => this.frame(t));
  }
  private drawWorld(time: number, night: number): void {
    const s = this.state,
      v = s.village!,
      you = s.you!,
      anim = Math.floor(time / 166) % 2;
    const seenNpcs = new Set<string>();
    const drawNpc = (key:string, role:string, x:number, y:number):boolean => {
      const style = npcAppearance(role);
      if (!this.createAvatar || !style) return false;
      let avatar = this.npcAvatars.get(key);
      if (avatar && avatar.root.name !== 'pons-npc-' + role) {
        avatar.dispose(); this.npcAvatars.delete(key); avatar = undefined;
      }
      if (!avatar) {
        avatar = this.createAvatar(style.appearance);
        avatar.setHeadwear('straw',style.hatTint);
        avatar.root.name = 'pons-npc-' + role;
        this.npcAvatars.set(key,avatar); this.scene.add(avatar.root);
      }
      seenNpcs.add(key);avatar.root.position.set(x/TILE,0,y/TILE);
      avatar.animate(time/1000,false);return true;
    };
    for (const [i, p] of v.props.entries()) {
      const x = p.tx * TILE + (p.w * TILE) / 2,
        y = (p.ty + p.h) * TILE,
        id = "prop" + i;
      const plaza=this.plazaModels.get(id);
      if(plaza) {updatePlazaModel(plaza,night);continue;}
      if (p.kind.startsWith("tree")) this.drawTree(id,Number(p.kind.slice(4)),x,y);
      else if (p.kind.startsWith("bld_")) {if(!this.modeledBuildings.has(p.kind))this.sprite(id, "town", p.kind, x, y);}
      else if (p.kind.startsWith("npc_")) {
        const modeled = drawNpc(id,p.kind.slice(4),x,y);
        if (!modeled) this.sprite(id, "chars", p.kind + (Math.floor(time / 500) % 2), x, y);
        this.label(
          id,
          npcById(p.kind.slice(4))?.name ?? "",
          x,
          y,
          modeled ? 2.1 : 1.25,
          "#ffe28a",
        );
        const b = s.bubbles.get(p.kind);
        if (b) this.label(id + "bubble", b.text, x, y, modeled ? 2.6 : 1.8);
      } else
        this.sprite(
          id,
          "plaza",
          p.kind === "fountain"
            ? "fountain" + anim
            : p.kind === "lamp"
              ? "lamp" + (night > 0.3 ? 1 : 0)
              : p.kind,
          x,
          y,
          0,
          p.kind === "track" ? 1 : 1,
        );
    }
    if (!drawNpc('seller','seller',v.conveyor.tx*TILE+48,v.conveyor.ty*TILE+30)) this.sprite(
      "seller",
      "chars",
      "npc" + (Math.floor(time / 500) % 2),
      v.conveyor.tx * TILE + 48,
      v.conveyor.ty * TILE + 30,
    );
    for (const [id,avatar] of this.npcAvatars) if (!seenNpcs.has(id)) {
      avatar.dispose();this.npcAvatars.delete(id);
    }
    for (const { lot: l, geo: g } of s.lots.values()) {
      const gate = lotGatePx(g),
        mine = l.ownerId === you.id;
      const gateState=gateKind(l.defenses.gateHp,l.defenses.gateMax);
      if(this.createAvatar && gateState){
        const id='gate'+l.ownerId;
        this.drawDecor(id,'props',gateState,gate.x,gate.y);
        const model=this.decorModels.get(id);
        if(model)model.root.rotation.y=g.gateSide==='left'||g.gateSide==='right'?Math.PI/2:0;
      }
      this.label(
        "lot" + l.ownerId,
        (mine ? COPY.yourLot : l.name) +
          (l.shielded ? " (" + COPY.shielded + ")" : ""),
        gate.x,
        gate.y,
        0.6,
        mine ? "#ffe28a" : "#d8e7f2",
      );
      for (const p of l.plots) {
        const pos = g.plots[p.i],
          id = l.ownerId + ":" + p.i;
        const plant = mine ? you.plots[p.i] : null;
        if (!this.firstSeen.has(id)) this.firstSeen.set(id, Date.now());
        const growth = plant
          ? Math.min(
              3,
              Math.floor(((Date.now() - plant.plantedAt) / plant.growMs) * 4),
            )
          : Math.min(3, Math.floor(((Date.now() - this.firstSeen.get(id)!) / GROW_MS[p.tier]) * 4));
        const frame =
          p.speciesId +
          (p.revealed
            ? "_idle" + (Math.floor(time / 166) % 6)
            : "_grow" + growth);
        let tint = 0xffffff;
        if (p.mutation === "golden") tint = 0xffe28a;
        if (p.mutation === "holographic")
          tint = new THREE.Color()
            .setHSL((time / 20000) % 1, 0.45, 0.75)
            .getHex();
        const dx = p.mutation === "feral" ? Math.sin(time / 700) * 7 : 0;
        const x = pos.tx * TILE + 16 + dx,
          y = pos.ty * TILE + 28;
        if (!this.drawPlant(id,p.speciesId,p.revealed?4:growth,x,y,0,p.mutation,time,undefined,p.size)) {
        const a = this.sprite(
          id,
          "plants",
          frame,
          x,
          y,
          0,
          p.mutation === "colossal" ? 1.5 : 1,
          false,
          tint,
        );
        if (p.mutation === "backwards") {
          a.mesh.scale.y *= -1;
        }
        }
        if (p.weedy) {
          if(this.createAvatar)this.drawDecor(id+'weed','plaza','weeds',pos.tx*TILE+16,y);
          else this.sprite(id + "weed", "plaza", "weeds", x, y, 0.04);
        }
        if (p.lockedUntil > Date.now())
          this.sprite(id + "lock", "ui", "lockicon", x + 11, y, 0.7, 0.6);
        if (p.mutation === "golden")
          this.sprite(
            id + "spark",
            "ui",
            "sparkle",
            x + 10,
            y,
            0.8 + Math.sin(time / 400) * 0.05,
            0.5,
          );
        if (p.mutation === "screaming" && Math.floor(time / 1000) % 8 === 0)
          this.label(id + "scream", "AAAAAA", x, y, 1.6, "#ff8080");
      }
      if (l.defenses.gnome) {
        const patrolAt=s.serverClock.now();
        const {x,y,angle:a}=gnomePatrol(g.center,patrolAt);
        if(this.createAvatar){
          const id='gnome'+l.ownerId;
          this.drawDecor(id,'chars','gnome:'+l.cosmetics.gnomeHat,x,y);
          const model=this.decorModels.get(id);if(model){model.root.rotation.y=-a;model.root.userData.patrolAt=patrolAt;}
        }else this.sprite("gnome" + l.ownerId, "chars", "gnome" + anim, x, y);
        if (!this.createAvatar && l.cosmetics.gnomeHat >= 0)
          this.sprite(
            "ghat" + l.ownerId,
            "ui",
            "ghat" + l.cosmetics.gnomeHat,
            x,
            y,
            0.8,
          );
      }
      if (l.defenses.sprinkler && this.createAvatar)
        this.drawDecor('sprinkler'+l.ownerId,'props','sprinkler',g.center.x+40,g.center.y);
      else if (l.defenses.sprinkler)
        this.sprite(
          "sprinkler" + l.ownerId,
          "props",
          "sprinkler" + anim,
          g.center.x + 40,
          g.center.y,
        );
      if (l.land.address) {
        const tx = g.gateSide === "left" ? g.x + g.w - 2 : g.x + 1,
          ty = g.gateSide === "top" ? g.y + g.h - 2 : g.y + 1;
        this.drawTree(
          "tree" + l.ownerId,
          l.land.treeStage,
          tx * TILE + 16,
          ty * TILE + 30,
        );
      }
      for (let k = 0; k < l.land.witherMarks; k++) {
        const outside =
          g.gateSide === "bottom"
            ? { tx: g.x + 1 + k * 2, ty: g.y - 1 }
            : g.gateSide === "top"
              ? { tx: g.x + 1 + k * 2, ty: g.y + g.h }
              : g.gateSide === "left"
                ? { tx: g.x + g.w, ty: g.y + 1 + k * 2 }
                : { tx: g.x - 1, ty: g.y + 1 + k * 2 };
        this.drawDecor(
          "stump" + l.ownerId + k,
          "props",
          "stump",
          outside.tx * TILE + 16,
          outside.ty * TILE + 30,
        );
      }
      for (let k = 0; k < l.land.decorFlora; k++) {
        const side = g.gateSide === "left" || g.gateSide === "right";
        this.drawDecor(
          "decor" + l.ownerId + k,
          "plaza",
          "decor" + (k % 3),
          (side ? g.x + 1 + k * 2 : g.x + g.w) * TILE + 16,
          (side ? g.y + g.h : g.y + 1 + k) * TILE + 30,
        );
      }
      const gateDecor=this.createAvatar?gateDecorLayout(gate,g.gateSide):null;
      if (l.cosmetics.lantern)
        for (const d of [-1, 1])
          this.drawDecor(
            "lamp" + l.ownerId + d,
            "plaza",
            "lamp",
            gateDecor?gateDecor.lamps[d<0?0:1].x:gate.x + d * 28,
            gateDecor?gateDecor.lamps[d<0?0:1].y:gate.y,
            0.75,
            night,
          );
      if (l.cosmetics.nameplate)
        this.drawDecor(
          "sign" + l.ownerId,
          "plaza",
          "sign",
          gateDecor?gateDecor.sign.x:gate.x + 22,
          gateDecor?gateDecor.sign.y:gate.y + 14,
        );
      if(gateDecor){const sign=this.decorModels.get('sign'+l.ownerId);if(sign)sign.root.rotation.y=gateDecor.rotation;}
    }
    const drawPlayer = (
      id: string,
      x: number,
      y: number,
      d: string,
      f: boolean,
      m: boolean,
      carry: string,
      color: number,
      hat: number,
      name: string,
      wanted = false,
      appearance?:CarryAppearance|null,
      skin=0,
      hair=0,
    ) => {
      let avatar = id === you.id ? this.localAvatar : this.remoteAvatars.get(id);
      if (!avatar && id !== you.id && this.createAvatar) {
        avatar = this.createAvatar();
        avatar.root.name = 'pons-remote-wander-avatar';
        this.remoteAvatars.set(id, avatar);
        this.scene.add(avatar.root);
      }
      if (avatar) {
        avatar.setWardrobe(color, hat, skin, hair);
        avatar.root.visible = true;
        avatar.root.position.set(x / TILE, 0, y / TILE);
        avatar.root.rotation.y = d === 'up' ? Math.PI : d === 'side' ? (f ? -Math.PI / 2 : Math.PI / 2) : 0;
        avatar.animate(time / 1000, m, 1, !!carry);
      } else this.sprite(
        "player" + id,
        "chars",
        "farmer" +
          color +
          hat +
          "_" +
          (carry && d === "down" ? "carry" : d) +
          (m ? anim : 0),
        x,
        y,
        0,
        1,
        f,
      );
      this.label(
        "name" + id,
        name,
        x,
        y,
        avatar ? 2.1 : 1.2,
        id === you.id ? "#ffe28a" : "#d8e7f2",
      );
      if (carry) {
        if (this.drawPlant('carry'+id,carry,4,x,y,1.3,appearance?.mutation ?? 'none',time,avatar?.root.rotation.y,appearance?.size ?? 1)) {
          const root = this.plantModels.get('carry'+id)!.root;
          if (avatar) avatar.carryPosition(root.position);
        } else this.sprite("carry" + id, "plants", carry + "_grow3", x, y, 0.9, 0.85);
      }
      if (wanted) this.label("wanted" + id, COPY.wanted, x, y, avatar ? 2.5 : 1.6, "#ff8080");
      const b = s.bubbles.get(id);
      if (b) this.label("bubble" + id, b.text, x, y, avatar ? 2.8 : 1.9);
    };
    drawPlayer(
      you.id,
      s.player.x,
      s.player.y,
      s.dir,
      s.flip,
      s.moving,
      s.carrying ?? "",
      you.color,
      you.hat,
      you.name,
      false,
      s.carryingAppearance,
      you.skin,
      you.hair,
    );
    for (const id of this.remotePositions.keys()) if (!s.remotes.has(id)) this.remotePositions.delete(id);
    for (const [id, avatar] of this.remoteAvatars) if (!s.remotes.has(id)) {
      avatar.dispose(); this.remoteAvatars.delete(id);
    }
    for (const p of s.remotes.values()) {
      const n = s.names.get(p.id);
      const pos = this.remotePositions.get(p.id) ?? { x: p.x, y: p.y };
      const smoothing = 1 - Math.exp(-12 * this.frameDelta);
      if (Math.hypot(p.x - pos.x, p.y - pos.y) > 128) { pos.x = p.x; pos.y = p.y; }
      else { pos.x += (p.x - pos.x) * smoothing; pos.y += (p.y - pos.y) * smoothing; }
      this.remotePositions.set(p.id, pos);
      drawPlayer(
        p.id,
        pos.x,
        pos.y,
        p.d,
        p.f,
        p.m,
        p.c,
        n?.color ?? 0,
        n?.hat ?? 0,
        n?.name ?? "?",
        p.b,
        p.cp,
        n?.skin,
        n?.hair,
      );
    }
    for (const { w } of s.wilds.values())
      if (!this.drawPlant('wild'+w.id,w.speciesId,2,w.x,w.y,.08,'none',time,undefined,.8)) this.sprite(
        "wild" + w.id,
        "plants",
        w.speciesId + "_grow2",
        w.x,
        w.y,
        0.08 + Math.sin(time / 400) * 0.04,
        0.8,
      );
    const near = s.nearestPlot();
    this.marker.visible = !!near;
    if (near) {
      this.marker.position.set(near.pos.x / TILE, 0.025, near.pos.y / TILE);
      this.marker.material.color.setHex(near.mine ? 0xffdf89 : 0xff6060);
      if (near.plot?.nick)
        this.label(
          "nick",
          near.plot.nick,
          near.pos.x,
          near.pos.y,
          1.7,
          "#ffe28a",
        );
    }
    if (s.channel) {
      const f = Math.min(1, (Date.now() - s.channel.start) / s.channel.dur);
      this.label(
        "channel",
        "▰".repeat(Math.round(f * 10)) + "▱".repeat(10 - Math.round(f * 10)),
        s.player.x,
        s.player.y,
        1.7,
        "#ff8080",
      );
      if (f >= 1) s.channel = null;
    }
    this.effects = this.effects.filter((e) => e.until > time);
    for (const [i, e] of this.effects.entries())
      this.sprite(
        "effect" + i,
        "ui",
        "sparkle",
        e.x,
        e.y,
        (650 - (e.until - time)) / 1000,
        0.5,
        false,
        0x78c8f0,
      );
  }
  private drawPlant(id:string,species:string,stage:number,x:number,y:number,height:number,mutation:MutationId,time:number,facing?:number,size=1):boolean {
    if(!this.createAvatar || !hasPlantModel(species))return false;
    const key=species+':'+stage;
    let model=this.plantModels.get(id);
    if(model && model.key!==key) {disposePlant(model.root);this.plantModels.delete(id);model=undefined;}
    if(!model) {
      const root=plantModel(species,stage);if(!root)return false;
      model={root,key,seen:true};this.plantModels.set(id,model);this.scene.add(root);
    }
    model.seen=true;stylePlant(model.root,mutation,time);
    animatePlant(model.root,time,this.reducedPlantMotion.matches);
    model.root.scale.multiplyScalar(Number.isFinite(size)?Math.max(.1,Math.min(3,size)):1);
    model.root.position.set(x/TILE,height,y/TILE);
    if(facing!==undefined) {
      model.root.rotation.y+=facing;
      model.root.position.x+=Math.sin(facing)*.45+Math.cos(facing)*.3;
      model.root.position.z+=Math.cos(facing)*.45-Math.sin(facing)*.3;
    }
    return true;
  }
  private drawTree(id:string,stage:number,x:number,y:number):void {
    if(!this.createAvatar){this.sprite(id,'props','tree'+stage,x,y);return;}
    let model=this.treeModels.get(id);
    if(model && model.stage!==stage){disposeGroup(model.root);this.treeModels.delete(id);model=undefined;}
    if(!model){model={root:treeModel(stage),stage,seen:true};this.treeModels.set(id,model);this.scene.add(model.root);}
    model.seen=true;model.root.position.set(x/TILE,0,y/TILE);
  }
  private drawDecor(id:string,atlas:string,kind:string,x:number,y:number,scale=1,night=0):void {
    const frame=kind==='lamp'?'lamp'+(night>.3?1:0):kind;
    if(!this.createAvatar){this.sprite(id,atlas,frame,x,y,0,scale);return;}
    let model=this.decorModels.get(id);
    if(model && model.kind!==kind){disposeGroup(model.root);this.decorModels.delete(id);model=undefined;}
    if(!model){const root=decorModel(kind)??plazaModel(kind)??defenseModel(kind)??gateModel(kind);if(!root){this.sprite(id,atlas,frame,x,y,0,scale);return;}
      model={root,kind,seen:true};this.decorModels.set(id,model);this.scene.add(root);}
    model.seen=true;model.root.position.set(x/TILE,0,y/TILE);model.root.scale.setScalar(scale);updatePlazaModel(model.root,night);
  }
  dispose(): void {
    for(const p of this.decorModels.values())disposeGroup(p.root);
    this.decorModels.clear();
    for(const p of this.treeModels.values())disposeGroup(p.root);
    this.treeModels.clear();
    cancelAnimationFrame(this.animation);
    this.abort.abort();
    this.graphicsNotice?.remove(); this.graphicsNotice = null;
    this.state.net?.close();
    this.localAvatar?.dispose(); this.localAvatar = null;
    for (const avatar of this.remoteAvatars.values()) avatar.dispose();
    this.remoteAvatars.clear(); this.createAvatar = null;
    for (const avatar of this.npcAvatars.values()) avatar.dispose();
    this.npcAvatars.clear();
    for(const model of this.plazaModels.values())disposeGroup(model);
    this.plazaModels.clear();
    for (const p of this.plantModels.values()) disposePlant(p.root);
    this.plantModels.clear();
    for (const a of this.actors.values()) {
      a.mesh.geometry.dispose();
      a.mesh.material.dispose();
    }
    if (this.ground) disposeGroup(this.ground);
    if (this.buildings) disposeGroup(this.buildings);
    this.marker.geometry.dispose();
    this.marker.material.dispose();
    this.atlases.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlay.remove();
  }
}
