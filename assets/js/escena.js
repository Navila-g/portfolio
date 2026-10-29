/*
 * Escena 3D del portfolio (Three.js). Todo es geometría y materiales físicos
 * (PBR): no se carga ninguna imagen ni modelo, salvo la foto, que se pinta como
 * holograma. El realismo sale de un «estudio de fotografía» virtual (paneles de
 * luz) que se convierte en mapa de entorno: es lo que se refleja en el cromo.
 *
 * Coreografía: cada sección de la página tiene un fotograma clave (posición,
 * giro, escala y «despertar» del robot). Al hacer scroll se interpola entre el
 * anterior y el siguiente; el robot «despierta» (HUD y «Acceso concedido») al entrar
 * en «acceso». La cabeza sigue al cursor todo el rato y parpadea de vez en cuando.
 *
 * El efecto del casco (como en landonorris.com): en el inicio, debajo del retrato
 * de Navila está su versión androide (androide.webp, encajada con ella gafas con
 * gafas). El cursor deja una mancha líquida que la destapa; mientras, unas gotas
 * pequeñas se pasean solas por su cabeza y destapan trocitos, para insinuar que
 * ahí hay algo. La mancha vive en mascaraA/B (se va borrando sola) y la mezcla la
 * hace el sombreador del retrato. Al bajar, el androide «sale» de ella como robot
 * 3D (cromo y gafas negras, a juego), que se pinta en robotRT y acompaña al resto
 * de la página.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = document.documentElement;
const movil = matchMedia('(max-width: 899px)').matches || matchMedia('(pointer: coarse)').matches;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function avisarLista() {
  window.__escenaLista = true;
  dispatchEvent(new Event('escena-lista'));
}

// ── Renderizador ───────────────────────────────────────────────
const canvas = document.getElementById('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  root.classList.add('no-gl');
  avisarLista();
  throw e;
}
let dpr = Math.min(devicePixelRatio || 1, movil ? 1.5 : 1.75);
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight, false);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 9);

// ── Estudio de luz → mapa de entorno ───────────────────────────
// claro = estudio de fotografía de producto (más luz rebotada) para que el cromo del
// robot se vea plata como el androide; el oscuro es para los cristales.
function crearEntorno(claro = false) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(
    new THREE.SphereGeometry(30, 32, 16),
    new THREE.MeshBasicMaterial({ color: claro ? 0x3a4046 : 0x060d0b, side: THREE.BackSide }),
  ));
  const plano = new THREE.PlaneGeometry(1, 1);
  const panel = (w, h, color, k, x, y, z) => {
    const m = new THREE.Mesh(plano, new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide,
    }));
    m.scale.set(w, h, 1);
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(14, 4, 0xffffff, 5.0, 0, 12, 2);      // softbox cenital
  panel(1.4, 16, 0xffffff, 6.0, -10, 0, 4);   // tira izquierda
  panel(1.0, 16, 0xffffff, 3.5, 10, 2, 6);    // tira derecha
  // rebotes de color para los cristales; el robot va en blanco y gris, como su retrato
  panel(9, 9, claro ? 0xb8bcc2 : 0x5dffc4, claro ? 1.2 : 2.4, -8, -2, -10);   // rebote menta
  panel(9, 9, claro ? 0x9ea3aa : 0x9b7bff, claro ? 1.0 : 3.0, 9, -3, -8);     // rebote violeta
  panel(22, 3, 0xffffff, 1.0, 0, -10, 0);     // suelo claro
  panel(4, 3, 0xffe2bd, 2.2, 4, 4, 12);       // luz principal cálida, de frente
  panel(2, 6, 0xffffff, 2.0, -5, -1, 11);     // relleno frontal
  panel(10, 2.5, 0x9fb4c8, 0.6, 0, 1.5, 13);  // franja tenue al frente: lo que refleja la visera
  if (claro) {                                // cajas de luz grandes alrededor, como en un plató de producto
    panel(18, 9, 0xffffff, 1.5, 0, 3, 14);
    panel(9, 16, 0xffffff, 1.1, -13, 0, 2);
    panel(9, 16, 0xffffff, 0.9, 13, 0, 2);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return tex;
}
const entorno = crearEntorno();
scene.environment = entorno;
const escenaRobot = new THREE.Scene();   // se pinta aparte, en robotRT
escenaRobot.environment = crearEntorno(true);

// ── Materiales ─────────────────────────────────────────────────
const cromo = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.06, envMapIntensity: 1.25 });
const titanio = new THREE.MeshPhysicalMaterial({
  color: 0x8e98a6, metalness: 1, roughness: 0.22,
  clearcoat: 1, clearcoatRoughness: 0.06,
  iridescence: 0.95, iridescenceIOR: 1.8, iridescenceThicknessRange: [180, 640],
  envMapIntensity: 1.15,
});
const VIOLETA = new THREE.Color(0xb9a4ff);
const MENTA = new THREE.Color(0x8dffd2);

function texturaHalo() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const halo = texturaHalo();
const crearHalo = (color, escala) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: halo, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false,
  }));
  s.scale.setScalar(escala);
  return s;
};

// ── Robot: el androide en 3D ───────────────────────────────────
// Modelo generado a partir de su versión androide (dev/generar_modelo.py, Hunyuan3D v2):
// el que sale de ella al bajar es el mismo personaje que se destapa en el inicio.
const ALTO_MODELO = 3;               // se normaliza a 3 de alto (lo que medía el robot anterior)
// qué parte del retrato ocupa el modelo (fracciones del alto de la imagen): el busto
// recortado va de la coronilla (0.231) al borde de abajo del recorte (0.78)
const BUSTO = { arriba: 0.231, abajo: 0.78, x: 0.5 };
const robot = new THREE.Group();
escenaRobot.add(robot);
const centro = new THREE.Group();
robot.add(centro);
const cabeza = new THREE.Group();    // gira hacia el cursor, con el modelo dentro
centro.add(cabeza);
const torso = new THREE.Group();     // la coreografía lo escala; aquí va vacío
centro.add(torso);
const listaOjos = [];
const anillosOreja = [];
const ojoMat = new THREE.MeshBasicMaterial({ color: VIOLETA.clone(), toneMapped: false });
const haloPunta = crearHalo(VIOLETA.clone(), 0.7);
haloPunta.visible = false;
// brillo tenue detrás de las gafas: violeta en reposo, menta al despertar
const halosOjos = [-0.3, 0.3].map((x) => {
  const h = crearHalo(VIOLETA.clone(), 0.28);
  h.position.set(x, 0.69, 0.78);
  cabeza.add(h);
  return h;
});
new GLTFLoader().loadAsync('assets/modelos/androide.glb').then((gltf) => {
  const m = gltf.scene;
  const caja = new THREE.Box3().setFromObject(m);
  const tam = caja.getSize(new THREE.Vector3());
  m.position.sub(caja.getCenter(new THREE.Vector3()));
  const normal = new THREE.Group();
  normal.scale.setScalar(ALTO_MODELO / tam.y);
  normal.add(m);
  m.traverse((o) => {
    if (!o.isMesh) return;
    // la textura trae el color en gris mate; como metal pulido refleja el estudio de luz
    // de verdad y se ve cromo nítido (los negros siguen negros: gafas, juntas)
    o.material.metalness = 0.92;
    o.material.roughness = 0.17;
    o.material.envMapIntensity = 1.25;
    if (o.material.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    // el busto se desvanece del cuello para abajo: sin corte recto ni camiseta de cromo
    // (alturas del modelo tal como viene, de -0.49 a 0.49)
    o.material.transparent = true;
    o.material.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vAlturaObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlturaObj = position.y;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlturaObj;')
        .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\ndiffuseColor.a *= smoothstep(-0.36, -0.2, vAlturaObj);');
    };
  });
  cabeza.add(normal);
}).catch(() => { robot.visible = false; });

// órbitas de datos alrededor de la cabeza
const orbitas = [];
[[1.75, [1.25, 0.35, 0]], [2.05, [-1.05, -0.45, 0.4]]].forEach(([radio, rot], i) => {
  const anillo = new THREE.Mesh(new THREE.TorusGeometry(radio, 0.016, 12, 320), cromo);
  anillo.rotation.set(...rot);
  anillo.position.y = 0.15;
  const perla = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshBasicMaterial({ color: (i ? VIOLETA : MENTA).clone().lerp(new THREE.Color(0xffffff), 0.6), toneMapped: false }));
  perla.position.x = radio;
  const h = crearHalo((i ? VIOLETA : MENTA).clone().lerp(new THREE.Color(0xffffff), 0.5).multiplyScalar(0.5), 0.35);
  h.position.x = radio;
  anillo.add(perla, h);
  robot.add(anillo);
  orbitas.push(anillo);
});

// luces que acompañan al robot sin girar con él
const aparejo = new THREE.Group();
escenaRobot.add(aparejo);
const clave = new THREE.DirectionalLight(0xffffff, 1.4);
clave.position.set(3, 5, 6);
escenaRobot.add(clave);
const clave2 = clave.clone();            // la misma luz para los cristales
scene.add(clave2);
const rimA = new THREE.PointLight(0xe4ecff, 16, 20, 2);   // contraluces neutros: frío y cálido
rimA.position.set(-4, 2.5, -2.5);
const rimB = new THREE.PointLight(0xfff0e0, 14, 20, 2);
rimB.position.set(4, -2, -2.5);
const luzTono = new THREE.PointLight(0xffffff, 0, 14, 2);
luzTono.position.set(0, 1.5, 4);
aparejo.add(rimA, rimB, luzTono);

// ── Cristales de obsidiana ─────────────────────────────────────
const N = movil ? 18 : 38;
const obsidiana = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0, roughness: 0.0, flatShading: true,
  transmission: 1, thickness: 1.4, ior: 1.7, dispersion: 5,
  attenuationColor: new THREE.Color(0x163a33), attenuationDistance: 0.55,
  iridescence: 0.35, iridescenceIOR: 1.4, iridescenceThicknessRange: [150, 450],
  specularIntensity: 1, envMapIntensity: 1.3,
});
const cristales = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), obsidiana, N);
cristales.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(cristales);
const datos = [];
const rnd = (a, b) => a + Math.random() * (b - a);
for (let i = 0; i < N; i++) {
  const z = rnd(-13, 2.2);
  const prof = (9 - z) / 9;            // 1 = plano del robot
  let x = rnd(-1, 1) * 9 * prof;
  if (Math.abs(x) < 2.2 * prof && z > -4) x += Math.sign(x || 1) * 2.4;
  datos.push({
    x, y: rnd(-1, 1), z, prof,
    s: rnd(0.1, 0.34) * (z > 0 ? 0.6 : 1),
    rx: rnd(0, 6), ry: rnd(0, 6), vx: rnd(-0.4, 0.4), vy: rnd(-0.5, 0.5),
    dir: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-0.3, 0.3)).normalize(),
  });
}
const tmp = new THREE.Object3D();

// ── Polvo de datos ─────────────────────────────────────────────
const M = movil ? 900 : 2200;
const pos = new Float32Array(M * 3);
const semilla = new Float32Array(M);
const colorP = new Float32Array(M * 3);
for (let i = 0; i < M; i++) {
  pos.set([rnd(-15, 15), rnd(-9, 9), rnd(-16, 4)], i * 3);
  semilla[i] = Math.random();
  const c = Math.random() < 0.55 ? MENTA : (Math.random() < 0.6 ? VIOLETA : new THREE.Color(0xe8efe9));
  colorP.set([c.r, c.g, c.b], i * 3);
}
const polvoGeo = new THREE.BufferGeometry();
polvoGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
polvoGeo.setAttribute('aSeed', new THREE.BufferAttribute(semilla, 1));
polvoGeo.setAttribute('aColor', new THREE.BufferAttribute(colorP, 3));
const polvoMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uScroll: { value: 0 }, uPR: { value: dpr }, uSpan: { value: 18 } },
  vertexShader: /* glsl */`
    attribute float aSeed; attribute vec3 aColor;
    uniform float uTime, uScroll, uPR, uSpan;
    varying float vA; varying vec3 vC;
    void main() {
      vec3 p = position;
      p.y = mod(p.y + uScroll * (0.4 + aSeed * 0.8) + uSpan * 0.5, uSpan) - uSpan * 0.5;
      p.x += sin(uTime * 0.2 + aSeed * 30.0) * 0.18;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (1.0 + aSeed * 2.6) * uPR * (9.0 / -mv.z);
      vA = 0.25 + 0.75 * abs(sin(uTime * (0.5 + aSeed) + aSeed * 40.0));
      vC = aColor;
    }`,
  fragmentShader: /* glsl */`
    varying float vA; varying vec3 vC;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d) * vA;
      gl_FragColor = vec4(vC * a, a * 0.35);
    }`,
});
scene.add(new THREE.Points(polvoGeo, polvoMat));

