import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
      { property: "og:title", content: "Aquafulness" },
      {
        property: "og:description",
        content: "A calming WebGL ocean where the camera rides the swell.",
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
  // Live joystick vector (visual state) — kept in state so the thumb renders.
  const [stick, setStick] = useState({ x: 0, y: 0 });

  // Live values consumed inside the RAF loop.
  const ampRef = useRef(waveAmp);
  const todRef = useRef(timeOfDay);
  const speedRef = useRef(waveSpeed);
  const stickRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, z: 0 });
  useEffect(() => {
    ampRef.current = waveAmp;
  }, [waveAmp]);
  useEffect(() => {
    todRef.current = timeOfDay;
  }, [timeOfDay]);
  useEffect(() => {
    speedRef.current = waveSpeed;
  }, [waveSpeed]);
  useEffect(() => {
    stickRef.current = stick;
  }, [stick]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
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

        // Specular sun glint
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 90.0);
        vec3 sun = uSunColor * spec * clamp(uSunDir.y + 0.2, 0.0, 1.0) * 2.5;

        vec3 col = mix(water, skyRef, fres) + sun;

        // Fog to horizon
        float dist = length(cameraPosition - vWorldPos);
        float fogF = 1.0 - exp(-dist * 0.008);
        col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
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

      // Camera position: walking along z, riding the wave
      const camX = 0;
      const camZ = posRef.current;
      const surfaceY = waveHeight(camX, camZ, t, ampRef.current);
      camera.position.set(camX, surfaceY + 1.2, camZ);
      // Look slightly forward and toward the horizon, but bobbing with waves
      const lookZ = camZ - 20;
      const lookY = waveHeight(camX, lookZ, t, ampRef.current) + 0.4;
      camera.lookAt(camX, lookY, lookZ);

      // gentle roll
      camera.rotation.z = Math.sin(t * 0.6) * 0.02 * ampRef.current;

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

      {/* Title */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex flex-col items-center px-6 pt-6 text-white">
        <h1 className="text-2xl font-light tracking-[0.3em] drop-shadow-lg">AQUAFULNESS</h1>
        <p className="mt-1 text-xs font-light tracking-[0.25em] text-white/70 drop-shadow">
          ANDAS · LYSSNA · DRIV
        </p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur-md sm:p-5">
          <div className="space-y-4 text-white">
            <Slider
              label="Våghöjd"
              value={waveAmp}
              min={0}
              max={2}
              step={0.01}
              onChange={setWaveAmp}
              display={`${waveAmp.toFixed(2)} m`}
            />
            <Slider
              label="Tid på dygnet"
              value={timeOfDay}
              min={0}
              max={1}
              step={0.001}
              onChange={setTimeOfDay}
              display={todLabel}
            />
            <Slider
              label="Våghastighet"
              value={waveSpeed}
              min={0}
              max={3}
              step={0.01}
              onChange={setWaveSpeed}
              display={`${waveSpeed.toFixed(2)}×`}
            />
            <Slider
              label="Position i vattnet"
              value={position}
              min={-100}
              max={100}
              step={0.5}
              onChange={setPosition}
              display={`${position.toFixed(1)} m`}
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPosition((p) => p - 4)}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 py-2 text-sm font-light tracking-wider text-white/90 transition hover:bg-white/10 active:bg-white/15"
              >
                ← Bakåt
              </button>
              <button
                onClick={() => setPosition((p) => p + 4)}
                className="flex-1 rounded-lg border border-white/20 bg-white/5 py-2 text-sm font-light tracking-wider text-white/90 transition hover:bg-white/10 active:bg-white/15"
              >
                Framåt →
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-light uppercase tracking-[0.2em] text-white/80">
          {label}
        </span>
        <span className="text-xs font-light text-white/60">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="aqua-slider w-full"
      />
    </label>
  );
}
