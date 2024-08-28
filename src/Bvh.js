import { useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const BVHComponent = () => {
  const gltf = useLoader(GLTFLoader, 'cat.glb');

  useEffect(() => {
    // console.log(gltf.scene.children[0]);
    const mesh = gltf.scene.children[0];
    console.log(mesh);
    // mesh.rotation.x = Math.PI / 2;
    mesh.rotation.z = -Math.PI / 8;
    mesh.scale.set(3, 3, 3);

    // .children[0].children[0].children[0].children[0]; // Assuming the mesh is the first child
    // // console.log(mesh);
    // mesh.geometry.boundsTree = new MeshBVH(mesh.geometry);
    
    // THREE.Mesh.prototype.raycast = acceleratedRaycast;
    // rotate the mesh
    
  }, [gltf]);

  return <primitive object={gltf.scene} />;
};

export default BVHComponent;
