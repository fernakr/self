import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useHelper } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { OUTPUT_BOTH, SilhouetteGenerator } from './projection';
import { SilhouetteGeneratorWorker } from './projection/worker/SilhouetteGeneratorWorker.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { MeshBVH } from 'three-mesh-bvh';
import { acceleratedRaycast } from 'three-mesh-bvh';
import { GUI } from 'lil-gui';
import './App.css';

THREE.Mesh.prototype.raycast = acceleratedRaycast; // Use accelerated raycast with BVH

const models = [
  {
    name: 'Mouse',
    shapes: [
      {
        geometry: new THREE.SphereGeometry(1, 32, 32),
        material: new THREE.MeshStandardMaterial(),
        scale: [0.85, 0.85, 0.85],
        position: [0, 0, 0],
      },
      {
        geometry: new THREE.SphereGeometry(1, 32, 32),
        material: new THREE.MeshStandardMaterial(),
        scale: [0.5, 0.5, 0.5],
        position: [-0.8, 1, 0],
      },      
      {
        geometry: new THREE.SphereGeometry(1, 32, 32),
        material: new THREE.MeshStandardMaterial(),
        scale: [0.5, 0.5, 0.5],
        position: [0.8, 1, 0],
      },      
      
    ]
  }
]

function Model({ params, groupRef, modelRef }) {
  useEffect(() => {
    const model = modelRef.current;
    model.rotation.set(Math.PI / 4, 0, Math.PI / 8);
  }, []);

  const model = models[Math.random() * models.length | 0];
  return <group ref={modelRef}>{ model.shapes.map((shape, index) => (
    <mesh
      key={index}      
      scale={ shape.scale || [1, 1, 1]}
      position={shape.position}
      geometry={shape.geometry}
      material={shape.material}
    />)
  )}</group>;  
}

function Projection({ params, geometry }) {
  return (
    <mesh
      geometry={geometry}
      position={[0, -2, 0]}
      material={
        new THREE.MeshBasicMaterial({
          color: 0xf06292,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        })
      }
    />
  );
}

function Wireframe({ params, geometry }) {
  return (
    <mesh
      geometry={geometry}
      position={[0, -2, 0]}
      material={
        new THREE.MeshBasicMaterial({
          color: 0xc2185b,
          wireframe: true,
        })
      }
    />
  );
}

function Edges({ params, geometry }) {
  return (
    <lineSegments
      geometry={geometry}
      position={[0, -2, 0]}
      material={
        new THREE.LineBasicMaterial({
          color: 0x000000,
        })
      }
    />
  );
}

