import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import wobbleVertexShader from './shaders/wobble/vertex.glsl';
import wobbleFragmentShader from './shaders/wobble/fragment.glsl';


import GUI from 'lil-gui';
/**
 * Project: create an organic animation
 * -Custom Shader Material injects shader code in the three.js built.in material without
 * us having to dig into the Three.js shaders
 * - we are going to enhance the MeshPhysicalMaterial and make the surface wobble
 * 
 * - FIX THE SHADOWS: three.js renders the scene seen from the light in an off-screen texture
 * with all the materials replaced by a MeshDepthMaterial => depthMaterial. Send th: wobble.customDepthMaterial = depthMaterial;
 * 
 * - ANIMATE & CONTROL OF THE WOBBLING
 * We are going to create this uniforms(affects to the material & to depthMaterial):
 * - uTime: to make the effect wary in time
 * - uPositionFrequency to control the spatial frequency
 * - uTimeFrecuency to control the time frequency
 * - uStrength to control the strength of the wobble
 * 
 * WARP
 * -We could combine multiple Simplex Noise with various frecuencies, but that would look more like waves
 * Instead we are going to "warp" the position we send to the Simplex Noise using another Simplex Noise
 * 
 * -FRAGMENT
 * We need to send the wobble value from the vertex to the fragment
 * remap of wobble in vertex.glsl

 */

/**
 * Base
 */
// Debug
const gui = new GUI({ width: 325 });
const debugObject = {};



// Canvas
const canvas = document.querySelector('canvas.webgl');

// Scene
const scene = new THREE.Scene();

