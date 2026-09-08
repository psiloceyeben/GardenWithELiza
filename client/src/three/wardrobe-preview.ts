import * as T from 'three';
import {VisualAvatar} from './visual-avatar';
import {PlayerAvatar,DEFAULT_CUSTOM} from './vendor/WanderAvatar.js';

// Small PNGs only: no live avatar, animation loop or GPU context is cached.
const cache=new Map<string,string>();
const LIMIT=32;
let unavailable=false;
export function populateWardrobePreviews(container:HTMLElement,skin:number):void {
  const targets=[...container.querySelectorAll<HTMLElement>('[data-outfit]')];
  const pending=targets.filter(el=>!cache.has(`${el.dataset.outfit}:${skin}`));
  if(pending.length && !unavailable){
    let renderer:T.WebGLRenderer|undefined;
    let avatar:VisualAvatar|undefined;
    try{
      renderer=new T.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});
      renderer.setSize(128,128);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.01,20);
      const light=new T.DirectionalLight(0xffffff,2);light.position.set(-3,5,4);
      scene.add(new T.AmbientLight(0xffffff,2),light);
      avatar=new VisualAvatar((state,options)=>new PlayerAvatar(state,options),{...DEFAULT_CUSTOM,preset:'wanderer'});
      scene.add(avatar.root);
      for(const el of pending){
        const [shirt,hat,hair=0]=el.dataset.outfit!.split(':').map(Number),key=`${el.dataset.outfit}:${skin}`;
        avatar.setWardrobe(shirt,hat,skin,hair);
        const portrait=el.dataset.outfit!.endsWith(':hair');
        avatar.root.traverse(o=>{if(o.name.startsWith('pons-hat-'))o.visible=!portrait;});
        const box=new T.Box3().setFromObject(avatar.root),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
        const distance=portrait ? 1.5 : Math.max(size.x,size.y,size.z)*.65/Math.tan(T.MathUtils.degToRad(16));
        if(portrait)center.set(0,1.73,0);
        camera.position.copy(center).add((portrait?new T.Vector3(.95,.18,-1):new T.Vector3(.2,.08,1)).normalize().multiplyScalar(distance));camera.lookAt(center);
        renderer.render(scene,camera);
        cache.set(key,renderer.domElement.toDataURL('image/png'));
        if(cache.size>LIMIT)cache.delete(cache.keys().next().value!);
      }
    }catch{
      // Preserve cached images/fallbacks and stop retrying a failed GPU until reload.
      unavailable=true;
    }finally{
      avatar?.dispose();renderer?.dispose();renderer?.forceContextLoss();
    }
  }
  for(const el of targets){
    const url=cache.get(`${el.dataset.outfit}:${skin}`);if(!url || !el.isConnected)continue;
    const img=document.createElement('img');img.src=url;img.alt='';img.width=64;img.height=64;
    img.style.cssText='display:block;image-rendering:pixelated';img.dataset.previewSkin=String(skin);img.dataset.previewHair=el.dataset.outfit!.split(':')[2]??'0';
    el.style.backgroundImage='none';el.replaceChildren(img);
  }
}
