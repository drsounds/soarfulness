import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";

export const Route = createFileRoute("/")({
  component: Aquafulness,
  head: () => ({
    meta: [
      { title: "Aquafulness — Ocean Wave Meditation" },
      {
        name: "description",
        content:
          "A calming WebGL ocean where the camera drifts on the waves. Adjust swell, time of day, and wander across the sea.",
      },
      { property: "og:title", content: "Aquafulness — Ocean Wave Meditation" },
      {
        property: "og:description",
        content: "A calming WebGL ocean where the camera drifts on the waves. Adjust swell, time of day, and wander across the sea.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

// Gerstner-like sum of sines. Keep in sync with vertex shader.
function waveHeight(x: number, z: number, t: number, amp: number) {
  const w1 = Math.sin(x * 0.12 + t * 0.9) * 1.0;
  const w2 = Math.sin(z * 0.17 + t * 0.7 + 1.3) * 0.75;
  const w3 = Math.sin((x * 0.22 + z * 0.19) + t * 1.4 + 2.1) * 0.5;
  const w4 = Math.sin((x * 0.31 - z * 0.11) + t * 1.8 + 0.4) * 0.35;
  return (w1 + w2 + w3 + w4) * amp;
}

function Aquafulness() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [waveAmp, setWaveAmp] = useState(0.6);
  const [timeOfDay, setTimeOfDay] = useState(0.35);
  const [waveSpeed, setWaveSpeed] = useState(1);
  const [buoyAmp, setBuoyAmp] = useState(1);
  const [heightOffset, setHeightOffset] = useState(1.2);
  // Live joystick vector (visual state) — kept in state so the thumb renders.
  const [stick, setStick] = useState({ x: 0, y: 0 });

  // Live values consumed inside the RAF loop.
  const ampRef = useRef(waveAmp);
  const todRef = useRef(timeOfDay);
  const speedRef = useRef(waveSpeed);
  const buoyRef = useRef(buoyAmp);
  const heightRef = useRef(heightOffset);
  const stickRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, z: 0 });
  useEffect(() => { ampRef.current = waveAmp; }, [waveAmp]);
  useEffect(() => { todRef.current = timeOfDay; }, [timeOfDay]);
  useEffect(() => { speedRef.current = waveSpeed; }, [waveSpeed]);
  useEffect(() => { buoyRef.current = buoyAmp; }, [buoyAmp]);
  useEffect(() => { heightRef.current = heightOffset; }, [heightOffset]);
  useEffect(() => { stickRef.current = stick; }, [stick]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x032033, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x88aacc, 0.008);

    const camera = new THREE.PerspectiveCamera(
      65,
      mount.clientWidth / mount.clientHeight,
      0.1,
      2000,
    );

    // Ocean plane
    const geo = new THREE.PlaneGeometry(600, 600, 220, 220);
    geo.rotateX(-Math.PI / 2);

    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: waveAmp },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSkyColor: { value: new THREE.Color(0x88aacc) },
      uHorizonColor: { value: new THREE.Color(0xffddaa) },
      uWaterDeep: { value: new THREE.Color(0x022244) },
      uWaterShallow: { value: new THREE.Color(0x2a89b8) },
      uSunColor: { value: new THREE.Color(0xffe6b0) },
      uFogColor: { value: new THREE.Color(0x88aacc) },
    };

    const vertexShader = /* glsl */ `
      uniform float uTime;
      uniform float uAmp;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      float wave(vec3 p, float t, float amp) {
        float w1 = sin(p.x * 0.12 + t * 0.9) * 1.0;
        float w2 = sin(p.z * 0.17 + t * 0.7 + 1.3) * 0.75;
        float w3 = sin((p.x * 0.22 + p.z * 0.19) + t * 1.4 + 2.1) * 0.5;
        float w4 = sin((p.x * 0.31 - p.z * 0.11) + t * 1.8 + 0.4) * 0.35;
        return (w1 + w2 + w3 + w4) * amp;
      }

      void main() {
        vec3 p = position;
        vec4 wpBase = modelMatrix * vec4(p, 1.0);
        float h = wave(wpBase.xyz, uTime, uAmp);
        p.y += h;

        // approximate normal via finite differences
        float e = 0.5;
        float hx = wave(wpBase.xyz + vec3(e, 0.0, 0.0), uTime, uAmp);
        float hz = wave(wpBase.xyz + vec3(0.0, 0.0, e), uTime, uAmp);
        vec3 n = normalize(vec3(h - hx, e, h - hz));

        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vNormal = n;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `;

    const fragmentShader = /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uSkyColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uWaterDeep;
      uniform vec3 uWaterShallow;
      uniform vec3 uSunColor;
      uniform vec3 uFogColor;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // Fresnel
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);

        // Sky reflection color (mix horizon/sky by view angle)
        float upDot = clamp(V.y, 0.0, 1.0);
        vec3 skyRef = mix(uHorizonColor, uSkyColor, upDot);

        // Water base — deeper where facing up (less fresnel)
        vec3 water = mix(uWaterDeep, uWaterShallow, 0.4 + 0.6 * max(N.y, 0.0));

        // Subsurface scattering — light bleeding through wave crests
        float height = clamp((vWorldPos.y + 1.0) / 3.0, 0.0, 1.0);
        vec3 sss = uSunColor * pow(height, 2.0) * 0.35 * clamp(uSunDir.y + 0.2, 0.0, 1.0);
        water += sss;

        // Specular sun glint
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 90.0);
        vec3 sun = uSunColor * spec * clamp(uSunDir.y + 0.2, 0.0, 1.0) * 2.5;

        vec3 col = mix(water, skyRef, fres) + sun;

        // Fog to horizon
        float dist = length(cameraPosition - vWorldPos);
        float fogF = 1.0 - exp(-dist * 0.008);
        col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));

        // Translucency — thinner (higher/steeper) crests let more light through
        float alpha = clamp(0.65 + fres * 0.35 - height * 0.35, 0.4, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ocean = new THREE.Mesh(geo, mat);
    scene.add(ocean);

    // Sky dome
    const skyGeo = new THREE.SphereGeometry(800, 32, 32);
    const skyUniforms = {
      uTop: { value: new THREE.Color(0x88aacc) },
      uBottom: { value: new THREE.Color(0xffddaa) },
      uSunDir: { value: uniforms.uSunDir.value },
      uSunColor: { value: new THREE.Color(0xffe6b0) },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        varying vec3 vDir;
        void main() {
          float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(uBottom, uTop, smoothstep(0.35, 0.75, t));
          float sd = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
          col += uSunColor * pow(sd, 180.0) * 3.0;
          col += uSunColor * pow(sd, 8.0) * 0.15;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Handle resize
    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    // Palette for time of day (t: 0..1, 0=night, 0.25=sunrise, 0.5=noon, 0.75=sunset, 1=night)
    const palette = (t: number) => {
      // sun elevation
      const sunElev = Math.sin(t * Math.PI * 2 - Math.PI / 2); // -1..1..-1
      const sunAz = t * Math.PI * 2;
      const sunDir = new THREE.Vector3(
        Math.cos(sunAz),
        Math.max(sunElev, -0.2),
        Math.sin(sunAz) * 0.5,
      ).normalize();

      // Color stops
      const night = { top: [0.02, 0.03, 0.1], bot: [0.05, 0.08, 0.2], sun: [0.5, 0.6, 0.9] };
      const dawn = { top: [0.35, 0.45, 0.7], bot: [1.0, 0.55, 0.35], sun: [1.0, 0.75, 0.5] };
      const day = { top: [0.4, 0.65, 0.95], bot: [0.75, 0.88, 1.0], sun: [1.0, 0.95, 0.85] };
      const dusk = { top: [0.25, 0.15, 0.4], bot: [1.0, 0.45, 0.3], sun: [1.0, 0.55, 0.35] };

      let a: typeof night, b: typeof night, k: number;
      if (t < 0.25) {
        a = night; b = dawn; k = t / 0.25;
      } else if (t < 0.5) {
        a = dawn; b = day; k = (t - 0.25) / 0.25;
      } else if (t < 0.75) {
        a = day; b = dusk; k = (t - 0.5) / 0.25;
      } else {
        a = dusk; b = night; k = (t - 0.75) / 0.25;
      }
      const lerp = (x: number[], y: number[], k: number) =>
        [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k];
      const top = lerp(a.top, b.top, k);
      const bot = lerp(a.bot, b.bot, k);
      const sun = lerp(a.sun, b.sun, k);

      // water tint
      const waterShallow = [top[0] * 0.4 + 0.1, top[1] * 0.5 + 0.15, top[2] * 0.6 + 0.2];
      const waterDeep = [waterShallow[0] * 0.15, waterShallow[1] * 0.2, waterShallow[2] * 0.35];

      return { top, bot, sun, sunDir, waterShallow, waterDeep };
    };

    let raf = 0;
    let lastMs = performance.now();
    let waveT = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastMs) / 1000, 0.1);
      lastMs = now;
      waveT += dt * speedRef.current;
      const t = waveT;
      uniforms.uTime.value = t;
      uniforms.uAmp.value = ampRef.current;

      const p = palette(todRef.current);
      uniforms.uSunDir.value.copy(p.sunDir);
      uniforms.uSkyColor.value.setRGB(p.top[0], p.top[1], p.top[2]);
      uniforms.uHorizonColor.value.setRGB(p.bot[0], p.bot[1], p.bot[2]);
      uniforms.uSunColor.value.setRGB(p.sun[0], p.sun[1], p.sun[2]);
      uniforms.uWaterShallow.value.setRGB(
        p.waterShallow[0],
        p.waterShallow[1],
        p.waterShallow[2],
      );
      uniforms.uWaterDeep.value.setRGB(p.waterDeep[0], p.waterDeep[1], p.waterDeep[2]);
      uniforms.uFogColor.value.setRGB(p.bot[0], p.bot[1], p.bot[2]);
      skyUniforms.uTop.value.copy(uniforms.uSkyColor.value);
      skyUniforms.uBottom.value.copy(uniforms.uHorizonColor.value);
      skyUniforms.uSunColor.value.copy(uniforms.uSunColor.value);
      (scene.fog as THREE.FogExp2).color.copy(uniforms.uFogColor.value);

      // Apply joystick velocity (game-pad style): stick.y up = forward (-z), x = strafe
      const walkSpeed = 8; // m/s at full deflection
      posRef.current.x += stickRef.current.x * walkSpeed * dt;
      posRef.current.z -= stickRef.current.y * walkSpeed * dt;

      const camX = posRef.current.x;
      const camZ = posRef.current.z;
      const surfaceY = waveHeight(camX, camZ, t, ampRef.current);
      // Buoyancy — extra bobbing/float on top of the wave surface.
      // Faster, multi-frequency motion. Scaled by user-controlled buoyAmp.
      const amp = ampRef.current;
      const b = buoyRef.current;
      const bt = t * speedRef.current; // buoyancy tempo tracks wave speed
      const buoyBob =
        (Math.sin(bt * 2.6) * 0.55 * (0.5 + amp) +
          Math.sin(bt * 1.3 + 1.7) * 0.35 * (0.4 + amp) +
          Math.sin(bt * 4.1 + 0.6) * 0.14) * b;
      const eye = heightRef.current + buoyBob;
      camera.position.set(camX, surfaceY + eye, camZ);
      const lookZ = camZ - 20;
      const lookY = waveHeight(camX, lookZ, t, amp) + 0.4;
      camera.lookAt(camX, lookY, lookZ);

      // pitch + roll from buoyancy and swell + stick strafe lean
      const pitch =
        Math.sin(t * 0.9 + 0.4) * 0.06 * (0.4 + amp) +
        Math.cos(t * 1.4 + 2.1) * 0.03 * (0.3 + amp);
      camera.rotation.x += pitch;
      camera.rotation.z =
        Math.sin(t * 0.6) * 0.07 * amp +
        Math.cos(t * 0.83 + 1.1) * 0.04 * amp -
        stickRef.current.x * 0.08;

      sky.position.copy(camera.position);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
      clock.getDelta();
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      skyGeo.dispose();
      skyMat.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Time-of-day label
  const todLabel = (() => {
    const t = timeOfDay;
    if (t < 0.15 || t > 0.9) return "Natt";
    if (t < 0.3) return "Gryning";
    if (t < 0.45) return "Morgon";
    if (t < 0.6) return "Middag";
    if (t < 0.75) return "Eftermiddag";
    return "Skymning";
  })();

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Top HUD chips — game overlay style */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center gap-3 px-4 pt-4">
        <div className="flex items-baseline gap-3 text-white drop-shadow">
          <span className="text-[10px] font-light tracking-[0.4em] text-white/60">
            AQUAFULNESS
          </span>
        </div>
        <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
          <PadDial
            label="VÅG"
            value={`${waveAmp.toFixed(2)}m`}
            onDec={() => setWaveAmp((v) => Math.max(0, +(v - 0.05).toFixed(2)))}
            onInc={() => setWaveAmp((v) => Math.min(2, +(v + 0.05).toFixed(2)))}
          />
          <PadDial
            label="TID"
            value={todLabel}
            onDec={() => setTimeOfDay((v) => (v - 0.02 + 1) % 1)}
            onInc={() => setTimeOfDay((v) => (v + 0.02) % 1)}
          />
          <PadDial
            label="TEMPO"
            value={`${waveSpeed.toFixed(2)}×`}
            onDec={() => setWaveSpeed((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
            onInc={() => setWaveSpeed((v) => Math.min(3, +(v + 0.1).toFixed(2)))}
          />
          <PadDial
            label="HÖJD"
            value={`${heightOffset >= 0 ? "+" : ""}${heightOffset.toFixed(2)}m`}
            onDec={() => setHeightOffset((v) => Math.max(-5, +(v - 0.2).toFixed(2)))}
            onInc={() => setHeightOffset((v) => Math.min(5, +(v + 0.2).toFixed(2)))}
          />
          <PadDial
            label="GUPP"
            value={`${buoyAmp.toFixed(2)}×`}
            onDec={() => setBuoyAmp((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
            onInc={() => setBuoyAmp((v) => Math.min(4, +(v + 0.1).toFixed(2)))}
          />
        </div>
      </div>

      {/* Left joystick */}
      <Joystick onChange={setStick} value={stick} />

      {/* Right D-pad — hold to drive forward / back */}
      <DPad
        onForward={() => setStick((s) => ({ ...s, y: 1 }))}
        onBack={() => setStick((s) => ({ ...s, y: -1 }))}
        onRelease={() => setStick((s) => ({ ...s, y: 0 }))}
      />
    </main>
  );
}

function PadDial({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/40 p-1 pl-3 backdrop-blur-md">
      <div className="flex min-w-[86px] flex-col items-start leading-tight text-white">
        <span className="text-[9px] font-light tracking-[0.28em] text-white/60">
          {label}
        </span>
        <span className="text-xs font-medium tracking-wider">{value}</span>
      </div>
      <button
        onClick={onDec}
        className="h-7 w-7 rounded-full border border-white/20 bg-white/5 text-white/90 transition active:scale-95 active:bg-white/15"
        aria-label={`${label} minska`}
      >
        −
      </button>
      <button
        onClick={onInc}
        className="h-7 w-7 rounded-full border border-white/20 bg-white/5 text-white/90 transition active:scale-95 active:bg-white/15"
        aria-label={`${label} öka`}
      >
        +
      </button>
    </div>
  );
}

function Joystick({
  onChange,
  value,
}: {
  onChange: (v: { x: number; y: number }) => void;
  value: { x: number; y: number };
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);
  const radius = 56;

  const setFromPointer = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }
    onChange({ x: dx / radius, y: -dy / radius });
  };

  return (
    <div className="pointer-events-none absolute bottom-6 left-6 z-10 select-none">
      <div
        ref={baseRef}
        onPointerDown={(e) => {
          if (activeId.current !== null) return;
          activeId.current = e.pointerId;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          setFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (activeId.current !== e.pointerId) return;
          setFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (activeId.current !== e.pointerId) return;
          activeId.current = null;
          onChange({ x: 0, y: 0 });
        }}
        onPointerCancel={() => {
          activeId.current = null;
          onChange({ x: 0, y: 0 });
        }}
        className="pointer-events-auto relative h-32 w-32 touch-none rounded-full border border-white/20 bg-black/35 backdrop-blur-md"
        style={{ boxShadow: "inset 0 0 40px rgba(255,255,255,0.05)" }}
      >
        <div className="pointer-events-none absolute inset-3 rounded-full border border-white/10" />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-white/30 bg-white/80 shadow-[0_0_24px_rgba(255,255,255,0.35)]"
          style={{
            transform: `translate(calc(-50% + ${value.x * radius}px), calc(-50% + ${-value.y * radius}px))`,
          }}
        />
        <span className="pointer-events-none absolute inset-x-0 top-1 text-center text-[9px] font-light tracking-[0.3em] text-white/50">
          NAV
        </span>
      </div>
    </div>
  );
}

function DPad({
  onForward,
  onBack,
  onRelease,
}: {
  onForward: () => void;
  onBack: () => void;
  onRelease: () => void;
}) {
  const bind = (fn: () => void) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      fn();
    },
    onPointerUp: onRelease,
    onPointerCancel: onRelease,
  });
  return (
    <div className="pointer-events-none absolute bottom-6 right-6 z-10 flex select-none flex-col items-center gap-2">
      <button
        {...bind(onForward)}
        className="pointer-events-auto h-14 w-14 touch-none rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition active:scale-95 active:bg-white/15"
        aria-label="Framåt"
      >
        ▲
      </button>
      <span className="text-[9px] font-light tracking-[0.3em] text-white/50">DRIV</span>
      <button
        {...bind(onBack)}
        className="pointer-events-auto h-14 w-14 touch-none rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition active:scale-95 active:bg-white/15"
        aria-label="Bakåt"
      >
        ▼
      </button>
    </div>
  );
}