// ── Foto en holograma ──────────────────────────────────────────
const hueco = document.getElementById('foto-slot');
const fotoPct = document.getElementById('foto-pct');
let foto = null;           // malla cuando la foto existe
const fotoU = {
  uTex: { value: null }, uTime: { value: 0 }, uReveal: { value: 0 }, uHover: { value: 0 },
  uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uCover: { value: new THREE.Vector2(1, 1) },
  uAspect: { value: 0.8 }, uTint: { value: MENTA.clone() },
};
function montarFoto(img) {
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.NoColorSpace;   // se muestra tal cual, sin conversión
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
  fotoU.uTex.value = tex;
  fotoU.uImg = img.naturalWidth / img.naturalHeight;
  foto = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 40, 50), new THREE.ShaderMaterial({
    transparent: true, uniforms: fotoU,
    vertexShader: /* glsl */`
      uniform float uTime, uHover, uReveal; uniform vec2 uMouse;
      varying vec2 vUv; varying float vBulto;
      void main() {
        vUv = uv;
        vec3 p = position;
        float d = distance(uv, uMouse);
        float bulto = smoothstep(0.45, 0.0, d) * uHover;
        p.z += bulto * 0.18;
        p.z += sin(uv.y * 9.0 + uTime * 1.6) * 0.012 * (1.0 - uReveal);
        p.z += sin(uv.x * 3.14159) * 0.04;
        vBulto = bulto;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex; uniform float uTime, uReveal, uHover, uAspect; uniform vec2 uCover; uniform vec3 uTint;
      varying vec2 vUv; varying float vBulto;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float caja(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        vec2 uv = (vUv - 0.5) * uCover + 0.5;
        // frente de descifrado: baja de arriba abajo
        float frente = 1.0 - uReveal * 1.15;
        float dec = smoothstep(frente - 0.02, frente + 0.02, vUv.y);
        // zona cifrada: mosaico que se afina
        float celdas = mix(14.0, 70.0, uReveal);
        vec2 q = (floor(uv * celdas) + 0.5) / celdas;
        vec2 st = mix(q, uv, dec);
        float sep = (1.0 - dec) * 0.01 + 0.006 * uHover + vBulto * 0.01;
        vec3 col;
        col.r = texture2D(uTex, st + vec2(sep, 0.0)).r;
        col.g = texture2D(uTex, st).g;
        col.b = texture2D(uTex, st - vec2(sep, 0.0)).b;
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        float ruido = hash(floor(uv * celdas) + floor(uTime * 8.0));
        vec3 cifrado = uTint * lum * (0.55 + 0.45 * ruido);
        // grano de color fino sobre la foto descifrada
        vec3 claro = col * vec3(0.97, 1.0, 0.99) + vec3(0.0, 0.012, 0.01);
        vec3 c = mix(cifrado, claro, dec);
        // líneas de barrido y línea del frente
        c *= 0.94 + 0.06 * sin(vUv.y * 900.0 + uTime * 6.0);
        c += uTint * smoothstep(0.012, 0.0, abs(vUv.y - frente)) * 1.6 * step(0.001, uReveal) * step(uReveal, 0.98);
        // brillo iridiscente en el borde
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        float d = caja(p, vec2(0.5 * uAspect, 0.5), 0.035);
        float borde = smoothstep(0.012, 0.0, abs(d + 0.004));
        vec3 iris = 0.5 + 0.5 * cos(6.2831 * (vUv.x + vUv.y * 0.5 + uTime * 0.08 + vec3(0.0, 0.33, 0.67)));
        c += iris * borde * 0.55;
        float alfa = smoothstep(0.003, -0.003, d);
        gl_FragColor = vec4(c, alfa);
      }`,
  }));
  scene.add(foto);
  root.classList.add('gl-foto');

  hueco.addEventListener('pointerenter', () => { foto.userData.hover = 1; });
  hueco.addEventListener('pointerleave', () => { foto.userData.hover = 0; });
  hueco.addEventListener('pointermove', (e) => {
    const r = hueco.getBoundingClientRect();
    fotoU.uMouse.value.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
  });
}
const imgFoto = hueco && hueco.querySelector('img');
if (imgFoto) {
  if (imgFoto.complete && imgFoto.naturalWidth) montarFoto(imgFoto);
  else imgFoto.addEventListener('load', () => montarFoto(imgFoto), { once: true });
}