// Loaders
const rgbeLoader = new RGBELoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('./draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

/**
 * Environment map
 */
// rgbeLoader.load('./rick-and-morty-orange-space.jpg', (environmentMap) =>
// {
//     environmentMap.mapping = THREE.EquirectangularReflectionMapping;

//     scene.background = environmentMap;
//     scene.environment = environmentMap;
// })
const textureLoader = new THREE.TextureLoader();
textureLoader.load('./rick-morty-space.jpg', (texture) => {
    texture.image.width = 1024; // Ajusta a la resolución deseada
    texture.image.height = 512;
    
    texture.needsUpdate = true; // Asegura que se apliquen los cambios
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
});

/**
 * Wobble
 */
// Material

debugObject.colorA = '#0000ff';
debugObject.colorB = '#ff0000';

const uniforms = {
    uTime: new THREE.Uniform(0),
    uPositionFrequency: new THREE.Uniform(0.5),
    uTimeFrequency: new THREE.Uniform(0.4),
    uStrength: new THREE.Uniform(0.3),
    //warp
    uWarpPositionFrequency: new THREE.Uniform(0.38),
    uWarpTimeFrequency: new THREE.Uniform(0.12),
    uWarpStrength: new THREE.Uniform(1.7),
    //colors
    uColorA: new THREE.Uniform(new THREE.Color(debugObject.colorA)),
    uColorB: new THREE.Uniform(new THREE.Color(debugObject.colorB))
}
//const material = new THREE.MeshPhysicalMaterial({ - replacement
const material = new CustomShaderMaterial({
    //CustomShaderMaterial:
    baseMaterial: THREE.MeshPhysicalMaterial,
    vertexShader: wobbleVertexShader,
    fragmentShader: wobbleFragmentShader,
    uniforms: uniforms,
    silent: true,
    // MeshPhysicalMaterial
    metalness: 0,
    roughness: 0.5,
    color: '#240bda',
    transmission: 0,
    ior: 1.5,
    thickness: 1.5,
    transparent: true,
    wireframe: false
});

const depthMaterial = new CustomShaderMaterial({
    //CustomShaderMaterial:
    baseMaterial: THREE.MeshDepthMaterial,
    vertexShader: wobbleVertexShader,
    uniforms: uniforms,
    silent: true,

    //MeshDepthMaterial:
    depthPacking: THREE.RGBADepthPacking //algorithm to encode the depth in all 4 channels instead of a grayscale depth to improve the precision
   
  
});



// Tweaks

gui.add(uniforms.uTimeFrequency, 'value', 0, 2, 0.001).name('uTimeFrecuency');
gui.add(uniforms.uStrength, 'value', 0, 2, 0.001).name('uStrength');
gui.add(uniforms.uPositionFrequency, 'value', 0, 2, 0.001).name('uPositionFrecuency');
gui.add(uniforms.uTimeFrequency, 'value', 0, 2, 0.001).name('uTimeFrecuency');

gui.add(uniforms.uWarpStrength, 'value', 0, 2, 0.001).name('uWarpStrength');
gui.add(uniforms.uWarpPositionFrequency, 'value', 0, 2, 0.001).name('uWarpPositionFrecuency');
gui.add(uniforms.uWarpTimeFrequency, 'value', 0, 2, 0.001).name('uWarpTimeFrecuency');


gui.addColor(debugObject, 'colorA').onChange(() => uniforms.uColorA.value.set(debugObject.colorA));
gui.addColor(debugObject, 'colorB').onChange(() => uniforms.uColorB.value.set(debugObject.colorB));

gui.add(material, 'metalness', 0, 1, 0.001);
gui.add(material, 'roughness', 0, 1, 0.001);
gui.add(material, 'transmission', 0, 1, 0.001);
gui.add(material, 'ior', 0, 10, 0.001);
gui.add(material, 'thickness', 0, 10, 0.001);


// Geometry
let geometry = new THREE.IcosahedronGeometry(2.5, 50);
// to become the index
geometry = mergeVertices(geometry);
// we can access to the normal, position, uv => geometry.attributes
// BufferGeometry had a method to calculate the tangent: computeTangents()
geometry.computeTangents();
console.log('geometry', geometry.attributes);
// so now we can access to the normal, position, tangent, and uv
//Now we have to calculate the biTangent (is perpendicular to both the normal and the tangent). In vertex.glsl     vec3 biTangent = cross(normal, tangent.xyz);
// So we can calculate the neigbours(A & B) when we know the tangent, and the biTangent
// tangent direction : direction to neighbour A // biTangent direction : direction to neighbour B. in vertex.glsl Neighbours positions


//Mesh
const wobble = new THREE.Mesh(geometry, material);
wobble.customDepthMaterial = depthMaterial;
wobble.receiveShadow = true;
wobble.castShadow = true;
scene.add(wobble);
/**
 * Model
 */
// gltfLoader.load('./suzanne.glb', (gltf) => {
//     const wobble = gltf.scene.children[0];

//     wobble.receiveShadow = true;
//     wobble.castShadow = true;
//     wobble.material = material;
//     wobble.customDepthMaterial = depthMaterial;

//     scene.add(wobble);
// })

/**
 * Plane
 */
// const plane = new THREE.Mesh(
//     new THREE.PlaneGeometry(15, 15, 15),
//     new THREE.MeshStandardMaterial()
// );
// plane.receiveShadow = true;
// plane.rotation.y = Math.PI;
// plane.position.y = - 5;
// plane.position.z = 5;
// scene.add(plane);

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight('#ffffff', 3);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.far = 15;
directionalLight.shadow.normalBias = 0.05;
directionalLight.position.set(0.25, 2, - 2.25);
scene.add(directionalLight);

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.min(window.devicePixelRatio, 2)
};

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    sizes.pixelRatio = Math.min(window.devicePixelRatio, 2);

    // Update camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(sizes.pixelRatio);
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 100);
camera.position.set(13, - 3, - 5);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(sizes.pixelRatio);

/**
 * Animate
 */
const clock = new THREE.Clock();

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime();

    //update material uniform uTime
    uniforms.uTime.value = elapsedTime;

    // Update controls
    controls.update();

    

    // Render
    renderer.render(scene, camera);

    // Call tick again on the next frame
    window.requestAnimationFrame(tick);
}

tick();