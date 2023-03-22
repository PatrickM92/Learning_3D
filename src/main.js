import * as THREE from 'three';
import "./style.css";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const _VS = `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
  vWorldPosition = worldPosition.xyz;

  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;


const _FS = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float offset;
uniform float exponent;

varying vec3 vWorldPosition;

void main() {
  float h = normalize( vWorldPosition + offset ).y;
  gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );
}`;

//Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xFFFFFF);
scene.fog = new THREE.FogExp2(0x89b2eb, 0.02);

//Create our sphere
const geometry = new THREE.SphereGeometry(3, 64, 64);
const material = new THREE.MeshStandardMaterial({
    color: '#00ff83'
})
const mesh = new THREE.Mesh(geometry, material);
mesh.position.y = 5.00;
scene.add(mesh);

const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100, 10, 10),
    new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
    }));
plane.castShadow = false;
plane.receiveShadow = true;
plane.rotation.x = -Math.PI / 2;
scene.add(plane);

//Sizes
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

//Light
// const light = new THREE.PointLight(0xffffff, 1, 100);
// light.position.set(0, 10, 10);
// scene.add(light);

//Area Light
// const ambientLight = new THREE.AmbientLight(0x404040);
// scene.add(ambientLight);

//Sun
_LoadSun(scene);
//Sky
_LoadSky(scene);


//Camera
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 100);
camera.position.z = 20;
camera.position.y = 20; //Height
scene.add(camera);

//Renderer
const canvas = document.querySelector('.webgl');
const renderer = new THREE.WebGLRenderer({ canvas })
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(2);
renderer.render(scene, camera)

//Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
//controls.enablePan = false;
//controls.enableZoom = false;
//controls.autoRotate = true;
//controls.autoRotateSpeed = 5;

function _LoadSun(scene) {
    let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    light.position.set(-10, 500, 10);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 1000.0;
    light.shadow.camera.left = 100;
    light.shadow.camera.right = -100;
    light.shadow.camera.top = 100;
    light.shadow.camera.bottom = -100;
    scene.add(light);
}

function _LoadSky(scene) {
    const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0xFFFFFFF, 0.6);
    hemiLight.color.setHSL(0.6, 1, 0.6);
    hemiLight.groundColor.setHSL(0.095, 1, 0.75);
    scene.add(hemiLight);

    const uniforms = {
        "topColor": { value: new THREE.Color(0x0077ff) },
        "bottomColor": { value: new THREE.Color(0xffffff) },
        "offset": { value: 33 },
        "exponent": { value: 0.6 }
    };
    uniforms["topColor"].value.copy(hemiLight.color);

    scene.fog.color.copy(uniforms["bottomColor"].value);

    const skyGeo = new THREE.SphereBufferGeometry(1000, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: _VS,
        fragmentShader: _FS,
        side: THREE.BackSide
    });

    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
}

//Resize
window.addEventListener("resize", () => {
    //Update Sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    //Update Camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
})

const loop = () => {
    controls.update();
    renderer.render(scene, camera);
    window.requestAnimationFrame(loop);
    //mesh.position.x += 0.01;
}
loop();