// ── Retrato del inicio ─────────────────────────────────────────
const huecoRetrato = document.getElementById('retrato-slot');
// dónde está su cabeza dentro de retrato.webp (768×1260): ojos en x, y (fracción) y
// alto del casco respecto al alto de la imagen. Si cambias la foto, mide de nuevo.
const CABEZA = { x: 0.514, y: 0.373, alto: 0.43 };
let retrato = null;
const retratoU = {
  uTex: { value: null }, uTexel: { value: new THREE.Vector2() },
  uAndroide: { value: null }, uHayAndroide: { value: 0 },
  uMascara: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
  uHero: { value: 1 }, uTime: { value: 0 }, uAspect: { value: 1 }, uPaso: { value: 0 },
};
function montarRetrato(img) {
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
  retratoU.uTex.value = tex;
  retratoU.uTexel.value.set(1 / img.naturalWidth, 1 / img.naturalHeight);
  retrato = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, premultipliedAlpha: true, uniforms: retratoU,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex, uAndroide, uMascara; uniform vec2 uTexel, uRes;
      uniform float uHayAndroide, uHero, uTime, uAspect, uPaso;   // uPaso: al bajar se vuelve androide un momento
      varying vec2 vUv;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ruido(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0)), f.x), f.y);
      }
      void main() {
        vec4 c = texture2D(uTex, vUv);
        // luz de recorte en la silueta: menta a un lado, violeta al otro (como dos focos de color)
        float vecino = 0.0;
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.7854;
          vecino += texture2D(uTex, vUv + vec2(cos(a), sin(a)) * uTexel * 7.0).a;
        }
        float borde = clamp((c.a - vecino / 8.0) * 2.5, 0.0, 1.0);
        vec3 rim = mix(vec3(0.55, 1.0, 0.82), vec3(0.73, 0.64, 1.0), smoothstep(0.3, 0.7, vUv.x));
        vec4 ella = vec4((c.rgb + rim * borde * 0.5) * c.a, c.a);       // premultiplicado
        // la mancha (en coordenadas de pantalla) destapa al androide, con borde líquido
        vec2 su = gl_FragCoord.xy / uRes;
        float m = texture2D(uMascara, su).r;
        vec2 q = su * vec2(uAspect, 1.0);
        float n = ruido(q * 7.0 + uTime * 0.5) * 0.6 + ruido(q * 16.0 - uTime * 0.35) * 0.4;
        float campo = m + (n - 0.5) * 0.5;
        float tapa = uHayAndroide * uHero;
        float liquido = max(smoothstep(0.46, 0.54, campo) * tapa, uPaso * uHayAndroide);
        vec4 an = texture2D(uAndroide, vUv);
        vec4 res = mix(ella, vec4(an.rgb * an.a, an.a), liquido);
        float filo = clamp(smoothstep(0.41, 0.47, campo) - smoothstep(0.46, 0.54, campo), 0.0, 1.0) * tapa * max(c.a, an.a);
        res += vec4(vec3(0.45, 1.0, 0.75), 1.0) * filo * 0.4;
        float fundido = smoothstep(0.0, 0.14, vUv.y);    // se funde con el fondo por abajo
        gl_FragColor = res * fundido;
      }`,
  }));
  scene.add(retrato);
  root.classList.add('gl-retrato');
  medir();
}
const imgRetrato = huecoRetrato && huecoRetrato.querySelector('img:not(.hero__androide)');
const imgAndroide = huecoRetrato && huecoRetrato.querySelector('img.hero__androide');
function montarAndroide(img) {
  const tex = new THREE.Texture(img);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.needsUpdate = true;
  retratoU.uAndroide.value = tex;
  retratoU.uHayAndroide.value = 1;
}

// ── Máscara líquida que deja el cursor ─────────────────────────
const vertPantalla = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const camPantalla = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const opcMascara = { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
let mascaraA = new THREE.WebGLRenderTarget(4, 4, opcMascara);
let mascaraB = new THREE.WebGLRenderTarget(4, 4, opcMascara);
const mascaraU = {
  uPrev: { value: null }, uA: { value: new THREE.Vector2(-9, -9) }, uB: { value: new THREE.Vector2(-9, -9) },
  uR: { value: 0.09 }, uAspect: { value: 1 }, uFuerza: { value: 0 },
  uGotas: { value: [new THREE.Vector3(-9, -9, 0), new THREE.Vector3(-9, -9, 0), new THREE.Vector3(-9, -9, 0)] },
};
const escenaMascara = new THREE.Scene();
escenaMascara.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: mascaraU, vertexShader: vertPantalla, depthTest: false, depthWrite: false,
  fragmentShader: /* glsl */`
    uniform sampler2D uPrev; uniform vec2 uA, uB; uniform float uR, uAspect, uFuerza;
    uniform vec3 uGotas[3];                            // x, y, radio de las gotas que van solas
    varying vec2 vUv;
    float segmento(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
      return length(pa - ba * h);
    }
    void main() {
      float antes = texture2D(uPrev, vUv).r;
      antes = max(antes * 0.986 - 0.0035, 0.0);         // se va borrando sola (unos 2 s)
      vec2 k = vec2(uAspect, 1.0);
      float d = segmento(vUv * k, uA * k, uB * k);       // trazo entre el cuadro anterior y este
      float pincel = smoothstep(uR, uR * 0.15, d) * uFuerza;
      for (int i = 0; i < 3; i++) {
        float dg = length(vUv * k - uGotas[i].xy * k);
        pincel = max(pincel, smoothstep(uGotas[i].z, uGotas[i].z * 0.1, dg));
      }
      gl_FragColor = vec4(vec3(max(antes, pincel)), 1.0);
    }`,
})));
const pincel = { x: -9, y: -9, px: -9, py: -9, raton: false, toque: 0, extra: 0 };
addEventListener('pointermove', (e) => {
  pincel.x = e.clientX / innerWidth;
  pincel.y = 1 - e.clientY / innerHeight;
  if (e.pointerType === 'mouse') pincel.raton = true;
}, { passive: true });
addEventListener('pointerdown', (e) => {
  pincel.x = pincel.px = e.clientX / innerWidth;
  pincel.y = pincel.py = 1 - e.clientY / innerHeight;
  if (e.pointerType !== 'mouse') pincel.toque = 1;     // «toca para mirar»
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { pincel.raton = false; });

// ── Composición: el robot por encima, a través de la máscara ───
const flotante = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
const robotRT = new THREE.WebGLRenderTarget(4, 4, { type: flotante ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 4 });
const compU = {
  uRobot: { value: robotRT.texture }, uMascara: { value: mascaraA.texture },
  uHero: { value: 1 }, uTime: { value: 0 }, uAspect: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) },
};
const comp = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: compU, transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true,
  vertexShader: vertPantalla,
  fragmentShader: /* glsl */`
    uniform sampler2D uRobot, uMascara; uniform float uHero, uTime, uAspect; uniform vec2 uRes;
    varying vec2 vUv;
    float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float ruido(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0)), f.x), f.y);
    }
    void main() {
      vec4 r = texture2D(uRobot, vUv);
      float m = texture2D(uMascara, vUv).r;
      vec2 q = vUv * vec2(uAspect, 1.0);
      float n = ruido(q * 7.0 + uTime * 0.5) * 0.6 + ruido(q * 16.0 - uTime * 0.35) * 0.4;
      float campo = m + (n - 0.5) * 0.5;
      float liquido = smoothstep(0.46, 0.54, campo);              // borde orgánico de la mancha
      float ver = smoothstep(0.16, 0.28, 1.0 - uHero);    // aparece encima del androide plano, al bajar
      gl_FragColor = vec4(r.rgb * ver, r.a * ver);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
comp.frustumCulled = false;
comp.renderOrder = 1000;
scene.add(comp);

function tamanos() {
  const w = Math.floor(innerWidth * dpr), h = Math.floor(innerHeight * dpr);
  robotRT.setSize(w, h);
  compU.uRes.value.set(w, h);
  retratoU.uRes.value.set(w, h);
  compU.uAspect.value = mascaraU.uAspect.value = innerWidth / innerHeight;
  mascaraA.setSize(Math.ceil(innerWidth / 2), Math.ceil(innerHeight / 2));
  mascaraB.setSize(Math.ceil(innerWidth / 2), Math.ceil(innerHeight / 2));
}
tamanos();

// ── Fotogramas clave por sección ───────────────────────────────
// x, y en fracción de media pantalla (-1…1); s escala; ry giro del cuerpo (positivo = mira a la derecha);
// u despertar (0 en reposo, 1 activo: HUD y «Acceso concedido»); sp dispersión de los cristales
const CLAVES = [
  { id: 'inicio', retrato: true, x: 0, y: -0.02, s: 1.3, ry: 0, rx: 0, u: 0, sp: 1, m: { s: 0.58, y: -0.34 } },
  { id: 'acceso', x: 0.5, y: -0.04, s: 0.85, ry: -0.55, rx: 0.05, u: 1, sp: 1.15, m: { x: 0.45, y: 0.52, s: 0.4 } },
  { id: 'sobre-mi', x: 0.62, y: -0.05, s: 0.7, ry: -0.6, rx: 0, u: 1, sp: 1.3, foto: { s: 0.34 }, m: { x: 0.5, y: 0.6, s: 0.35 } },
  { id: 'arsenal', hold: true, x: 0.3, y: 0, s: 0.8, ry: 0.35, rx: 0.1, u: 1, sp: 1.8, m: { x: 0, y: 0, s: 0.6 } },
  { id: 'proyectos', x: 0.84, y: 0, s: 0.42, ry: -0.7, rx: 0.05, u: 1, sp: 1.2, m: { x: 0.6, y: 0.6, s: 0.35 } },
  { id: 'trayectoria', x: -0.55, y: -0.35, s: 0.55, ry: 0.6, rx: -0.05, u: 1, sp: 1, m: { x: 0.6, y: 0.62, s: 0.35 } },
  { id: 'contacto', fin: true, x: 0, y: 0.05, s: 1.15, ry: Math.PI * 2, rx: 0.04, u: 1, sp: 0.8, m: { x: 0.42, y: 0.6, s: 0.36 } },
];
const PROPS = ['x', 'y', 's', 'ry', 'rx', 'u', 'sp'];
let claves = [];
const estrecho = () => innerWidth / innerHeight < 0.9;

function medir() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const est = estrecho();
  const lista = [];
  for (const k of CLAVES) {
    const el = document.getElementById(k.id);
    if (!el) continue;
    const caja = el.closest('.pin-spacer') || el;
    const r = caja.getBoundingClientRect();
    const top = r.top + scrollY;
    const base = est ? { ...k, ...k.m } : { ...k };
    if (k.id === 'inicio') lista.push({ ...base, pos: 0 });
    else if (k.fin) lista.push({ ...base, pos: max });
    else if (k.hold) {
      lista.push({ ...base, pos: top });
      lista.push({ ...base, pos: top + r.height - innerHeight });
    } else lista.push({ ...base, pos: top + r.height / 2 - innerHeight / 2 });
  }
  lista.forEach((k) => { k.pos = Math.max(0, Math.min(max, k.pos)); });
  for (let i = 1; i < lista.length; i++) lista[i].pos = Math.max(lista[i].pos, lista[i - 1].pos + 1);
  claves = lista;
}

