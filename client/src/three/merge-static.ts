import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Bake only direct, static meshes; retain material identity for mutation tints. */
export function mergeStatic(root:T.Group):void {
  const batches=new Map<T.Material,T.Mesh[]>();
  for(const child of root.children){
    if(!(child instanceof T.Mesh)||Array.isArray(child.material))continue;
    const list=batches.get(child.material)??[];list.push(child);batches.set(child.material,list);
  }
  for(const [material,meshes] of batches){
    if(meshes.length<2)continue;
    const sources=meshes.map(mesh=>{
      mesh.updateMatrix();const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);return geometry;
    });
    const merged=mergeGeometries(sources,false);
    for(const geometry of sources)geometry.dispose();
    if(!merged)continue;
    for(const mesh of meshes){root.remove(mesh);mesh.geometry.dispose();}
    root.add(new T.Mesh(merged,material));
  }
}
