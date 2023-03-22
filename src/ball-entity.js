import * as THREE from 'three';

//import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';


import { entity } from './entity.js';
import { finite_state_machine } from './finite-state-machine.js';
import { ball_state } from './ball-state.js';
import { Vector2 } from 'three';


export const ball_entity = (() => {

    class BallFSM extends finite_state_machine.FiniteStateMachine {
        constructor(proxy) {
            super();
            this._proxy = proxy;
            this._Init();
        }

        _Init() {
            this._AddState('idle', ball_state.IdleState);
            this._AddState('walk', ball_state.WalkState);
            // this._AddState('idle', player_state.IdleState);
            // this._AddState('walk', player_state.WalkState);
            // this._AddState('run', player_state.RunState);
            // this._AddState('attack', player_state.AttackState);
            // this._AddState('death', player_state.DeathState);
        }
    };

    class BasicBallControllerProxy {
        constructor(animations) {
            this._animations = animations;
        }

        get animations() {
            return this._animations;
        }
    };


    class BasicBallController extends entity.Component {
        constructor(params) {
            super();
            this._Init(params);
        }

        _Init(params) {
            this._params = params;
            //this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
            this._decceleration = new THREE.Vector3(-10.0, -10.0, -10.0);
            //this._acceleration = new THREE.Vector3(1, 0.125, 50.0);
            this._acceleration = new THREE.Vector3(60, 60, 60);
            this._velocity = new THREE.Vector3(0, 0, 0);
            this._position = new THREE.Vector3();

            this._animations = {};
            this._stateMachine = new BallFSM(
                new BasicBallControllerProxy(this._animations));

            this._LoadModels();
        }

        InitComponent() {
            this._RegisterHandler('health.death', (m) => { this._OnDeath(m); });
        }

        _OnDeath(msg) {
            console.log("ball died");
            this._stateMachine.SetState('death');
        }

        _LoadModels() {
            //Create our sphere
            const geometry = new THREE.SphereGeometry(3, 64, 64);
            const material = new THREE.MeshStandardMaterial({
                color: '#00ff83'
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = "ball name";
            mesh.position.y = 2.50;
            mesh.castShadow = true;

            this._moveToLocation = new Vector2(mesh.position.x, mesh.position.z);
            this._target = mesh;
            this._stateMachine.SetState('idle');

            this._params.scene.add(mesh);

            document.addEventListener('mousedown', (e) => this._onMouseDown(e), false);
            document.addEventListener('mousemove', (e) => this._onMouseMove(e), false);
        }

        _onMouseMove(e) {
            const mousePosition = new THREE.Vector2();
            mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
            mousePosition.y = -(e.clientY / window.innerHeight) * 2 + 1;
            this._mousePosition = mousePosition;
        }

        _onMouseDown(event) {
            const rayCaster = new THREE.Raycaster();
            //console.log(this._mousePosition)
            rayCaster.setFromCamera(this._mousePosition, this._params.camera);
            const intersects = rayCaster.intersectObjects(this._params.scene.children);
            //console.log(intersects)
            for (let i = 0; i < intersects.length; i++) {
                if (intersects[i].object.name === 'ground') {
                    //console.log(intersects[i]);
                    console.log("intersects", intersects[i]['point'])
                    console.log("ball", this._target.position)
                    const moveToLocation = new THREE.Vector2(intersects[i]['point']['x'], intersects[i]['point']['z'])
                    this._moveToLocation = moveToLocation;

                    // const geometry = new THREE.BoxGeometry(4, 4, 4);
                    // const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
                    // const cube = new THREE.Mesh(geometry, material);
                    // cube.receiveShadow = true;
                    // cube.castShadow = true;

                    // cube.position.x = intersects[i]['point']['x'];
                    // cube.position.z = intersects[i]['point']['z'];
                    // cube.position.y = 2.5;

                    // this._params.scene.add(cube);
                }
            }
        }

        _FindIntersections(pos) {
            const _IsAlive = (c) => {
                const h = c.entity.GetComponent('HealthComponent');
                if (!h) {
                    return true;
                }
                return h._health > 0;
            };

            const grid = this.GetComponent('SpatialGridController');
            const nearby = grid.FindNearbyEntities(5).filter(e => _IsAlive(e));
            const collisions = [];

            for (let i = 0; i < nearby.length; ++i) {
                const e = nearby[i].entity;
                const d = ((pos.x - e._position.x) ** 2 + (pos.z - e._position.z) ** 2) ** 0.5;

                // HARDCODED
                if (d <= 4) {
                    collisions.push(nearby[i].entity);
                }
            }
            return collisions;
        }

        Update(timeInSeconds) {
            //get ball position
            const ballPosition = this._target['position'];
            //console.log("ball", ballPosition);

            //get click position
            const clickPosition = this._moveToLocation;
            //console.log(clickPosition);
            // this._target.position.x = clickPosition.x;
            // this._target.position.z = clickPosition.y;

            //Checking if the mouse click was within a small distance of the ball,
            //if so, there is no reason to really move the ball right now
            // if (Math.abs(Math.abs(ballPosition.x) - Math.abs(clickPosition.x)) < 1 &
            //     Math.abs(Math.abs(ballPosition.z) - Math.abs(clickPosition.y)) < 1) {
            //     //console.log('too close, not moving')
            //     return;
            // }

            const velocity = this._velocity;
            const frameDecceleration = new THREE.Vector3(
                velocity.x * this._decceleration.x,
                velocity.y * this._decceleration.y,
                velocity.z * this._decceleration.z
            );
            frameDecceleration.multiplyScalar(timeInSeconds);
            frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
                Math.abs(frameDecceleration.z), Math.abs(velocity.z));

            velocity.add(frameDecceleration);

            const controlObject = this._target;
            const _Q = new THREE.Quaternion();
            const _A = new THREE.Vector3();
            const _R = controlObject.quaternion.clone();

            const acc = this._acceleration.clone();
            //make it go that direction
            if (clickPosition.x - ballPosition.x > 0) {
                velocity.x += acc.x * timeInSeconds;
            } else {
                velocity.x -= acc.x * timeInSeconds;
            }

            if (clickPosition.y - ballPosition.z > 0) {
                velocity.z += acc.z * timeInSeconds;
            } else {
                velocity.z -= acc.z * timeInSeconds;
            }
            const forward = new THREE.Vector3(0, 0, 1);
            forward.applyQuaternion(controlObject.quaternion);
            forward.normalize();

            const sideways = new THREE.Vector3(1, 0, 0);
            sideways.applyQuaternion(controlObject.quaternion);
            sideways.normalize();

            sideways.multiplyScalar(velocity.x * timeInSeconds);
            forward.multiplyScalar(velocity.z * timeInSeconds);

            const pos = controlObject.position.clone();
            pos.add(forward);
            pos.add(sideways);

            // const collisions = this._FindIntersections(pos);
            // if (collisions.length > 0) {
            //     return;
            // }

            controlObject.position.copy(pos);
            this._position.copy(pos);

            this._parent.SetPosition(this._position);
            this._parent.SetQuaternion(this._target.quaternion);

            //console.log(this._velocity)

        }

        UpdateOld(timeInSeconds) {
            if (!this._stateMachine._currentState) {
                return;
            }

            const input = this.GetComponent('BasicBallControllerInput');
            this._stateMachine.Update(timeInSeconds, input);

            if (this._mixer) {
                this._mixer.update(timeInSeconds);
            }

            // HARDCODED
            if (this._stateMachine._currentState._action) {
                this.Broadcast({
                    topic: 'player.action',
                    action: this._stateMachine._currentState.Name,
                    time: this._stateMachine._currentState._action.time,
                });
            }

            const currentState = this._stateMachine._currentState;
            if (currentState.Name != 'walk' &&
                currentState.Name != 'run' &&
                currentState.Name != 'idle') {
                return;
            }

            const velocity = this._velocity;
            const frameDecceleration = new THREE.Vector3(
                velocity.x * this._decceleration.x,
                velocity.y * this._decceleration.y,
                velocity.z * this._decceleration.z
            );
            frameDecceleration.multiplyScalar(timeInSeconds);
            frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
                Math.abs(frameDecceleration.z), Math.abs(velocity.z));

            velocity.add(frameDecceleration);

            const controlObject = this._target;
            const _Q = new THREE.Quaternion();
            const _A = new THREE.Vector3();
            const _R = controlObject.quaternion.clone();

            const acc = this._acceleration.clone();
            if (input._keys.shift) {
                acc.multiplyScalar(2.0);
            }

            if (input._keys.forward) {
                velocity.z += acc.z * timeInSeconds;
            }
            if (input._keys.backward) {
                velocity.z -= acc.z * timeInSeconds;
            }
            if (input._keys.left) {
                _A.set(0, 1, 0);
                _Q.setFromAxisAngle(_A, 4.0 * Math.PI * timeInSeconds * this._acceleration.y);
                _R.multiply(_Q);
            }
            if (input._keys.right) {
                _A.set(0, 1, 0);
                _Q.setFromAxisAngle(_A, 4.0 * -Math.PI * timeInSeconds * this._acceleration.y);
                _R.multiply(_Q);
            }

            controlObject.quaternion.copy(_R);

            const oldPosition = new THREE.Vector3();
            oldPosition.copy(controlObject.position);

            const forward = new THREE.Vector3(0, 0, 1);
            forward.applyQuaternion(controlObject.quaternion);
            forward.normalize();

            const sideways = new THREE.Vector3(1, 0, 0);
            sideways.applyQuaternion(controlObject.quaternion);
            sideways.normalize();

            sideways.multiplyScalar(velocity.x * timeInSeconds);
            forward.multiplyScalar(velocity.z * timeInSeconds);

            const pos = controlObject.position.clone();
            pos.add(forward);
            pos.add(sideways);

            // const collisions = this._FindIntersections(pos);
            // if (collisions.length > 0) {
            //     return;
            // }

            controlObject.position.copy(pos);
            this._position.copy(pos);

            this._parent.SetPosition(this._position);
            this._parent.SetQuaternion(this._target.quaternion);
        }
    };

    return {
        BasicBallControllerProxy: BasicBallControllerProxy,
        BasicBallController: BasicBallController,
    };

})();