// el fotograma «inicio» encaja el modelo justo encima del androide del retrato
function anclarARetrato(k) {
  if (!k.retrato || !retrato) return k;
  const r = huecoRetrato.getBoundingClientRect();
  const medH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const medW = medH * camera.aspect;
  const s = ((r.height / innerHeight) * 2 * medH * (BUSTO.abajo - BUSTO.arriba)) / ALTO_MODELO;
  const x = (((r.left + r.width * BUSTO.x) / innerWidth) * 2 - 1) * medW;
  const y = -(((r.top + r.height * (BUSTO.arriba + BUSTO.abajo) / 2) / innerHeight) * 2 - 1) * medH;
  return { ...k, x: x / medW, y: y / medH, s };
}

// el fotograma «sobre-mi» se ancla a la esquina de la foto, que es sticky
function anclarAFoto(k) {
  if (!k.foto || !foto) return k;
  const r = hueco.getBoundingClientRect();
  return {
    ...k,
    x: (r.left / innerWidth) * 2 - 1 + 0.03,
    y: -((r.bottom / innerHeight) * 2 - 1) + 0.12,
    s: estrecho() ? 0.3 : k.foto.s,
  };
}

const objetivo = {};
function muestrear(y) {
  if (!claves.length) return Object.assign(objetivo, CLAVES[0]);
  let a = claves[0], b = claves[0], t = 0;
  if (y >= claves[claves.length - 1].pos) a = b = claves[claves.length - 1];
  else if (y > claves[0].pos) {
    for (let i = 0; i < claves.length - 1; i++) {
      if (y <= claves[i + 1].pos) {
        a = claves[i]; b = claves[i + 1];
        t = (y - a.pos) / (b.pos - a.pos);
        break;
      }
    }
  }
  a = anclarAFoto(anclarARetrato(a)); b = anclarAFoto(anclarARetrato(b));
  t = t * t * (3 - 2 * t);
  for (const p of PROPS) objetivo[p] = a[p] + (b[p] - a[p]) * t;
  return objetivo;
}

