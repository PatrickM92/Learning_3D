import * as THREE from 'three';
import "../style.css";
//import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { third_person_camera } from './third-person-camera.js';
import { entity_manager } from './entity-manager.js';
import { entity } from './entity.js';
import { ball_entity } from './ball-entity.js'
import { ball_input } from './ball-input.js';

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

class MyRPG {
    constructor() {
        this._Initialize();
    }

    _Initialize() {
        console.log("loading...")
        const canvas = document.querySelector('.webgl');
        this._canvas = canvas;
        this._threejs = new THREE.WebGLRenderer({
            antialias: true,
            canvas
        });
        this._threejs.outputEncoding = THREE.sRGBEncoding;
        this._threejs.gammaFactor = 2.2;
        this._threejs.shadowMap.enabled = true;
        this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
        // this._threejs.shadowMap.needsUpdate = true;
        // this._threejs.castShadow = true;
        this._threejs.setPixelRatio(window.devicePixelRatio);
        this._threejs.setPixelRatio(2);
        this._threejs.setSize(window.innerWidth, window.innerHeight);
        this._threejs.domElement.id = 'threejs';

        //document.getElementById('webgl').appendChild(this._threejs.domElement);

        window.addEventListener('resize', () => {
            this._OnWindowResize();
        }, false);

        const fov = 60;
        const aspect = 1920 / 1080;
        const near = 0.1;
        const far = 10000.0;
        this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this._camera.position.set(0, 10, 25);

        this._scene = new THREE.Scene();
        this._scene.background = new THREE.Color(0xFFFFFF);
        this._scene.fog = new THREE.FogExp2(0x89b2eb, 0.002);

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
        this._scene.add(light);

        this._sun = light;

        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(50, 50, 10, 10),
            new THREE.MeshStandardMaterial({
                color: 0x1e601c,
            }));
        plane.castShadow = false;
        plane.receiveShadow = true;
        plane.rotation.x = -Math.PI / 2;
        plane.name = 'ground';
        this._scene.add(plane);

        this._entityManager = new entity_manager.EntityManager();

        //load modules
        this._LoadSky();
        this._LoadBall();
        this._LoadEnv();

        this._previousRAF = null;
        this._RAF();
    }

    _LoadBall() {
        const params = {
            camera: this._camera,
            scene: this._scene,
        };

        // const controls = new OrbitControls(this._camera, this._canvas);
        // controls.enableDamping = true;

        const ball = new entity.Entity();
        //ball.SetPosition(mesh.position);
        ball.AddComponent(new ball_input.BasicBallControllerInput(params));
        ball.AddComponent(new ball_entity.BasicBallController(params));
        this._entityManager.Add(ball, 'ball');

        const camera = new entity.Entity();
        camera.AddComponent(
            new third_person_camera.ThirdPersonCamera({
                camera: this._camera,
                target: this._entityManager.Get('ball')
            }));
        this._entityManager.Add(camera, 'ball-camera');
    }

    _LoadEnv() {
        //Create our test Env

        const texture = new THREE.TextureLoader().load("textures/rock02_2.jpg");
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);

        const geometry = new THREE.BoxGeometry(4, 4, 4);
        //const material = new THREE.MeshLambertMaterial({ color: 0xffffff, map: texture });
        const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        cube.receiveShadow = true;
        cube.castShadow = true;

        // const geometry = new THREE.SphereGeometry(3, 64, 64);
        // const material = new THREE.MeshStandardMaterial({
        //     color: '#00ff83'
        // });
        // const mesh = new THREE.Mesh(geometry, material);
        cube.position.z = 10.00;
        cube.position.y = 2.50;

        this._scene.add(cube);

    }

    _LoadSky() {
        const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0xFFFFFFF, 0.6);
        hemiLight.color.setHSL(0.6, 1, 0.6);
        hemiLight.groundColor.setHSL(0.095, 1, 0.75);
        this._scene.add(hemiLight);

        const uniforms = {
            "topColor": { value: new THREE.Color(0x0077ff) },
            "bottomColor": { value: new THREE.Color(0xffffff) },
            "offset": { value: 33 },
            "exponent": { value: 0.6 }
        };
        uniforms["topColor"].value.copy(hemiLight.color);

        this._scene.fog.color.copy(uniforms["bottomColor"].value);

        const skyGeo = new THREE.SphereBufferGeometry(1000, 32, 15);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: _VS,
            fragmentShader: _FS,
            side: THREE.BackSide
        });

        const sky = new THREE.Mesh(skyGeo, skyMat);
        this._scene.add(sky);
    }

    _OnWindowResize() {
        this._camera.aspect = window.innerWidth / window.innerHeight;
        this._camera.updateProjectionMatrix();
        this._threejs.setSize(window.innerWidth, window.innerHeight);
    }

    _UpdateSun() {
        // const player = this._entityManager.Get('player');
        // const pos = player._position;
        const ball = this._entityManager.Get('ball');
        const pos = ball._position;
        //const pos = new THREE.Vector3(25, 10, 25);

        this._sun.position.copy(pos);
        this._sun.position.add(new THREE.Vector3(-10, 500, -10));
        this._sun.target.position.copy(pos);
        this._sun.updateMatrixWorld();
        this._sun.target.updateMatrixWorld();
    }

    _RAF() {
        requestAnimationFrame((t) => {
            if (this._previousRAF === null) {
                this._previousRAF = t;
            }

            this._RAF();

            this._threejs.render(this._scene, this._camera);
            this._Step(t - this._previousRAF);
            this._previousRAF = t;
        });
    }

    _Step(timeElapsed) {
        const timeElapsedS = Math.min(1.0 / 30.0, timeElapsed * 0.001);
        this._UpdateSun();
        this._entityManager.Update(timeElapsedS);
    }
}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
    _APP = new MyRPG();
});