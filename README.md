# Aquafulness

A calming WebGL ocean where the camera drifts on the waves, built with
three.js.

> **Disclaimer:** Aquafulness is a wellness and relaxation visualization
> grounded in the personal experience and design intuitions of its creator.
> It makes **no medical claims**. It is not a medical device, not a therapy,
> and not a substitute for professional health care. Statements about
> calming, relaxation, or well-being describe design intent and subjective
> experience, not clinically validated outcomes.

## Background

Aquafulness grew out of a case study on the concept of **digital bathing**.
The observation at its core: immersion in warm water is a uniquely
pleasurable and calming activity — it engages multiple senses at once with
sensations of weightlessness, soothing and care, and swimming remains one of
the most popular leisure activities there is. Yet real-world bathing carries
practical downsides — safety, hygiene, access, cost, overcrowding and travel
chief among them — that price or lock many people out of it most of the
time. **Aquafulness asks how much of the pleasure can be delivered with none
of the barriers** — no water, no pool, no travel, at any hour, at near-zero
cost.

The methodology rests on a few core ideas (see [`docs/`](docs/) for the full
treatment):

1. **Seeding.** The feeling of bathing can be induced artificially by
   presenting stimuli the brain already associates with water — imagination,
   sound, sight, and, most effective, the **audiovisual combination**.
2. **The sine oscillation.** The common denominator of everything soothing
   about calm water — the flow you see, the lapping you hear, the swell you
   feel — is proposed to be **sinusoidal oscillation**: smooth, periodic,
   predictable motion that entrains the mind toward the calm state the case
   study coins **"aquaful."**
3. **First-person floating.** The chosen design renders the point of view of
   a bather immersed in warm water, with a camera that rocks the whole
   projection to induce a *kinesthetic* perception of being carried by
   water — the bobbing movement of being cared for.

This repository is "Aquafulness Core" — the WebGL/three.js generation of the
project, built with Lovable. It shares its underlying theory with the
original Godot-based [`drsounds/aquafulness-2028`](https://github.com/drsounds/aquafulness-2028).

## Documentation

| Document | Contents |
|---|---|
| [`docs/README.md`](docs/README.md) | Documentation index |
| [`docs/01-background-and-purpose.md`](docs/01-background-and-purpose.md) | Digital bathing, the case study, seeding, and the "aquaful" state |
| [`docs/02-optic-flow-and-kinesthetics.md`](docs/02-optic-flow-and-kinesthetics.md) | The perceptual design: optic flow, vection and kinesthetic movement |
| [`CAPACITOR_APP.md`](CAPACITOR_APP.md) | Offline Android app (Capacitor) for Google Play distribution |
| [`native/NATIVE_APP.md`](native/NATIVE_APP.md) | Native iOS/Android app (Expo + react-native-webgpu) — status |

## Credits

The optional "REALISTISKA VÅGOR" (realistic waves) ocean waveform is ported
from [drsounds/OceanDemo](https://github.com/drsounds/OceanDemo) — "Port of
the Unity Ocean demo [gasgiant/FFT-Ocean](https://github.com/gasgiant/FFT-Ocean)
in Babylon.js WebGPU", by Popov ([evpopov.com](http://www.evpopov.com/)),
MIT licensed.

That project drives its ocean surface with a full Tessendorf/JONSWAP FFT
simulation running on WebGPU compute shaders. Since this project renders with
three.js's `WebGLRenderer` (no compute-shader/IFFT pipeline available), the
same JONSWAP directional wave spectrum — local wind sea + distant swell,
dispersion relation, cosine-2s directional spreading, TMA shallow-water
correction, short-wave fade, and the three length-scale cascades — is
re-implemented in [`src/lib/ocean/fftOceanSpectrum.ts`](src/lib/ocean/fftOceanSpectrum.ts)
as an analytic sum-of-sinusoids sampled from that same spectrum, rather than
an inverse FFT. See that file's header comment for the full derivation.

## Self-hosting (soarfulness.app.spacify.se)

The production instance runs `serve.mjs` under Bun on the server, behind
nginx (`soarfulness.app.spacify.se`) and as a systemd unit
(`soarfulness.service`):

```sh
bun install
bun run build:prod   # Nitro's `standard` preset, which serve.mjs wraps
bun run start        # listens on PORT (default 3000) and HOST (default 0.0.0.0)
```

Every push to `main` redeploys it:
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on a
self-hosted runner on the server (labelled `soarfulness`), resets the
checkout at `/www/docs/soarfulness` to `origin/main`, rebuilds and restarts
the service. Use "Run workflow" in the Actions tab to redeploy without a new
commit. The Capacitor app pulls its live updates from this instance (see
[CAPACITOR_APP.md](CAPACITOR_APP.md)).

## Running in a container

The app builds to a plain Node.js server via Nitro's `node-server` preset
(instead of this repo's default Cloudflare Workers target), so it runs
anywhere Docker does.

```sh
docker compose up --build
# or
docker build -t aquafulness .
docker run -p 3000:3000 aquafulness
```

The server listens on `PORT` (default `3000`) and `HOST` (default
`0.0.0.0`). On every push to `main` and on version tags (`vX.Y.Z`), CI
builds and publishes a multi-arch (amd64/arm64) image to
[GitHub Container Registry](https://github.com/drsounds/aqua-wave-dream/pkgs/container/aqua-wave-dream):

```sh
docker run -p 3000:3000 ghcr.io/drsounds/aqua-wave-dream:latest
```

See [`.github/workflows/docker-image.yml`](.github/workflows/docker-image.yml)
for the build/publish pipeline, which also attaches an SBOM and signed build
provenance attestation to each release.
