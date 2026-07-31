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