function Scene({ setControlsEnabled }) {
  const groupRef = useRef();
  const modelRef = useRef();
  
  const [shapes, setShapes] = useState([]);

  const [params, setParams] = useState({
    displaySilhouette: true,
    displayWireframe: false,
    displayOutline: false,
    displayModel: true
  });

  const [geometry, setGeometry] = useState(null);
  const [edgesGeometry, setEdgesGeometry] = useState(null);

  const { scene, camera, gl } = useThree();
  function calculateVolume(geometry) {
    const position = geometry.attributes.position;
    const indices = geometry.index.array;
    let volume = 0;

    for (let i = 0; i < indices.length; i += 3) {
        const p0 = new THREE.Vector3().fromBufferAttribute(position, indices[i]);
        const p1 = new THREE.Vector3().fromBufferAttribute(position, indices[i + 1]);
        const p2 = new THREE.Vector3().fromBufferAttribute(position, indices[i + 2]);

        volume += signedVolumeOfTriangle(p0, p1, p2);
    }

    return Math.abs(volume);
}

  function computeIntersectedVolume(geometryA, geometryB, matrixA, matrixB) {
    const raycaster = new THREE.Raycaster();
    const intersectedGeometry = new THREE.BufferGeometry();
    const positions = [];
    const indices = [];
    let index = 0;

    // Iterate over each vertex of geometryA
    const positionAttrA = geometryA.attributes.position;
    for (let i = 0; i < positionAttrA.count; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(positionAttrA, i);
        vertex.applyMatrix4(matrixA); // Transform vertex by geometryA's matrix

        // Cast a ray from this vertex in random directions to check intersections
        for (let j = 0; j < 6; j++) {
            const direction = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize();
            raycaster.set(vertex, direction);

            const intersects = raycaster.intersectObject(new THREE.Mesh(geometryB), false);

            // If intersection found, store the vertex
            if (intersects.length > 0) {
                positions.push(vertex.x, vertex.y, vertex.z);
                indices.push(index++);
            }
        }
    }

    intersectedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    intersectedGeometry.setIndex(indices);

    return calculateVolume(intersectedGeometry);
}

function signedVolumeOfTriangle(p1, p2, p3) {
  return p1.dot(p2.cross(p3)) / 6.0;
}


  useEffect(() => {
    console.log(shapes);
    if (shapes.length >= 2){
  

      const geometryA = shapes[0].geometry;
      const geometryB = shapes[1].geometry;
      const matrixA = shapes[0].matrixWorld;
      const matrixB = shapes[1].matrixWorld;
      const intersectedVolume = computeIntersectedVolume(geometryA, geometryB, matrixA, matrixB);
      console.log(intersectedVolume);

    }
  }, [shapes]);

  useEffect(() => {
    const gui = new GUI();
    gui.add(params, 'displayModel').onChange(() => setParams({ ...params }));
    gui.add(params, 'displaySilhouette').onChange(() => setParams({ ...params }));
    gui.add(params, 'displayOutline').onChange(() => setParams({ ...params }));
    gui.add(params, 'displayWireframe').onChange(() => setParams({ ...params }));
    // gui.add(params, 'useWorker').onChange(() => setParams({ ...params }));
    gui.add({ rotate: () => rotateModel(groupRef.current, modelRef.current) }, 'rotate');
    gui.add({ regenerate: () => regenerateEdges() }, 'regenerate');
    gui.add({ addBox: () => addShape(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial())) }, 'addBox');
    gui.add({ addSphere: () => addShape(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), new THREE.MeshStandardMaterial())) }, 'addSphere');

    const worker = new SilhouetteGeneratorWorker();
    regenerateEdges();

    function addShape(shape){
      
      
      shape.position.set(0, 0, 0);
      groupRef.current.add(shape);      
      const controls = new TransformControls(camera, gl.domElement);
      controls.attach(shape);
      

      //console.log([...shapes, shape]);
      setShapes(shapes => [...shapes, shape]);

      scene.add(controls);
      controls.addEventListener('dragging-changed', (event) => {
        setControlsEnabled(!event.value);
        
      });

    }


    function rotateModel(group, model) {
      group.quaternion.random();
      group.position.set(0, 0, 0);
      group.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(model, true);
      box.getCenter(group.position).multiplyScalar(-1);
      group.position.y = Math.max(0, -box.min.y) + 1;
    }

    function regenerateEdges() {
      const generator = new SilhouetteGenerator();
      generator.iterationTime = 30;
      generator.output = OUTPUT_BOTH;

      const geometries = [];
      modelRef.current.updateWorldMatrix(true, true);
      modelRef.current.traverse((c) => {
        if (c.geometry) {
          const clone = c.geometry.clone();
          clone.applyMatrix4(c.matrixWorld);
          for (const key in clone.attributes) {
            if (key !== 'position') clone.deleteAttribute(key);
          }
          geometries.push(clone);
        }
      });

      const mergedGeometry = mergeGeometries(geometries, false);

      worker.generate(mergedGeometry, { output: OUTPUT_BOTH }).then((res) => {
        setGeometry(res[0]);
        setEdgesGeometry(res[1]);
      });
    
    }

    return () => gui.destroy();
  }, [params]);

  return (
    <group ref={groupRef}>
      <Model params={params} groupRef={groupRef} modelRef={modelRef} />
      {geometry && <Projection params={params} geometry={geometry} />}
      {params.displayWireframe && geometry && <Wireframe params={params} geometry={geometry} />}
      {params.displayOutline && edgesGeometry && <Edges params={params} geometry={edgesGeometry} />}
    </group>
  );
}

function App() {
  const [controlsEnabled, setControlsEnabled] = useState(true);
  return (
    <Canvas camera={{ position: [4.5, 4.5, 4.5], fov: 75 }}>
      <ambientLight intensity={0.5} color={0xb0bec5} />
      <directionalLight intensity={3.5} position={[1, 2, 3]} />
      <Scene setControlsEnabled={ setControlsEnabled }/>
      <OrbitControls enabled={controlsEnabled}  />
    </Canvas>
  );
}

export default App;
