# Aquafulness

A calming WebGL ocean where the camera drifts on the waves, built with three.js.

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