// ── Interacción ────────────────────────────────────────────────
const raton = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', (e) => {
  raton.tx = (e.clientX / innerWidth) * 2 - 1;
  raton.ty = -((e.clientY / innerHeight) * 2 - 1);
}, { passive: true });

let tonoObj = 0;
const tonoColor = new THREE.Color();
let estallido = 0;
let giroExtra = 0, giroExtraObj = 0;
window.__escena = {
  tono(hex) {
    if (hex) { tonoColor.set(hex); luzTono.color.set(hex); tonoObj = 1; giroExtraObj += 0.5; }
    else tonoObj = 0;
  },
  estallido() { estallido = 1; giroExtraObj += Math.PI * 2; },
  medir,
};

// ── Bucle ──────────────────────────────────────────────────────
const actual = { ...CLAVES[0] };
const reloj = new THREE.Clock();
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let abierto = false;
let proximoParpadeo = 2;
let tonoAct = 0;
const hudLock = document.getElementById('hud-lock');
const chip = document.getElementById('chip-estado');
let muestras = 0, sumaDt = 0, ajustado = false;
let heroF = 1;          // 1 = arriba del todo (el robot hace de casco), 0 = ya se ha bajado

function cuadro() {
  const dt = Math.min(reloj.getDelta(), 0.05);
  const t = reloj.elapsedTime;
  const k = 1 - Math.exp(-dt * 5);

  // si el equipo va justo, se baja la resolución una vez
  if (!ajustado && t > 5 && !document.getElementById('pre')) {
    sumaDt += dt; muestras++;
    if (muestras === 90) {
      ajustado = true;
      if (sumaDt / muestras > 1 / 30 && dpr > 1) { dpr = 1; renderer.setPixelRatio(1); polvoMat.uniforms.uPR.value = 1; tamanos(); }
    }
  }

  raton.x += (raton.tx - raton.x) * k;
  raton.y += (raton.ty - raton.y) * k;
  const heroObj = Math.max(0, 1 - scrollY / (innerHeight * 0.55));
  heroF += (heroObj - heroF) * (1 - Math.exp(-dt * 8));
  const obj = muestrear(scrollY);
  // con el casco puesto va pegado a su cabeza (sin retardo); después, con suavidad
  let sigue = 1 - Math.exp(-dt * 6);
  sigue += (1 - sigue) * Math.pow(heroObj, 4);
  for (const p of PROPS) actual[p] += (obj[p] - actual[p]) * sigue;
  giroExtra += (giroExtraObj - giroExtra) * (1 - Math.exp(-dt * 3));
  estallido *= Math.exp(-dt * 1.6);
  tonoAct += (tonoObj - tonoAct) * k;

  const medH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const medW = medH * camera.aspect;
  const libre = 1 - heroF;               // cuánto se mueve por su cuenta (nada mientras es casco)
  const flota = reduce ? 0 : Math.sin(t * 0.9) * 0.06 * libre;

  robot.position.set(actual.x * medW + raton.x * 0.12 * libre, actual.y * medH + flota, 0);
  robot.rotation.set(actual.rx, actual.ry + giroExtra, reduce ? 0 : Math.sin(t * 0.5) * 0.015 * libre);
  robot.scale.setScalar(actual.s);
  aparejo.position.copy(robot.position);
  aparejo.scale.setScalar(Math.max(0.5, actual.s));

  // la cabeza sigue al cursor (con un pequeño balanceo propio)
  cabeza.rotation.set(
    (-raton.y * 0.32 + (reduce ? 0 : Math.sin(t * 0.6) * 0.03)) * libre,
    (raton.x * 0.6 + (reduce ? 0 : Math.sin(t * 0.37) * 0.05)) * libre,
    -raton.x * 0.06 * libre,
  );
  // el cuerpo y las órbitas salen cuando se le quita de la cabeza
  const crece = Math.max(0.0001, suave(0.05, 0.9, libre));
  torso.scale.setScalar(crece);
  torso.visible = crece > 0.01;

  // parpadeo cada pocos segundos
  if (t > proximoParpadeo + 0.18) proximoParpadeo = t + 2.5 + Math.random() * 3.5;
  const fase = (t - proximoParpadeo) / 0.18;
  const parpado = !reduce && fase > 0 && fase < 1 ? 1 - Math.sin(fase * Math.PI) * 0.92 : 1;
  listaOjos.forEach((o) => { o.scale.y = parpado; });

  // despertar: color de ojos, antena y orejas
  const u = Math.min(1, Math.max(0, actual.u));
  const cOjo = VIOLETA.clone().lerp(MENTA, suave(0.3, 0.9, u)).lerp(tonoColor, tonoAct * 0.85);
  ojoMat.color.copy(cOjo);
  halosOjos.forEach((h) => { h.visible = false; });   // sin brillo: el androide de su retrato no lo tiene
  haloPunta.material.color.copy(cOjo).multiplyScalar(0.6 + 0.4 * Math.sin(t * 3));
  anillosOreja.forEach((a) => a.material.color.copy(cOjo).multiplyScalar(0.55 + 0.45 * Math.sin(t * 1.4)));
  luzTono.intensity = tonoAct * 70;

  const ahoraAbierto = u > 0.6;
  if (ahoraAbierto !== abierto) {
    abierto = ahoraAbierto;
    root.classList.toggle('is-unlocked', abierto);
    if (hudLock) hudLock.textContent = abierto ? 'Activo' : 'En reposo';
    if (chip && window.__descifrar) {
      chip.dataset.final = abierto ? 'Acceso concedido' : 'Verificando';
      window.__descifrar(chip);
    }
  }

  orbitas.forEach((o, i) => {
    if (!reduce) o.rotation.z = t * (i ? -0.35 : 0.5);
    o.scale.setScalar(crece);
    o.visible = crece > 0.01;
  });

  // cristales: suben con el scroll a distinta velocidad según la profundidad
  const subir = scrollY * 0.0016;
  const spanY = medH * 2.6;
  for (let i = 0; i < N; i++) {
    const d = datos[i];
    const alto = spanY * d.prof;
    let y = d.y * alto * 0.5 + subir * (0.5 + 1.2 / d.prof);
    y = ((y + alto * 0.5) % alto + alto) % alto - alto * 0.5;
    const ex = estallido * 4;
    tmp.position.set(d.x * actual.sp + d.dir.x * ex, y + d.dir.y * ex, d.z + d.dir.z * ex);
    tmp.rotation.set(d.rx + t * d.vx, d.ry + t * d.vy, 0);
    tmp.scale.set(d.s, d.s * 1.7, d.s);
    tmp.updateMatrix();
    cristales.setMatrixAt(i, tmp.matrix);
  }
  cristales.instanceMatrix.needsUpdate = true;

  polvoMat.uniforms.uTime.value = t;
  polvoMat.uniforms.uScroll.value = scrollY * 0.004;

  // la foto sigue a su hueco del HTML
  if (foto) {
    const r = hueco.getBoundingClientRect();
    const visible = r.bottom > -50 && r.top < innerHeight + 50 && r.width > 0;
    foto.visible = visible;
    if (visible) {
      const w = (r.width / innerWidth) * 2 * medW;
      const h = (r.height / innerHeight) * 2 * medH;
      foto.position.set(((r.left + r.width / 2) / innerWidth * 2 - 1) * medW, -(((r.top + r.height / 2) / innerHeight) * 2 - 1) * medH, 0);
      foto.scale.set(w, h, 1);
      foto.rotation.set(-raton.y * 0.08, raton.x * 0.12, 0);
      fotoU.uAspect.value = w / h;
      const ia = fotoU.uImg, pa = w / h;
      fotoU.uCover.value.set(ia > pa ? pa / ia : 1, ia > pa ? 1 : ia / pa);
      const prog = Math.min(1, Math.max(0, (innerHeight * 0.9 - r.top) / (innerHeight * 0.6)));
      fotoU.uReveal.value += (prog - fotoU.uReveal.value) * (1 - Math.exp(-dt * 4));
      fotoU.uHover.value += ((foto.userData.hover || 0) - fotoU.uHover.value) * k;
      fotoU.uTime.value = t;
      fotoU.uTint.value.copy(MENTA).lerp(tonoColor, tonoAct);
      if (fotoPct) fotoPct.textContent = String(Math.round(fotoU.uReveal.value * 100)).padStart(3, '0') + '%';
    }
  }

  // el retrato sigue a su hueco del HTML
  if (retrato) {
    const r = huecoRetrato.getBoundingClientRect();
    retrato.visible = r.bottom > 0 && r.top < innerHeight;
    if (retrato.visible) {
      retrato.position.set(((r.left + r.width / 2) / innerWidth * 2 - 1) * medW, -(((r.top + r.height / 2) / innerHeight) * 2 - 1) * medH, -0.01);
      retrato.scale.set((r.width / innerWidth) * 2 * medW, (r.height / innerHeight) * 2 * medH, 1);
    }
  }

  // 1) el robot, a su textura
  renderer.setRenderTarget(robotRT);
  renderer.render(escenaRobot, camera);

  // 2) la mancha del cursor (solo mientras hace de casco)
  if (heroF > 0.01) {
    if (pincel.px < -1) { pincel.px = pincel.x; pincel.py = pincel.y; }
    pincel.toque = Math.max(0, pincel.toque - dt * 0.45);
    mascaraU.uA.value.set(pincel.px, pincel.py);
    mascaraU.uB.value.set(pincel.x, pincel.y);
    const velocidad = Math.hypot(pincel.x - pincel.px, pincel.y - pincel.py) / Math.max(dt, 1 / 120);
    pincel.extra += (Math.min(velocidad * 0.03, 0.06) - pincel.extra) * k;   // crece al mover rápido
    mascaraU.uR.value = pincel.toque > 0 ? 0.16 + 0.08 * pincel.toque : 0.13 + pincel.extra;
    mascaraU.uFuerza.value = (pincel.raton || pincel.toque > 0) && !reduce ? 1 : 0;
    // gotas que se pasean solas por su cabeza: aparecen, recorren un trozo y se apagan
    const rc = huecoRetrato.getBoundingClientRect();
    const cx = (rc.left + rc.width * CABEZA.x) / innerWidth;
    const cy = 1 - (rc.top + rc.height * (CABEZA.y - 0.02)) / innerHeight;
    const rad = (rc.height * CABEZA.alto * 0.5) / innerHeight;           // radio de la cabeza, en alto de pantalla
    const asp = innerWidth / innerHeight;
    mascaraU.uGotas.value.forEach((g, i) => {
      if (reduce || !retrato) { g.set(-9, -9, 0); return; }
      const f = i * 2.1;
      const vida = Math.max(0, Math.sin(t * (0.45 + i * 0.12) + f));     // 0 → 1 → 0, a ratos
      g.set(
        cx + (Math.sin(t * (0.53 + i * 0.17) + f) * 0.62 * rad) / asp,
        cy + Math.cos(t * (0.41 + i * 0.13) + f * 1.3) * 0.7 * rad,
        rad * (0.09 + 0.05 * i / 2) * vida,
      );
    });
    mascaraU.uPrev.value = mascaraA.texture;
    renderer.setRenderTarget(mascaraB);
    renderer.render(escenaMascara, camPantalla);
    [mascaraA, mascaraB] = [mascaraB, mascaraA];
    pincel.px = pincel.x; pincel.py = pincel.y;
  }
  compU.uMascara.value = mascaraA.texture;
  retratoU.uMascara.value = mascaraA.texture;
  retratoU.uHero.value = heroF;
  // 0 → 1 al empezar a bajar (ella se vuelve androide) y 1 → 0 cuando el 3D ya está encima
  const baja = 1 - heroF;
  retratoU.uPaso.value = suave(0.02, 0.18, baja) * (1 - suave(0.28, 0.4, baja));
  retratoU.uTime.value = t;
  retratoU.uAspect.value = innerWidth / innerHeight;
  compU.uHero.value = heroF;
  compU.uTime.value = t;

  // 3) la página, con el robot compuesto encima
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
}

// ── Arranque ───────────────────────────────────────────────────
function alRedimensionar() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  tamanos();
  medir();
}
let espera;
addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(alRedimensionar, 120); });
if (window.ScrollTrigger) window.ScrollTrigger.addEventListener('refresh', medir);
addEventListener('load', medir);
medir();

if (imgRetrato) {
  if (imgRetrato.complete && imgRetrato.naturalWidth) montarRetrato(imgRetrato);
  else imgRetrato.addEventListener('load', () => montarRetrato(imgRetrato), { once: true });
}
if (imgAndroide) {
  if (imgAndroide.complete && imgAndroide.naturalWidth) montarAndroide(imgAndroide);
  else imgAndroide.addEventListener('load', () => montarAndroide(imgAndroide), { once: true });
}
renderer.compile(escenaRobot, camera);
renderer.compile(scene, camera);
cuadro();
avisarLista();
// mismo reloj que Lenis (GSAP) para que la foto no tiemble respecto al HTML
if (window.gsap) window.gsap.ticker.add(cuadro);
else renderer.setAnimationLoop(cuadro);
