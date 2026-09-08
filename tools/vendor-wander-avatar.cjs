// Box C only. Snapshot the reviewed renderer dependency graph, then build only
// from that snapshot. Never edits the live Wander source or deploys either game.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),esbuild=require('esbuild');
const source='/opt/wander-engine-v2/src/wag/client';
const modules=['resolver/substrate.ts','resolver/relational.ts','textureToVector.ts','clayShaderPatch.ts','materialRegistry.ts','characterRigContract.ts','generators/materials.ts','hitbox.ts','generators/wearable.ts','playerAvatar.ts'];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
(async()=>{
  const directory=fs.mkdtempSync('/opt/pons/avatar-vendor-');
  const manifest={origin:source,esbuild:esbuild.version,files:{},patches:[],outputSha256:''};
  for(const name of modules){const bytes=fs.readFileSync(path.join(source,name));
    if(name==='playerAvatar.ts' && hash(bytes)!=='b82e468e9c9da3fe5cca3cc7aa09943e20b18e27f14638de9ab4db92733769c8')throw Error('Reviewed avatar source changed');
    const target=path.join(directory,'source',name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);manifest.files[name]=hash(bytes);
  }
  // Pons-only lifecycle repair. Original upstream hashes remain in files;
  // the snapshot/archive contains the patched input used for this build.
  const shaderPath=path.join(directory,'source','clayShaderPatch.ts');
  const original=fs.readFileSync(shaderPath,'utf8');
  if(hash(original)!=='fe51587a5bef96876aa425c64ffa0969867e667fc6257059f9ac1c74f740e96a')throw Error('Reviewed shader source changed');
  const anchor='  _patched.add(m);';
  if(original.split(anchor).length!==2)throw Error('Shader lifecycle patch anchor changed');
  const patched=original.replace(anchor,anchor+'\n  m.addEventListener("dispose", () => { _patched.delete(m); });');
  fs.writeFileSync(shaderPath,patched);
  manifest.patches.push({file:'clayShaderPatch.ts',reason:'Release disposed materials from shader tuning registry',beforeSha256:hash(original),afterSha256:hash(patched)});
  const avatarPath=path.join(directory,'source','playerAvatar.ts');
  const avatarOriginal=fs.readFileSync(avatarPath,'utf8');let avatarPatched=avatarOriginal;
  for(const [from,to] of [
    ['  rebuild() {','  rebuild() {\n    for (const material of this.root.userData.ponsOwnedMaterials || []) material.dispose();\n    this.root.userData.ponsOwnedMaterials = [];'],
    ['      return _m;','      this.root.userData.ponsOwnedMaterials.push(_m);\n      return _m;'],
    ['    const eye  = new THREE.MeshBasicMaterial({ color: s.eyeColor });','    const eye  = new THREE.MeshBasicMaterial({ color: s.eyeColor });\n    this.root.userData.ponsOwnedMaterials.push(eye);'],
  ]) {
    if(avatarPatched.split(from).length!==2)throw Error('Avatar ownership patch anchor changed');
    avatarPatched=avatarPatched.replace(from,to);
  }
  fs.writeFileSync(avatarPath,avatarPatched);
  manifest.patches.push({file:'playerAvatar.ts',reason:'Track all created materials including unused preset materials for disposal',beforeSha256:hash(avatarOriginal),afterSha256:hash(avatarPatched)});
  const entry=path.join(directory,'source','entry.ts');
  fs.writeFileSync(entry,"export {PlayerAvatar,PLAYER_MODEL_PRESETS,DEFAULT_CUSTOM} from './playerAvatar';\n");
  await esbuild.build({entryPoints:[entry],bundle:true,platform:'browser',format:'esm',external:['three'],outfile:path.join(directory,'WanderAvatar.js'),banner:{js:'// Generated from the recorded Wander renderer snapshot. See manifest.json; do not edit by hand.'}});
  manifest.outputSha256=hash(fs.readFileSync(path.join(directory,'WanderAvatar.js')));
  fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log(JSON.stringify({directory,modules:modules.length,bytes:fs.statSync(path.join(directory,'WanderAvatar.js')).size,outputSha256:manifest.outputSha256}));
})().catch(e=>{console.error(e);process.exitCode=1;});
