import { Vector3, type Object3D } from 'three';

/** Cosmetic humanoid pose. The asset still owns walking/leg animation. */
export class CarryPose {
  private rests = new WeakMap<Object3D, number>();
  private otherHand = new Vector3();
  apply(root: Object3D, carrying: boolean): void {
    const arms = root.userData.characterRig?.arms as Object3D[] | undefined;
    if (!arms || arms.length !== 2) return;
    for (const arm of arms) {
      if (!this.rests.has(arm)) this.rests.set(arm, arm.rotation.z);
      arm.rotation.z = carrying ? -Math.sign(arm.position.x) * 0.2 : this.rests.get(arm)!;
      if (carrying) arm.rotation.x = -1.2;
    }
  }
  position(root: Object3D, target: Vector3): boolean {
    const rig = root.userData.characterRig;
    if (rig?.arms?.length !== 2 || !rig.handLeft || !rig.handRight) return false;
    root.updateWorldMatrix(true, true);
    rig.handLeft.getWorldPosition(target);
    rig.handRight.getWorldPosition(this.otherHand);
    target.add(this.otherHand).multiplyScalar(0.5);
    return true;
  }
}
