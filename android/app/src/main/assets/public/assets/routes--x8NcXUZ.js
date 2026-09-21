import{J as e,K as t,s as n}from"./useStore-aOy6ga6x.js";import{i as r,t as i}from"./useTranslation-B4EPJb1P.js";import{o as a}from"./preload-helper-D4i-3IbG.js";import{$ as o,A as s,At as c,B as l,Bt as u,C as d,Ct as f,D as p,Dt as m,E as h,Et as g,F as ee,Ft as te,G as _,H as v,I as ne,It as y,J as b,K as x,L as re,Lt as ie,M as ae,Mt as oe,N as S,Nt as se,O as C,Ot as w,P as T,Pt as E,R as D,Rt as ce,S as le,St as ue,T as de,Tt as O,U as k,V as fe,Vt as A,W as j,X as pe,Y as me,Z as he,_ as ge,_t as _e,a as ve,at as ye,b as be,bt as xe,c as Se,ct as Ce,d as M,dt as we,et as N,f as P,ft as Te,g as Ee,gt as De,h as Oe,ht as ke,i as Ae,it as je,j as Me,jt as F,k as Ne,kt as Pe,l as Fe,lt as Ie,m as Le,mt as Re,nt as ze,o as Be,ot as Ve,p as He,pt as Ue,q as We,r as Ge,rt as Ke,s as qe,st as Je,tt as Ye,u as Xe,ut as Ze,v as Qe,vt as $e,w as et,wt as tt,x as I,xt as nt,y as rt,yt as L,z as it,zt as at}from"./index-CcPGCha5.js";var R=e(t()),z=n();function ot(e,t){if(t<=1)return Math.sin(e);let n=Math.min(1,Math.max(0,(t-1)/5)),r=(t-1)*.08,i=Math.atan2(Math.sin(e-Math.PI/2),Math.cos(e-Math.PI/2)),a=.72*(1-n)+.6*n,o=Math.exp(-(i*i)/(2*a*a)),s=a*.3989,c=Math.sin(e),l=Math.max(c,0)**(1+.8*n)-.3183*n;return(c+-Math.cos(2*e)*n*.01+r*(o-s)+n*.55*l)/(1+r*.28+n*.35+n*.01)}function st(e,t){let n=Math.PI*2,r=e%n/n;r<0&&(r+=1);let i=Math.min(1,Math.max(0,(t-1)/5)),a=.35*(1-i)+.06*i,o=1-a;if(r<o){let e=r/o;return-Math.cos(e*Math.PI)}return 1-2*((r-o)/a)}function B(e,t){return t<=.001?e:e+Math.min(.9,Math.max(0,t))*Math.sin(e)}function ct(e,t,n,r,i,a,o=1,s=1,c=0,l=!1,u=null,d=!1,f=null,p=0,m=0,h=1,g=0){let ee=-Math.sin(c),te=-Math.cos(c),_=ee*e+te*t,v=-te*e+ee*t;if(d&&f)return M(f,_,v,m,h)*p;if(l&&u)return M(u,_,v,n,h)*r;if(i){let e=.12*h/o,t=.09*h/o;return ot(_*e+B(n*.9,g),s)*2.6*r+(a?ot(v*t+B(n*.7+1.1,g),s)*1.4*r:0)}let ne=ot(_*.12*h+B(n*.9,g),s)*1,y=ot(v*.17*h+B(n*.7+1.3,g),s)*.75,b=ot((_*.22+v*.19)*h+B(n*1.4+2.1,g),s)*.5,x=ot((_*.31-v*.11)*h+B(n*1.8+.4,g),s)*.35;return(ne+y+b+x)*r}function lt(e,t,n){let r=Math.max(0,Math.min(1,(n-e)/(t-e)));return r*r*(3-2*r)}function ut(e,t,n,r,i,a,o=1){let s=Math.max(1,a),c=Math.hypot(e,t),l=Math.exp(-(c*c)/(s*s)),u=-s*1.6*l,d=1-lt(220,520,c),f=c*(.12*o/i)-n*.9;return u+Math.sin(f)*2.6*r*d*(1-l*.85)}function dt(e,t,n){switch(e){case`sine`:return Math.sin(n);case`triangle`:{let e=(n/(2*Math.PI)%1+1)%1;return e<.25?e*4:e<.75?2-e*4:e*4-4}case`square`:return Math.sin(n)>=0?1:-1;default:return 1-Math.cos(t)}}var ft=1200,pt=ft/2,mt=2e5;function ht(e,t){if(!(t>0))return e;let n=t*2;return((e+t)%n+n)%n-t}var gt=500,_t=5,vt=[`whirlpool`,`float`,`swing`,`noclip`],yt=20,bt=45;function xt(e,t){let n=Math.random()*Math.PI*2,r=700+Math.random()*1800;return{x:e+Math.cos(n)*r,z:t+Math.sin(n)*r,y:220+Math.random()*700,seed:Math.random()*1e3}}function St(e){let t=Math.sin(e*12.9898)*43758.5453,n=Math.sin(e*78.233)*12543.231;return{x:(t-Math.floor(t)-.5)*8e3,z:(n-Math.floor(n)-.5)*8e3}}function Ct(e){let t=new F(pt,Math.max(601,e/2),64,1);return t.rotateX(-Math.PI/2),t}var wt=20260108,Tt=19700101;function Et(e){let t=/^#?([0-9a-fA-F]{6})$/.exec(e);if(!t)return[.6,.55,.45];let n=parseInt(t[1],16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}var Dt=0,Ot=-30,kt={id:`spawn`,name:`Spawn`,x:0,y:0,z:0,yaw:0};function At(e){let t=(e?.locations??e?.places??[]).map((e,t)=>{let n=e.name?.trim()||`${kt.name} ${t+1}`;return{id:e.id?.trim()||n,name:n,x:e.x??0,y:e.y??0,z:e.z??0,yaw:e.yaw??0}}).filter(e=>e.id.length>0);return t.length>0?t:[kt]}function jt(e){return e?e===!0?{follow:!0,amp:1,speed:1}:{follow:e.follow??!0,amp:e.amp??1,speed:e.speed??1}:null}function Mt(e,t){let n=e=>e*Math.PI/180,r=t.position??[0,0,0];e.position.set(r[0]??0,r[1]??0,r[2]??0);let i=t.rotation??[0,0,0];e.rotation.set(n(i[0]??0),n(i[1]??0),n(i[2]??0));let a=t.scale??1;Array.isArray(a)?e.scale.set(a[0]??1,a[1]??1,a[2]??1):e.scale.setScalar(a)}function Nt(e){e.traverse(e=>{let t=e;t.geometry&&t.geometry.dispose();let n=t.material;if(!n)return;let r=Array.isArray(n)?n:[n];for(let e of r){for(let t of Object.keys(e)){let n=e[t];n instanceof y&&n.dispose()}e.dispose()}})}function Pt(e){let t=Array.isArray(e)?e:e.environments??[];if(!Array.isArray(t))return[];let n=(e,t)=>typeof e==`string`?e:t;return t.map(e=>{let t=e;if(typeof t.id!=`string`)return null;let r=(Array.isArray(t.eras)?t.eras:[]).map(e=>{let t=e;if(typeof t.id!=`string`)return null;let r=(Array.isArray(t.times)?t.times:[]).map(e=>{let t=e;return typeof t.id==`string`?{id:t.id,name:n(t.name,t.id)}:null}).filter(e=>e!==null);return r.length?{id:t.id,name:n(t.name,t.id),times:r}:null}).filter(e=>e!==null);return r.length?{id:t.id,name:n(t.name,t.id),eras:r}:null}).filter(e=>e!==null)}var Ft={standard:{waveAmp:.5,waveSpeed:2.8,waveFreq:1,regularWaves:!0,realisticWaves:!1,dyingWave:!1,dyingWaveAmp:1.2,dyingWaveSpeed:.6,regularCross:!1,regularPeriod:1,wavePeak:1},legacy:{waveAmp:2,waveSpeed:5,waveFreq:1,regularWaves:!0,realisticWaves:!1,dyingWave:!1,dyingWaveAmp:1.2,dyingWaveSpeed:.6,regularCross:!0,regularPeriod:1,wavePeak:1}},V={...Ft.standard,wavePreset:`standard`,waveAmp:2.94,waveSpeed:5.21,waveFreq:.51,randomizeWaves:!1,timeOfDay:.5,bobSpeed:2.8,buoyAmp:2.8,heightOffset:0,submergeAmp:0,floatLift:0,waveAnticipation:1,camOffX:0,camOffY:-.1,camOffZ:0,audioOn:!0,audioVol:.8,audioSyncSpeed:!1,audioSpatial:!1,waterSoundIdx:2,waterColorIdx:4,waterOpacity:.5,waterColorAlpha:0,waterHue:0,waterSat:.95,waterBright:1,surfBright:1,surfSat:1,turbidity:0,bottomIdx:0,leanEnabled:!1,gogglesOn:!1,gogglesBlur:0,gogglesLoop:!0,gogglesIntensity:.5,gogglesFpsCap:25,targetFps:40,resolutionScale:.5,lowGraphicsMode:!1,waveHighQuality:!1,backdropIdx:0,wakeLock:!0,camFov:77,camNear:5,camFar:1e5,waveDir:182.51523652581446,floorDepth:28,floorTexture:!0,floorCloudsAnimated:!1,whirlpoolOpening:14,whirlpoolRadius:26,whirlpoolSpeed:1,whirlpoolDirection:`cw`,whirlpoolSequenceOn:!1,whirlpoolDragSpeed:6,whirlpoolDragDuration:6,whirlpoolStayDuration:4,whirlpoolExitMode:`throwBack`,whirlpoolExitSpeed:10,depthSineOn:!1,depthSineAmp:2,depthSineFreq:.2,depthSineSpeed:1,depthSineInterval:1,depthSinePeak:1,depthSineWaveform:`sine`,depthDriftSpeed:0,hideWater:!1,midCloudsOn:!1,midCloudsHeight:.5,skyCloudsOn:!0,skyCloudsHeight:.4,cloudFadeSpeed:3,skyPuffsOn:!1,skyPuffsCount:6,skyPuffsSize:600,skyPuffsFreq:1,skyPuffsOpacity:.85,swayAmp:0,swaySpeed:.15,swayBias:0,syncWaveWithSway:!0,surgeAmp:0,surgeSpeed:.2,surgeRotationMode:`off`,surgeRotationSpeed:2,worldBoundaryOn:!0,worldBoundarySize:2e4,worldBoundaryHeight:3e3,worldBoundaryYExtend:!0,liveMode:!1,sceneId:`Strandpark2`,spawnLocationId:null,envId:`strandpark`,envEra:`present`,envTime:`day`,timeTravelBaseMs:null,timeTravelSetAtMs:null,timeSeasonalSync:!1,clockOn:!0,surfaceId:null,reflStrength:1,bottomColor:`#8a7550`,sphereMaterial:!1,sphereStrength:.7,trochoid:0,heaveSkew:0,causticsOn:!1,chromaticAberrationOn:!1,chromaticAberrationAmount:.3,cameraMode:`float`,noclipSpeed:1,noclipFallRiseSpeed:48,noclipVertEaseTime:.7,swingPositionY:25,swingIntensity:.3,swingXFactor:0,swingHeight:2e4,swingPreset:`water`,swingYWaveform:`pendulum`,swingTornadoOn:!1,swingTornadoRadius:40,swingTornadoSpeed:1,swingTornadoDirection:`cw`,intervalSessionOn:!1,intervalDuration:30,intervalSessionType:`infinite`,intervalCount:6,intervalShowStats:!0,intervalIncludeFloat:!0,intervalIncludeWhirlpool:!1,intervalIncludeSwing:!0,surfaceArea:1e3,torusRingsOn:!1,torusRadius:.6,torusTube:.08,torusScale:1,torusOpacity:.5,torusTextureIdx:0,torusCellSize:6,torusVerticalSpacing:1.4,torusVerticalCount:5,torusViewDistance:26,torusFadeDistance:8};function It(){if(typeof window>`u`)return V;try{let e=window.localStorage.getItem(Ae);if(!e)return V;let t=JSON.parse(e);return{...V,...t}}catch{return V}}function Lt(){if(typeof window>`u`)return null;try{let e=window.localStorage.getItem(Ge);if(!e)return null;let t=JSON.parse(e);return typeof t.x!=`number`||typeof t.z!=`number`||typeof t.yaw!=`number`||typeof t.pitch!=`number`?null:t}catch{return null}}function Rt(e){try{window.localStorage.setItem(Ge,JSON.stringify(e))}catch{}}async function zt(e){let t={v:1,s:{...ze(It(),_),...e}},n=Lt();return n&&typeof n.y==`number`&&(t.c={x:n.x,y:n.y,z:n.z,yaw:n.yaw,pitch:n.pitch}),h(t)}function Bt(){let{t:e}=i(),t=a(),[n,o]=(0,R.useState)(!1),s=async e=>{if(!n){o(!0);try{let n=await zt(e);await t({to:`/bathing/$payload`,params:{payload:n}})}catch{o(!1)}}};return(0,z.jsxs)(`div`,{className:`relative flex min-h-screen flex-col items-center overflow-hidden bg-[#dff3ef]`,children:[(0,z.jsxs)(`div`,{className:`pointer-events-none absolute inset-0 z-0 overflow-hidden`,"aria-hidden":`true`,children:[(0,z.jsx)(`div`,{className:`absolute inset-0 bg-gradient-to-b from-[#eafff2] via-[#d9f5ee] to-[#eaf6ff]`}),(0,z.jsx)(`div`,{className:`aq-splash-blob aq-splash-blob--1`}),(0,z.jsx)(`div`,{className:`aq-splash-blob aq-splash-blob--2`}),(0,z.jsx)(`div`,{className:`aq-splash-blob aq-splash-blob--3`}),(0,z.jsx)(`div`,{className:`aq-splash-blob aq-splash-blob--4`})]}),(0,z.jsxs)(`div`,{className:`relative z-10 flex flex-col items-center gap-6 px-6 pt-[calc(env(safe-area-inset-top,0px)+4rem)] text-center`,children:[(0,z.jsx)(`img`,{src:A.url,alt:e(`splash.logoAlt`),className:`h-20 w-20 drop-shadow-[0_6px_20px_rgba(11,61,92,0.25)]`}),(0,z.jsxs)(`div`,{className:`flex flex-col items-center gap-3`,children:[(0,z.jsx)(`button`,{type:`button`,onClick:()=>void s(),disabled:n,className:`min-w-[220px] cursor-pointer rounded-full bg-[#0b3d5c] px-8 py-3.5 text-sm font-semibold tracking-[0.08em] text-white shadow-lg shadow-[#0b3d5c]/30 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-default disabled:opacity-70`,children:e(n?`splash.starting`:`splash.startBath`)}),(0,z.jsx)(`button`,{type:`button`,onClick:()=>void s({cameraMode:`watercraft`}),disabled:n,className:`min-w-[220px] cursor-pointer rounded-full border border-[#0b3d5c]/25 bg-white/40 px-8 py-3 text-sm font-medium tracking-[0.08em] text-[#0b3d5c] backdrop-blur-sm transition-colors hover:bg-white/60 disabled:cursor-default disabled:opacity-70`,children:`Watercraft (build mode)`}),(0,z.jsx)(r,{to:`/about`,className:`min-w-[220px] rounded-full border border-[#0b3d5c]/25 bg-white/40 px-8 py-3 text-sm font-medium tracking-[0.08em] text-[#0b3d5c] backdrop-blur-sm transition-colors hover:bg-white/60`,children:e(`about.navLabel`)})]})]}),(0,z.jsx)(`div`,{className:`relative z-10 mt-auto pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] text-center text-xs text-[#0b3d5c]/70`,children:e(`splash.copyright`,{year:new Date().getFullYear(),name:e(`about.sections.trader.name`)})})]})}var Vt={uniforms:{tDiffuse:{value:null},uAmount:{value:0}},vertexShader:`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec2 toCenter = vUv - 0.5;
      vec2 dir = toCenter / (length(toCenter) + 1e-6);
      vec2 offset = dir * length(toCenter) * uAmount;
      float r = texture2D(tDiffuse, vUv - offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv + offset).b;
      float a = texture2D(tDiffuse, vUv).a;
      gl_FragColor = vec4(r, g, b, a);
    }
  `};function Ht(){let{t:e}=i(),t=we(),n=(0,R.useRef)(null),r=(0,R.useRef)(It()).current,a=(0,R.useRef)(Lt()).current,[y,M]=(0,R.useState)(r.waveAmp),[F,Ge]=(0,R.useState)(r.timeOfDay),[B,lt]=(0,R.useState)(r.waveSpeed),[pt,zt]=(0,R.useState)(r.waveFreq),[Bt,Ht]=(0,R.useState)(r.bobSpeed),[Ut,Wt]=(0,R.useState)(r.buoyAmp),[Kt,qt]=(0,R.useState)(r.heightOffset),[Jt,Yt]=(0,R.useState)(r.submergeAmp),[Xt,Zt]=(0,R.useState)(r.floatLift),[Qt,$t]=(0,R.useState)(r.waveAnticipation),[en,tn]=(0,R.useState)(r.camOffX),[nn,rn]=(0,R.useState)(r.camOffY),[an,on]=(0,R.useState)(r.camOffZ),[sn,cn]=(0,R.useState)({x:0,y:0}),[ln,un]=(0,R.useState)(r.audioOn),[dn,fn]=(0,R.useState)(r.audioVol),[pn,mn]=(0,R.useState)(r.audioSyncSpeed),[hn,gn]=(0,R.useState)(r.audioSpatial),[_n,vn]=(0,R.useState)(r.waterSoundIdx),[yn,bn]=(0,R.useState)(r.waterColorIdx),[xn,Sn]=(0,R.useState)(r.waterOpacity),[Cn,wn]=(0,R.useState)(r.waterColorAlpha),[Tn,En]=(0,R.useState)(r.waterHue),[Dn,On]=(0,R.useState)(r.waterSat),[kn,An]=(0,R.useState)(r.waterBright),[jn,Mn]=(0,R.useState)(r.surfBright),[Nn,Pn]=(0,R.useState)(r.surfSat),[Fn,In]=(0,R.useState)(r.turbidity),[Ln,Rn]=(0,R.useState)(r.bottomIdx),[zn,Bn]=(0,R.useState)(r.leanEnabled),[Vn,Hn]=(0,R.useState)(r.gogglesOn),[Un,Wn]=(0,R.useState)(r.gogglesBlur),[Gn,Kn]=(0,R.useState)(r.gogglesLoop),[qn,Jn]=(0,R.useState)(r.gogglesIntensity),[Yn,Xn]=(0,R.useState)(r.gogglesFpsCap),[Zn,Qn]=(0,R.useState)(r.targetFps),[$n,er]=(0,R.useState)(r.resolutionScale),[tr,nr]=(0,R.useState)(r.lowGraphicsMode),[rr,ir]=(0,R.useState)(r.regularWaves),[ar,or]=(0,R.useState)(r.realisticWaves),[sr,cr]=(0,R.useState)(r.randomizeWaves),lr=(0,R.useRef)(Fe(r.randomizeWaves?Math.random:qe(wt))).current,[ur,dr]=(0,R.useState)(r.dyingWave),[fr,pr]=(0,R.useState)(r.dyingWaveAmp),[mr,hr]=(0,R.useState)(r.dyingWaveSpeed),gr=(0,R.useRef)(Se(r.randomizeWaves?Math.random:qe(Tt))).current,[_r,vr]=(0,R.useState)(r.wavePreset),[yr,br]=(0,R.useState)(r.regularCross),[xr,Sr]=(0,R.useState)(r.regularPeriod),[Cr,wr]=(0,R.useState)(r.wavePeak),[Tr,Er]=(0,R.useState)(r.waveHighQuality),[Dr,Or]=(0,R.useState)(r.backdropIdx),[kr,Ar]=(0,R.useState)(r.wakeLock),[jr,Mr]=(0,R.useState)(r.camFov),[Nr,Pr]=(0,R.useState)(r.camNear),[Fr,Ir]=(0,R.useState)(r.camFar),[Lr,Rr]=(0,R.useState)(r.waveDir),[zr,Br]=(0,R.useState)(r.floorDepth),[Vr,Hr]=(0,R.useState)(r.floorTexture),[Ur,Wr]=(0,R.useState)(r.floorCloudsAnimated),[Gr,Kr]=(0,R.useState)(r.whirlpoolOpening),[qr,Jr]=(0,R.useState)(r.whirlpoolRadius),[Yr,Xr]=(0,R.useState)(r.whirlpoolSpeed),[Zr,Qr]=(0,R.useState)(r.whirlpoolDirection),[$r,ei]=(0,R.useState)(r.whirlpoolSequenceOn),[ti,ni]=(0,R.useState)(r.whirlpoolDragSpeed),[ri,ii]=(0,R.useState)(r.whirlpoolDragDuration),[ai,oi]=(0,R.useState)(r.whirlpoolStayDuration),[si,ci]=(0,R.useState)(r.whirlpoolExitMode),[li,ui]=(0,R.useState)(r.whirlpoolExitSpeed),[di,fi]=(0,R.useState)(r.depthSineOn),[pi,mi]=(0,R.useState)(r.depthSineAmp),[hi,gi]=(0,R.useState)(r.depthSineFreq),[_i,vi]=(0,R.useState)(r.depthSineSpeed),[yi,bi]=(0,R.useState)(r.depthSineInterval),[xi,Si]=(0,R.useState)(r.depthSinePeak),[Ci,wi]=(0,R.useState)(r.depthSineWaveform),[Ti,Ei]=(0,R.useState)(r.depthDriftSpeed),[Di,Oi]=(0,R.useState)(r.hideWater),[ki,Ai]=(0,R.useState)(r.midCloudsOn),[ji,Mi]=(0,R.useState)(r.midCloudsHeight),[Ni,Pi]=(0,R.useState)(r.skyCloudsOn),[Fi,Ii]=(0,R.useState)(r.skyCloudsHeight),[Li,Ri]=(0,R.useState)(r.cloudFadeSpeed),[zi,Bi]=(0,R.useState)(r.skyPuffsOn),[Vi,Hi]=(0,R.useState)(r.skyPuffsCount),[Ui,Wi]=(0,R.useState)(r.skyPuffsSize),[Gi,Ki]=(0,R.useState)(r.skyPuffsFreq),[qi,Ji]=(0,R.useState)(r.skyPuffsOpacity),[Yi,Xi]=(0,R.useState)(r.swayAmp),[Zi,Qi]=(0,R.useState)(r.swaySpeed),[$i,ea]=(0,R.useState)(r.swayBias),[ta,na]=(0,R.useState)(r.syncWaveWithSway),[ra,ia]=(0,R.useState)(r.surgeAmp),[aa,oa]=(0,R.useState)(r.surgeSpeed),[sa,ca]=(0,R.useState)(r.surgeRotationMode),[la,ua]=(0,R.useState)(r.surgeRotationSpeed),[da,fa]=(0,R.useState)(r.worldBoundaryOn),[pa,ma]=(0,R.useState)(r.worldBoundarySize),[ha,ga]=(0,R.useState)(r.worldBoundaryHeight),[_a,va]=(0,R.useState)(r.worldBoundaryYExtend),[ya,ba]=(0,R.useState)(r.liveMode),[xa,Sa]=(0,R.useState)([]),[Ca,wa]=(0,R.useState)(r.sceneId),[Ta,Ea]=(0,R.useState)([kt]),[Da,Oa]=(0,R.useState)(r.spawnLocationId),[ka,Aa]=(0,R.useState)([]),[H,ja]=(0,R.useState)(r.envId),[U,Ma]=(0,R.useState)(r.envEra),[Na,Pa]=(0,R.useState)(r.envTime),[Fa,Ia]=(0,R.useState)(r.timeTravelBaseMs),[La,Ra]=(0,R.useState)(r.timeTravelSetAtMs),[za,Ba]=(0,R.useState)(r.timeSeasonalSync),[Va,Ha]=(0,R.useState)(r.clockOn),[Ua,Wa]=(0,R.useState)(!1),[Ga,Ka]=(0,R.useState)(null),qa=(0,R.useMemo)(()=>Ga?.toLocaleTimeString([],{hour:`2-digit`,minute:`2-digit`})??null,[Ga]),Ja=(0,R.useRef)(!1),[Ya,Xa]=(0,R.useState)([]),[Za,Qa]=(0,R.useState)(r.surfaceId),[$a,eo]=(0,R.useState)(r.reflStrength),[to,no]=(0,R.useState)(r.bottomColor),[ro,io]=(0,R.useState)(r.sphereMaterial),[ao,oo]=(0,R.useState)(r.sphereStrength),[so,co]=(0,R.useState)(r.trochoid),[lo,uo]=(0,R.useState)(r.heaveSkew),[fo,po]=(0,R.useState)(r.causticsOn),[mo,ho]=(0,R.useState)(r.chromaticAberrationOn),[go,_o]=(0,R.useState)(r.chromaticAberrationAmount),[W,vo]=(0,R.useState)(r.cameraMode),[yo,bo]=(0,R.useState)(r.noclipSpeed),[xo,So]=(0,R.useState)(r.noclipFallRiseSpeed),[Co,wo]=(0,R.useState)(r.noclipVertEaseTime),[To,Eo]=(0,R.useState)(r.swingPositionY),[Do,Oo]=(0,R.useState)(r.swingIntensity),[ko,Ao]=(0,R.useState)(r.swingXFactor),[jo,Mo]=(0,R.useState)(r.swingHeight),[No,Po]=(0,R.useState)(r.swingYWaveform),[Fo,Io]=(0,R.useState)(r.swingPreset),[Lo,Ro]=(0,R.useState)(r.swingTornadoOn),[zo,Bo]=(0,R.useState)(r.swingTornadoRadius),[Vo,Ho]=(0,R.useState)(r.swingTornadoSpeed),[Uo,Wo]=(0,R.useState)(r.swingTornadoDirection),[Go,Ko]=(0,R.useState)(r.intervalSessionOn),[qo,Jo]=(0,R.useState)(r.intervalDuration),[Yo,Xo]=(0,R.useState)(r.intervalSessionType),[Zo,Qo]=(0,R.useState)(r.intervalCount),[$o,es]=(0,R.useState)(r.intervalShowStats),[ts,ns]=(0,R.useState)(r.intervalIncludeFloat),[rs,is]=(0,R.useState)(r.intervalIncludeWhirlpool),[as,os]=(0,R.useState)(r.intervalIncludeSwing),[ss,cs]=(0,R.useState)(0),[ls,us]=(0,R.useState)(0),[ds,fs]=(0,R.useState)(0),ps=(0,R.useRef)(qo),ms=(0,R.useRef)(Yo),hs=(0,R.useRef)(Zo);(0,R.useEffect)(()=>{ps.current=qo},[qo]),(0,R.useEffect)(()=>{ms.current=Yo},[Yo]),(0,R.useEffect)(()=>{hs.current=Zo},[Zo]);let[gs,_s]=(0,R.useState)(r.surfaceArea),[vs,ys]=(0,R.useState)(r.torusRingsOn),[bs,xs]=(0,R.useState)(r.torusRadius),[Ss,Cs]=(0,R.useState)(r.torusTube),[ws,Ts]=(0,R.useState)(r.torusScale),[Es,Ds]=(0,R.useState)(r.torusOpacity),[Os,ks]=(0,R.useState)(r.torusTextureIdx),[As,js]=(0,R.useState)(r.torusCellSize),[Ms,Ns]=(0,R.useState)(r.torusVerticalSpacing),[Ps,Fs]=(0,R.useState)(r.torusVerticalCount),[Is,Ls]=(0,R.useState)(r.torusViewDistance),[Rs,zs]=(0,R.useState)(r.torusFadeDistance),[Bs,Vs]=(0,R.useState)({x:0,y:0}),[Hs,Us]=(0,R.useState)({x:0,y:0}),[Ws,Gs]=(0,R.useState)({x:0,y:0}),[Ks,qs]=(0,R.useState)({x:0,y:0}),[Js,Ys]=(0,R.useState)({x:0,y:0}),[Xs,Zs]=(0,R.useState)({x:0,y:0}),[Qs,$s]=(0,R.useState)({x:0,y:0}),[ec,tc]=(0,R.useState)(!1),[nc,rc]=(0,R.useState)(!1),[ic,ac]=(0,R.useState)(!1),[oc,sc]=(0,R.useState)(6),[cc,lc]=(0,R.useState)(!1),[uc,dc]=(0,R.useState)(!1),[fc,pc]=(0,R.useState)(!1),[mc,hc]=(0,R.useState)(`vagor`),[gc,_c]=(0,R.useState)(!1),[vc,yc]=(0,R.useState)(W),[bc,xc]=(0,R.useState)(()=>ee()),[Sc,Cc]=(0,R.useState)(()=>ne()),[wc,Tc]=(0,R.useState)(!1),[Ec,Dc]=(0,R.useState)(!0),[Oc,kc]=(0,R.useState)(!1),[Ac,jc]=(0,R.useState)(!1),[Mc,Nc]=(0,R.useState)(!1),Pc=(0,R.useRef)(Mc);(0,R.useEffect)(()=>{Pc.current=Mc,Wc.current?.setEditMode(Mc)},[Mc]);let Fc=(0,R.useRef)(null),Ic=(0,R.useRef)(null),Lc=(0,R.useRef)(null),Rc=(0,R.useRef)(null),zc=(0,R.useRef)(null),Bc=(0,R.useRef)(null),Vc=(0,R.useRef)(null),Hc=(0,R.useRef)([]),Uc=(0,R.useRef)([]),Wc=(0,R.useRef)(null),Gc=(0,R.useRef)(null),Kc=(0,R.useRef)(null),G=(0,R.useRef)(null),[qc,Jc]=(0,R.useState)(`build`),[Yc,Xc]=(0,R.useState)(`place`),[Zc,Qc]=(0,R.useState)(0),[$c,el]=(0,R.useState)(`raise`),[tl,nl]=(0,R.useState)(1.1),[rl,il]=(0,R.useState)(.14),[al,ol]=(0,R.useState)(0),[sl,cl]=(0,R.useState)(null);(0,R.useEffect)(()=>{G.current&&(G.current.mode=qc)},[qc]),(0,R.useEffect)(()=>{G.current&&(G.current.buildAction=Yc)},[Yc]),(0,R.useEffect)(()=>{G.current&&(G.current.blockType=Zc)},[Zc]),(0,R.useEffect)(()=>{G.current&&(G.current.sculptAction=$c)},[$c]),(0,R.useEffect)(()=>{G.current&&(G.current.brushRadius=tl)},[tl]),(0,R.useEffect)(()=>{G.current&&(G.current.brushStrength=rl)},[rl]),(0,R.useEffect)(()=>{if(!sl)return;let e=window.setTimeout(()=>cl(null),4e3);return()=>window.clearTimeout(e)},[sl]);let[ll,ul]=(0,R.useState)(null),dl=async()=>{let e=G.current;if(e){cl(`Exporting…`);try{let t=await e.exportGlb(),n=`watercraft-${new Date().toISOString().slice(0,10)}.glb`,r=URL.createObjectURL(t),i=document.createElement(`a`);i.href=r,i.download=n,document.body.appendChild(i),i.click(),i.remove(),URL.revokeObjectURL(r),cl(`Saved ${n}`)}catch(e){console.error(`Watercraft export failed`,e),cl(`Export failed — see console`)}}},fl=async e=>{let t=G.current;if(t){cl(`Importing…`);try{(await t.importGlb(e)).kind===`restored`&&cl(`World imported.`)}catch(e){console.error(`Watercraft import failed`,e),cl(`Import failed — is this a valid .glb?`)}}},pl=e=>{let t=G.current;t&&t.blockCount>0?ul({kind:`import`,file:e}):fl(e)},ml=()=>{let e=G.current;e&&e.blockCount>0?ul({kind:`reset`,file:null}):(e?.reset(),cl(`Cleared.`))},hl=(0,R.useRef)(null),gl=(0,R.useRef)(!1),_l=(0,R.useRef)(null),vl=(0,R.useRef)(null),yl=(0,R.useRef)(null),bl=(0,R.useRef)(4),xl=(0,R.useRef)(0),Sl=(0,R.useRef)($a),Cl=(0,R.useRef)(to),wl=(0,R.useRef)(ro),Tl=(0,R.useRef)(ao),El=(0,R.useRef)(so),Dl=(0,R.useRef)(lo),Ol=(0,R.useRef)(fo),kl=(0,R.useRef)(mo),Al=(0,R.useRef)(go),jl=()=>({waveAmp:y,timeOfDay:F,waveSpeed:B,waveFreq:pt,bobSpeed:Bt,buoyAmp:Ut,heightOffset:Kt,submergeAmp:Jt,floatLift:Xt,waveAnticipation:Qt,camOffX:en,camOffY:nn,camOffZ:an,audioOn:ln,audioVol:dn,audioSyncSpeed:pn,audioSpatial:hn,waterSoundIdx:_n,waterColorIdx:yn,waterOpacity:xn,waterColorAlpha:Cn,waterHue:Tn,waterSat:Dn,waterBright:kn,surfBright:jn,surfSat:Nn,turbidity:Fn,bottomIdx:Ln,leanEnabled:zn,gogglesOn:Vn,gogglesBlur:Un,gogglesLoop:Gn,gogglesIntensity:qn,gogglesFpsCap:Yn,targetFps:Zn,resolutionScale:$n,lowGraphicsMode:tr,regularWaves:rr,realisticWaves:ar,dyingWave:ur,dyingWaveAmp:fr,dyingWaveSpeed:mr,randomizeWaves:sr,wavePreset:_r,regularCross:yr,regularPeriod:xr,wavePeak:Cr,waveHighQuality:Tr,backdropIdx:Dr,wakeLock:kr,camFov:jr,camNear:Nr,camFar:Fr,waveDir:Lr,floorDepth:zr,floorTexture:Vr,floorCloudsAnimated:Ur,whirlpoolOpening:Gr,whirlpoolRadius:qr,whirlpoolSpeed:Yr,whirlpoolDirection:Zr,whirlpoolSequenceOn:$r,whirlpoolDragSpeed:ti,whirlpoolDragDuration:ri,whirlpoolStayDuration:ai,whirlpoolExitMode:si,whirlpoolExitSpeed:li,depthSineOn:di,depthSineAmp:pi,depthSineFreq:hi,depthSineSpeed:_i,depthSineInterval:yi,depthSinePeak:xi,depthSineWaveform:Ci,depthDriftSpeed:Ti,hideWater:Di,midCloudsOn:ki,midCloudsHeight:ji,skyCloudsOn:Ni,skyCloudsHeight:Fi,cloudFadeSpeed:Li,skyPuffsOn:zi,skyPuffsCount:Vi,skyPuffsSize:Ui,skyPuffsFreq:Gi,skyPuffsOpacity:qi,swayAmp:Yi,swaySpeed:Zi,swayBias:$i,syncWaveWithSway:ta,surgeAmp:ra,surgeSpeed:aa,surgeRotationMode:sa,surgeRotationSpeed:la,worldBoundaryOn:da,worldBoundarySize:pa,worldBoundaryHeight:ha,worldBoundaryYExtend:_a,liveMode:ya,sceneId:Ca,spawnLocationId:Da,envId:H,envEra:U,envTime:Na,timeTravelBaseMs:Fa,timeTravelSetAtMs:La,timeSeasonalSync:za,clockOn:Va,surfaceId:Za,reflStrength:$a,bottomColor:to,sphereMaterial:ro,sphereStrength:ao,trochoid:so,heaveSkew:lo,causticsOn:fo,chromaticAberrationOn:mo,chromaticAberrationAmount:go,cameraMode:W,noclipSpeed:yo,noclipFallRiseSpeed:xo,noclipVertEaseTime:Co,swingPositionY:To,swingIntensity:Do,swingXFactor:ko,swingHeight:jo,swingPreset:Fo,swingYWaveform:No,swingTornadoOn:Lo,swingTornadoRadius:zo,swingTornadoSpeed:Vo,swingTornadoDirection:Uo,intervalSessionOn:Go,intervalDuration:qo,intervalSessionType:Yo,intervalCount:Zo,intervalShowStats:$o,intervalIncludeFloat:ts,intervalIncludeWhirlpool:rs,intervalIncludeSwing:as,surfaceArea:gs,torusRingsOn:vs,torusRadius:bs,torusTube:Ss,torusScale:ws,torusOpacity:Es,torusTextureIdx:Os,torusCellSize:As,torusVerticalSpacing:Ms,torusVerticalCount:Ps,torusViewDistance:Is,torusFadeDistance:Rs});(0,R.useEffect)(()=>{if(!(typeof window>`u`))try{window.localStorage.setItem(Ae,JSON.stringify(jl()))}catch{}},[y,F,B,pt,Bt,Ut,Kt,Jt,Xt,Qt,en,nn,an,ln,dn,pn,hn,_n,yn,xn,Cn,Tn,Dn,kn,jn,Nn,Fn,Ln,zn,Vn,Un,Gn,qn,Yn,Zn,$n,tr,rr,ar,ur,fr,mr,sr,_r,yr,xr,Cr,Tr,Dr,kr,jr,Nr,Fr,Lr,zr,Vr,Ur,Gr,qr,Yr,Zr,$r,ti,ri,ai,si,li,di,pi,hi,_i,yi,xi,Ci,Ti,Di,ki,ji,Ni,Fi,Li,zi,Vi,Ui,Gi,qi,Yi,Zi,$i,ta,ra,aa,sa,la,da,pa,ha,_a,ya,Ca,Da,H,U,Na,Fa,La,za,Va,Za,$a,to,ro,ao,so,lo,fo,mo,go,W,yo,xo,Co,To,Do,ko,jo,Fo,No,Lo,zo,Vo,Uo,Go,qo,Yo,Zo,$o,ts,rs,as,gs,vs,bs,Ss,ws,Es,Os,As,Ms,Ps,Is,Rs]);let Ml=(0,R.useRef)(null),K=(0,R.useRef)(y),Nl=(0,R.useRef)(F),Pl=(0,R.useRef)(B),Fl=(0,R.useRef)(pt),Il=(0,R.useRef)(Bt),Ll=(0,R.useRef)(Ut),Rl=(0,R.useRef)(Kt),zl=(0,R.useRef)(Jt),Bl=(0,R.useRef)(Xt),Vl=(0,R.useRef)(Qt),Hl=(0,R.useRef)(en),Ul=(0,R.useRef)(nn),Wl=(0,R.useRef)(an),q=(0,R.useRef)({x:0,y:0}),J=(0,R.useRef)({x:a?.x??0,y:a?.y??0,z:a?.z??0}),Y=(0,R.useRef)(null),Gl=(0,R.useRef)(0),Kl=(0,R.useRef)({x:0,y:0}),ql=(0,R.useRef)(W),Jl=(0,R.useRef)(yo),Yl=(0,R.useRef)(xo),Xl=(0,R.useRef)(Co),Zl=(0,R.useRef)(cc),Ql=(0,R.useRef)(uc),$l=(0,R.useRef)(0),eu=(0,R.useRef)(To),tu=(0,R.useRef)(Do),nu=(0,R.useRef)(ko),ru=(0,R.useRef)(jo),iu=(0,R.useRef)(No),au=(0,R.useRef)(null),ou=(0,R.useRef)(0),su=(0,R.useRef)(gs),cu=(0,R.useRef)(0),lu=(0,R.useRef)({x:0,z:0}),uu=(0,R.useRef)({x:0,z:0}),du=(0,R.useRef)({x:0,z:0}),fu=(0,R.useRef)({x:0,z:0}),pu=(0,R.useRef)(yn),mu=(0,R.useRef)(xn),hu=(0,R.useRef)(Cn),gu=(0,R.useRef)(Tn),_u=(0,R.useRef)(Dn),vu=(0,R.useRef)(kn),yu=(0,R.useRef)(jn),bu=(0,R.useRef)(Nn),xu=(0,R.useRef)(Fn),Su=(0,R.useRef)(Ln),Cu=(0,R.useRef)(zn),wu=(0,R.useRef)(rr),Tu=(0,R.useRef)(ar),Eu=(0,R.useRef)(ur),Du=(0,R.useRef)(fr),Ou=(0,R.useRef)(mr),ku=(0,R.useRef)(yr),Au=(0,R.useRef)(xr),ju=(0,R.useRef)(Cr),Mu=(0,R.useRef)(Tr),Nu=(0,R.useRef)(Dr),Pu=(0,R.useRef)(kr),Fu=(0,R.useRef)(hn),Iu=(0,R.useRef)({x:0,y:0}),Lu=(0,R.useRef)({x:0,z:0}),X=(0,R.useRef)({x:0,z:0}),Ru=(0,R.useRef)({x:0,z:0}),zu=(0,R.useRef)({x:0,z:1}),Bu=(0,R.useRef)(0),Vu=(0,R.useRef)(0),Hu=(0,R.useRef)({x:0,y:0}),Uu=(0,R.useRef)({x:0,y:0}),Wu=(0,R.useRef)({x:0,y:0}),Gu=(0,R.useRef)({x:0,y:0}),Z=(0,R.useRef)(a?.yaw??0),Q=(0,R.useRef)(a?.pitch??0),Ku=(0,R.useRef)(null),qu=(0,R.useRef)(0),Ju=(0,R.useRef)(jr),Yu=(0,R.useRef)(Vn),Xu=(0,R.useRef)(Yn),Zu=(0,R.useRef)(Zn),Qu=(0,R.useRef)($n),$u=(0,R.useRef)(tr),ed=(0,R.useRef)(Nr),td=(0,R.useRef)(Fr),nd=(0,R.useRef)(Lr),rd=(0,R.useRef)(zr),id=(0,R.useRef)(Vr),ad=(0,R.useRef)(Ur),od=(0,R.useRef)(Gr),sd=(0,R.useRef)(qr),cd=(0,R.useRef)(Yr),ld=(0,R.useRef)(Zr),ud=(0,R.useRef)($r),dd=(0,R.useRef)(ti),fd=(0,R.useRef)(ri),pd=(0,R.useRef)(ai),md=(0,R.useRef)(si),hd=(0,R.useRef)(li),gd=(0,R.useRef)(0),_d=(0,R.useRef)({phase:`drag`,startMs:0}),$=(0,R.useRef)(0),vd=(0,R.useRef)({x:0,z:0}),yd=(0,R.useRef)({x:0,z:0}),bd=(0,R.useRef)(Lo),xd=(0,R.useRef)(zo),Sd=(0,R.useRef)(Vo),Cd=(0,R.useRef)(Uo),wd=(0,R.useRef)(0),Td=(0,R.useRef)(ts),Ed=(0,R.useRef)(rs),Dd=(0,R.useRef)(as),Od=(0,R.useRef)(di),kd=(0,R.useRef)(pi),Ad=(0,R.useRef)(hi),jd=(0,R.useRef)(_i),Md=(0,R.useRef)(yi),Nd=(0,R.useRef)(xi),Pd=(0,R.useRef)(Ci),Fd=(0,R.useRef)(Ti),Id=(0,R.useRef)(0),Ld=(0,R.useRef)(0),Rd=(0,R.useRef)(Di),zd=(0,R.useRef)(ki),Bd=(0,R.useRef)(ji),Vd=(0,R.useRef)(Ni),Hd=(0,R.useRef)(Fi),Ud=(0,R.useRef)(Li),Wd=(0,R.useRef)(zi),Gd=(0,R.useRef)(Vi),Kd=(0,R.useRef)(Ui),qd=(0,R.useRef)(Gi),Jd=(0,R.useRef)(qi),Yd=(0,R.useRef)([]),Xd=(0,R.useRef)([]),Zd=(0,R.useRef)(Yi),Qd=(0,R.useRef)(0),$d=(0,R.useRef)(0),ef=(0,R.useRef)(Zi),tf=(0,R.useRef)($i),nf=(0,R.useRef)(ra),rf=(0,R.useRef)(aa),af=(0,R.useRef)(sa),of=(0,R.useRef)(la),sf=(0,R.useRef)(da),cf=(0,R.useRef)(pa),lf=(0,R.useRef)(ha),uf=(0,R.useRef)(_a),df=(0,R.useRef)(ec),ff=(0,R.useRef)(nc),pf=(0,R.useRef)(oc),mf=(0,R.useRef)(0);(0,R.useEffect)(()=>{K.current=y},[y]),(0,R.useEffect)(()=>{Nl.current=F},[F]),(0,R.useEffect)(()=>{Pl.current=B},[B]),(0,R.useEffect)(()=>{Fl.current=pt},[pt]),(0,R.useEffect)(()=>{Il.current=Bt},[Bt]),(0,R.useEffect)(()=>{Ll.current=Ut},[Ut]),(0,R.useEffect)(()=>{Rl.current=Kt},[Kt]),(0,R.useEffect)(()=>{zl.current=Jt},[Jt]),(0,R.useEffect)(()=>{Bl.current=Xt},[Xt]),(0,R.useEffect)(()=>{Vl.current=Qt},[Qt]),(0,R.useEffect)(()=>{Hl.current=en},[en]),(0,R.useEffect)(()=>{Ul.current=nn},[nn]),(0,R.useEffect)(()=>{Wl.current=an},[an]),(0,R.useEffect)(()=>{q.current=sn},[sn]),(0,R.useEffect)(()=>{Kl.current=Xs},[Xs]),(0,R.useEffect)(()=>{Iu.current=Bs},[Bs]),(0,R.useEffect)(()=>{pu.current=yn},[yn]),(0,R.useEffect)(()=>{mu.current=xn},[xn]),(0,R.useEffect)(()=>{hu.current=Cn},[Cn]),(0,R.useEffect)(()=>{gu.current=Tn},[Tn]),(0,R.useEffect)(()=>{_u.current=Dn},[Dn]),(0,R.useEffect)(()=>{vu.current=kn},[kn]),(0,R.useEffect)(()=>{yu.current=jn},[jn]),(0,R.useEffect)(()=>{bu.current=Nn},[Nn]),(0,R.useEffect)(()=>{xu.current=Fn},[Fn]),(0,R.useEffect)(()=>{Su.current=Ln},[Ln]),(0,R.useEffect)(()=>{Cu.current=zn},[zn]),(0,R.useEffect)(()=>{wu.current=rr},[rr]),(0,R.useEffect)(()=>{Tu.current=ar},[ar]),(0,R.useEffect)(()=>{Eu.current=ur},[ur]),(0,R.useEffect)(()=>{Du.current=fr},[fr]),(0,R.useEffect)(()=>{Ou.current=mr},[mr]),(0,R.useEffect)(()=>{ku.current=yr},[yr]),(0,R.useEffect)(()=>{Au.current=xr},[xr]),(0,R.useEffect)(()=>{ju.current=Cr},[Cr]),(0,R.useEffect)(()=>{Mu.current=Tr},[Tr]),(0,R.useEffect)(()=>{Nu.current=Dr},[Dr]),(0,R.useEffect)(()=>{Pu.current=kr},[kr]),(0,R.useEffect)(()=>{Fu.current=hn},[hn]),(0,R.useEffect)(()=>{Ju.current=jr},[jr]),(0,R.useEffect)(()=>{Yu.current=Vn},[Vn]),(0,R.useEffect)(()=>{Xu.current=Yn},[Yn]),(0,R.useEffect)(()=>{Zu.current=Zn},[Zn]),(0,R.useEffect)(()=>{Qu.current=$n},[$n]),(0,R.useEffect)(()=>{$u.current=tr,rp()},[tr]),(0,R.useEffect)(()=>{ed.current=Nr},[Nr]),(0,R.useEffect)(()=>{td.current=Fr},[Fr]),(0,R.useEffect)(()=>{nd.current=Lr},[Lr]),(0,R.useEffect)(()=>{rd.current=zr},[zr]),(0,R.useEffect)(()=>{id.current=Vr},[Vr]),(0,R.useEffect)(()=>{ad.current=Ur},[Ur]),(0,R.useEffect)(()=>{od.current=Gr},[Gr]),(0,R.useEffect)(()=>{sd.current=qr},[qr]),(0,R.useEffect)(()=>{cd.current=Yr},[Yr]),(0,R.useEffect)(()=>{ld.current=Zr},[Zr]),(0,R.useEffect)(()=>{ud.current=$r},[$r]),(0,R.useEffect)(()=>{dd.current=ti},[ti]),(0,R.useEffect)(()=>{fd.current=ri},[ri]),(0,R.useEffect)(()=>{pd.current=ai},[ai]),(0,R.useEffect)(()=>{md.current=si},[si]),(0,R.useEffect)(()=>{hd.current=li},[li]),(0,R.useEffect)(()=>{bd.current=Lo},[Lo]),(0,R.useEffect)(()=>{xd.current=zo},[zo]),(0,R.useEffect)(()=>{Sd.current=Vo},[Vo]),(0,R.useEffect)(()=>{Cd.current=Uo},[Uo]),(0,R.useEffect)(()=>{Td.current=ts},[ts]),(0,R.useEffect)(()=>{Ed.current=rs},[rs]),(0,R.useEffect)(()=>{Dd.current=as},[as]),(0,R.useEffect)(()=>{Od.current=di},[di]),(0,R.useEffect)(()=>{kd.current=pi},[pi]),(0,R.useEffect)(()=>{Ad.current=hi},[hi]),(0,R.useEffect)(()=>{jd.current=_i},[_i]),(0,R.useEffect)(()=>{Md.current=yi},[yi]),(0,R.useEffect)(()=>{Nd.current=xi},[xi]),(0,R.useEffect)(()=>{Pd.current=Ci},[Ci]),(0,R.useEffect)(()=>{Fd.current=Ti},[Ti]),(0,R.useEffect)(()=>{Rd.current=Di},[Di]),(0,R.useEffect)(()=>{zd.current=ki},[ki]),(0,R.useEffect)(()=>{Bd.current=ji},[ji]),(0,R.useEffect)(()=>{Vd.current=Ni},[Ni]),(0,R.useEffect)(()=>{Hd.current=Fi},[Fi]),(0,R.useEffect)(()=>{Ud.current=Li},[Li]),(0,R.useEffect)(()=>{Wd.current=zi},[zi]),(0,R.useEffect)(()=>{Gd.current=Vi},[Vi]),(0,R.useEffect)(()=>{Kd.current=Ui},[Ui]),(0,R.useEffect)(()=>{qd.current=Gi},[Gi]),(0,R.useEffect)(()=>{Jd.current=qi},[qi]),(0,R.useEffect)(()=>{Zd.current=Yi},[Yi]),(0,R.useEffect)(()=>{ef.current=Zi},[Zi]),(0,R.useEffect)(()=>{tf.current=$i},[$i]),(0,R.useEffect)(()=>{nf.current=ra},[ra]),(0,R.useEffect)(()=>{rf.current=aa},[aa]),(0,R.useEffect)(()=>{af.current=sa},[sa]),(0,R.useEffect)(()=>{of.current=la},[la]),(0,R.useEffect)(()=>{sf.current=da},[da]),(0,R.useEffect)(()=>{cf.current=pa},[pa]),(0,R.useEffect)(()=>{lf.current=ha},[ha]),(0,R.useEffect)(()=>{uf.current=_a},[_a]),(0,R.useEffect)(()=>{df.current=ec,ec&&rc(!1)},[ec]),(0,R.useEffect)(()=>{ff.current=nc,nc&&tc(!1)},[nc]),(0,R.useEffect)(()=>{pf.current=oc},[oc]),(0,R.useEffect)(()=>{if(!ic)return;let e=!0,t=performance.now();tc(!0),rc(!1);let n=window.setInterval(()=>{let n=Math.max(1,pf.current)*1e3;performance.now()-t>=n&&(e=!e,t=performance.now(),tc(e),rc(!e))},100);return()=>{window.clearInterval(n),tc(!1),rc(!1)}},[ic]),(0,R.useEffect)(()=>{Sl.current=$a,rp()},[$a]),(0,R.useEffect)(()=>{Cl.current=to},[to]),(0,R.useEffect)(()=>{wl.current=ro},[ro]),(0,R.useEffect)(()=>{Ol.current=fo},[fo]),(0,R.useEffect)(()=>{kl.current=mo},[mo]),(0,R.useEffect)(()=>{Al.current=go},[go]),(0,R.useEffect)(()=>{Tl.current=ao},[ao]),(0,R.useEffect)(()=>{El.current=so},[so]),(0,R.useEffect)(()=>{Dl.current=lo},[lo]),(0,R.useEffect)(()=>{Jl.current=yo},[yo]),(0,R.useEffect)(()=>{Yl.current=xo},[xo]),(0,R.useEffect)(()=>{Xl.current=Co},[Co]),(0,R.useEffect)(()=>{Zl.current=cc},[cc]),(0,R.useEffect)(()=>{Ql.current=uc},[uc]),(0,R.useEffect)(()=>{eu.current=To},[To]),(0,R.useEffect)(()=>{tu.current=Do},[Do]),(0,R.useEffect)(()=>{nu.current=ko},[ko]),(0,R.useEffect)(()=>{ru.current=jo},[jo]),(0,R.useEffect)(()=>{iu.current=No},[No]),(0,R.useEffect)(()=>{su.current=gs;let e=zc.current;e&&(e.geometry.dispose(),e.geometry=Ct(gs));let t=gs/mt;Bc.current?.scale.set(t,1,t),Vc.current?.scale.set(t,1,t);for(let e of Hc.current)e.scale.set(t,1,t)},[gs]),(0,R.useEffect)(()=>{Gc.current?.setConfig({enabled:vs&&!tr,radius:bs,tube:Ss,scale:ws,opacity:Es,textureUrl:tr?null:me[Os]?.url??null,cellSize:As,verticalSpacing:Ms,verticalCount:Ps,viewDistance:Is,fadeDistance:Rs})},[vs,bs,Ss,ws,Es,Os,As,Ms,Ps,Is,Rs,tr]),(0,R.useEffect)(()=>{let e=ql.current===`whirlpool`;ql.current=W,e&&W!==`whirlpool`&&(J.current.x=vd.current.x,J.current.z=vd.current.z),W===`noclip`||W===`watercraft`?(J.current.y=Y.current??eu.current,mf.current=0,$l.current=0,W===`watercraft`&&(J.current.x=Dt,J.current.z=-15,J.current.y=6,Y.current=6,Z.current=0,Q.current=-.28)):W===`whirlpool`?(_d.current={phase:`drag`,startMs:performance.now()},yd.current={x:J.current.x,z:J.current.z}):W===`swing`&&(cu.current=Z.current,wd.current=0,au.current={fromY:Y.current??eu.current,startMs:performance.now()})},[W]),(0,R.useEffect)(()=>{yc(W)},[W]),(0,R.useEffect)(()=>{if(!Go){cs(0),us(0),fs(0);return}let e=!1,t=0,n=performance.now(),r=n,i=ou.current,a=()=>{let e=[];return Td.current&&e.push(`float`),Ed.current&&e.push(`whirlpool`),Dd.current&&e.push(`swing`),e.length>0?e:[`float`]};vo(a()[0]),cs(0),us(0),fs(0);let o=window.setInterval(()=>{if(e)return;let o=performance.now(),s=Math.max(1,ps.current)*1e3,c=s-(o-r),l=a(),u=l[t%l.length],d=l[(t+1)%l.length],f=u===`swing`||d===`swing`,p=ou.current,m=Math.sign(p)!==Math.sign(i);if(i=p,f&&c<=5e3&&m||c<=0){if(t+=1,ms.current===`fixed`&&t>=hs.current){e=!0,Ko(!1);return}r=o;let n=a();vo(n[t%n.length]),cs(t)}us(Math.min(1,(o-r)/s)),fs((o-n)/1e3)},100);return()=>{e=!0,window.clearInterval(o)}},[Go]),(0,R.useEffect)(()=>{Gs(e=>{if(Math.hypot(e.x,e.y)>.15)return e;let t=Lr*Math.PI/180;return{x:Math.sin(t),y:Math.cos(t)}})},[Lr]);let hf=(e,t,n,r)=>{let i=o(r,Math.hypot(e.current.x,e.current.z)||1);e.current=i;let a=je(i.x,i.z,Z.current);t.current=a,n(a),e===X&&ta&&Rr((r%360+360)%360)},gf=e=>{Bu.current=(e%360+360)%360*Math.PI/180;let t={x:Math.sin(Bu.current),z:Math.cos(Bu.current)};zu.current=t;let n=je(t.x,t.z,Z.current);Gu.current=n,Ys(n)},_f=()=>{M(V.waveAmp),lt(V.waveSpeed),zt(V.waveFreq),Ht(V.bobSpeed),Wt(V.buoyAmp),qt(V.heightOffset),Yt(V.submergeAmp),Zt(V.floatLift),$t(V.waveAnticipation),tn(V.camOffX),rn(V.camOffY),on(V.camOffZ),un(V.audioOn),fn(V.audioVol),mn(V.audioSyncSpeed),gn(V.audioSpatial),vn(V.waterSoundIdx),bn(V.waterColorIdx),Sn(V.waterOpacity),wn(V.waterColorAlpha),En(V.waterHue),On(V.waterSat),An(V.waterBright),Mn(V.surfBright),Pn(V.surfSat),In(V.turbidity),Rn(V.bottomIdx),Bn(V.leanEnabled),Hn(V.gogglesOn),Wn(V.gogglesBlur),Kn(V.gogglesLoop),Jn(V.gogglesIntensity),Xn(V.gogglesFpsCap),Qn(V.targetFps),er(V.resolutionScale),nr(V.lowGraphicsMode),ir(V.regularWaves),or(V.realisticWaves),dr(V.dyingWave),pr(V.dyingWaveAmp),hr(V.dyingWaveSpeed),cr(V.randomizeWaves),vr(V.wavePreset),br(V.regularCross),Sr(V.regularPeriod),wr(V.wavePeak),Er(V.waveHighQuality),Or(V.backdropIdx),Ar(V.wakeLock),Mr(V.camFov),Pr(V.camNear),Ir(V.camFar),Rr(V.waveDir),Br(V.floorDepth),Hr(V.floorTexture),Wr(V.floorCloudsAnimated),Kr(V.whirlpoolOpening),Jr(V.whirlpoolRadius),Xr(V.whirlpoolSpeed),Qr(V.whirlpoolDirection),ei(V.whirlpoolSequenceOn),ni(V.whirlpoolDragSpeed),ii(V.whirlpoolDragDuration),oi(V.whirlpoolStayDuration),ci(V.whirlpoolExitMode),ui(V.whirlpoolExitSpeed),fi(V.depthSineOn),mi(V.depthSineAmp),gi(V.depthSineFreq),vi(V.depthSineSpeed),bi(V.depthSineInterval),Si(V.depthSinePeak),wi(V.depthSineWaveform),Ei(V.depthDriftSpeed),Ld.current=0,Id.current=0,Oi(V.hideWater),Ai(V.midCloudsOn),Mi(V.midCloudsHeight),Pi(V.skyCloudsOn),Ii(V.skyCloudsHeight),Ri(V.cloudFadeSpeed),Bi(V.skyPuffsOn),Hi(V.skyPuffsCount),Wi(V.skyPuffsSize),Ki(V.skyPuffsFreq),Ji(V.skyPuffsOpacity),Xi(V.swayAmp),Qi(V.swaySpeed),ea(V.swayBias),na(V.syncWaveWithSway),ia(V.surgeAmp),oa(V.surgeSpeed),ca(V.surgeRotationMode),ua(V.surgeRotationSpeed),fa(V.worldBoundaryOn),ma(V.worldBoundarySize),ga(V.worldBoundaryHeight),va(V.worldBoundaryYExtend),ba(V.liveMode),eo(V.reflStrength),no(V.bottomColor),io(V.sphereMaterial),oo(V.sphereStrength),co(V.trochoid),uo(V.heaveSkew),po(V.causticsOn),ho(V.chromaticAberrationOn),_o(V.chromaticAberrationAmount),vo(V.cameraMode),bo(V.noclipSpeed),So(V.noclipFallRiseSpeed),wo(V.noclipVertEaseTime),Eo(V.swingPositionY),Oo(V.swingIntensity),Ao(V.swingXFactor),Mo(V.swingHeight),Po(V.swingYWaveform),Ro(V.swingTornadoOn),Bo(V.swingTornadoRadius),Ho(V.swingTornadoSpeed),Wo(V.swingTornadoDirection),Ko(V.intervalSessionOn),Jo(V.intervalDuration),Xo(V.intervalSessionType),Qo(V.intervalCount),es(V.intervalShowStats),ns(V.intervalIncludeFloat),is(V.intervalIncludeWhirlpool),os(V.intervalIncludeSwing),_s(V.surfaceArea),Io(V.swingPreset),ys(V.torusRingsOn),xs(V.torusRadius),Cs(V.torusTube),Ts(V.torusScale),Ds(V.torusOpacity),ks(V.torusTextureIdx),js(V.torusCellSize),Ns(V.torusVerticalSpacing),Fs(V.torusVerticalCount),Ls(V.torusViewDistance),zs(V.torusFadeDistance)},vf=e=>{e.waveAmp!==void 0&&M(e.waveAmp),e.timeOfDay!==void 0&&Ge(e.timeOfDay),e.waveSpeed!==void 0&&lt(e.waveSpeed),e.waveFreq!==void 0&&zt(e.waveFreq),e.bobSpeed!==void 0&&Ht(e.bobSpeed),e.buoyAmp!==void 0&&Wt(e.buoyAmp),e.heightOffset!==void 0&&qt(e.heightOffset),e.submergeAmp!==void 0&&Yt(e.submergeAmp),e.floatLift!==void 0&&Zt(e.floatLift),e.waveAnticipation!==void 0&&$t(e.waveAnticipation),e.camOffX!==void 0&&tn(e.camOffX),e.camOffY!==void 0&&rn(e.camOffY),e.camOffZ!==void 0&&on(e.camOffZ),e.audioOn!==void 0&&un(e.audioOn),e.audioVol!==void 0&&fn(e.audioVol),e.audioSyncSpeed!==void 0&&mn(e.audioSyncSpeed),e.audioSpatial!==void 0&&gn(e.audioSpatial),e.waterSoundIdx!==void 0&&vn(e.waterSoundIdx),e.waterColorIdx!==void 0&&bn(e.waterColorIdx),e.waterOpacity!==void 0&&Sn(e.waterOpacity),e.waterColorAlpha!==void 0&&wn(e.waterColorAlpha),e.waterHue!==void 0&&En(e.waterHue),e.waterSat!==void 0&&On(e.waterSat),e.waterBright!==void 0&&An(e.waterBright),e.surfBright!==void 0&&Mn(e.surfBright),e.surfSat!==void 0&&Pn(e.surfSat),e.turbidity!==void 0&&In(e.turbidity),e.bottomIdx!==void 0&&Rn(e.bottomIdx),e.leanEnabled!==void 0&&Bn(e.leanEnabled),e.gogglesOn!==void 0&&Hn(e.gogglesOn),e.gogglesBlur!==void 0&&Wn(e.gogglesBlur),e.gogglesLoop!==void 0&&Kn(e.gogglesLoop),e.gogglesIntensity!==void 0&&Jn(e.gogglesIntensity),e.gogglesFpsCap!==void 0&&Xn(e.gogglesFpsCap),e.targetFps!==void 0&&Qn(e.targetFps),e.resolutionScale!==void 0&&er(e.resolutionScale),e.lowGraphicsMode!==void 0&&nr(e.lowGraphicsMode),e.regularWaves!==void 0&&ir(e.regularWaves),e.realisticWaves!==void 0&&or(e.realisticWaves),e.dyingWave!==void 0&&dr(e.dyingWave),e.dyingWaveAmp!==void 0&&pr(e.dyingWaveAmp),e.dyingWaveSpeed!==void 0&&hr(e.dyingWaveSpeed),e.randomizeWaves!==void 0&&cr(e.randomizeWaves),e.wavePreset!==void 0&&vr(e.wavePreset),e.regularCross!==void 0&&br(e.regularCross),e.regularPeriod!==void 0&&Sr(e.regularPeriod),e.wavePeak!==void 0&&wr(e.wavePeak),e.waveHighQuality!==void 0&&Er(e.waveHighQuality),e.backdropIdx!==void 0&&Or(e.backdropIdx),e.wakeLock!==void 0&&Ar(e.wakeLock),e.camFov!==void 0&&Mr(e.camFov),e.camNear!==void 0&&Pr(e.camNear),e.camFar!==void 0&&Ir(e.camFar),e.waveDir!==void 0&&Rr(e.waveDir),e.floorDepth!==void 0&&Br(e.floorDepth),e.floorTexture!==void 0&&Hr(e.floorTexture),e.floorCloudsAnimated!==void 0&&Wr(e.floorCloudsAnimated),e.whirlpoolOpening!==void 0&&Kr(e.whirlpoolOpening),e.whirlpoolRadius!==void 0&&Jr(e.whirlpoolRadius),e.whirlpoolSpeed!==void 0&&Xr(e.whirlpoolSpeed),e.whirlpoolDirection!==void 0&&Qr(e.whirlpoolDirection),e.whirlpoolSequenceOn!==void 0&&ei(e.whirlpoolSequenceOn),e.whirlpoolDragSpeed!==void 0&&ni(e.whirlpoolDragSpeed),e.whirlpoolDragDuration!==void 0&&ii(e.whirlpoolDragDuration),e.whirlpoolStayDuration!==void 0&&oi(e.whirlpoolStayDuration),e.whirlpoolExitMode!==void 0&&ci(e.whirlpoolExitMode),e.whirlpoolExitSpeed!==void 0&&ui(e.whirlpoolExitSpeed),e.depthSineOn!==void 0&&fi(e.depthSineOn),e.depthSineAmp!==void 0&&mi(e.depthSineAmp),e.depthSineFreq!==void 0&&gi(e.depthSineFreq),e.depthSineSpeed!==void 0&&vi(e.depthSineSpeed),e.depthSineInterval!==void 0&&bi(e.depthSineInterval),e.depthSinePeak!==void 0&&Si(e.depthSinePeak),e.depthSineWaveform!==void 0&&wi(e.depthSineWaveform),e.depthDriftSpeed!==void 0&&Ei(e.depthDriftSpeed),e.hideWater!==void 0&&Oi(e.hideWater),e.midCloudsOn!==void 0&&Ai(e.midCloudsOn),e.midCloudsHeight!==void 0&&Mi(e.midCloudsHeight),e.skyCloudsOn!==void 0&&Pi(e.skyCloudsOn),e.skyCloudsHeight!==void 0&&Ii(e.skyCloudsHeight),e.cloudFadeSpeed!==void 0&&Ri(e.cloudFadeSpeed),e.skyPuffsOn!==void 0&&Bi(e.skyPuffsOn),e.skyPuffsCount!==void 0&&Hi(e.skyPuffsCount),e.skyPuffsSize!==void 0&&Wi(e.skyPuffsSize),e.skyPuffsFreq!==void 0&&Ki(e.skyPuffsFreq),e.skyPuffsOpacity!==void 0&&Ji(e.skyPuffsOpacity),e.swayAmp!==void 0&&Xi(e.swayAmp),e.swaySpeed!==void 0&&Qi(e.swaySpeed),e.swayBias!==void 0&&ea(e.swayBias),e.syncWaveWithSway!==void 0&&na(e.syncWaveWithSway),e.surgeAmp!==void 0&&ia(e.surgeAmp),e.surgeSpeed!==void 0&&oa(e.surgeSpeed),e.surgeRotationMode!==void 0&&ca(e.surgeRotationMode),e.surgeRotationSpeed!==void 0&&ua(e.surgeRotationSpeed),e.worldBoundaryOn!==void 0&&fa(e.worldBoundaryOn),e.worldBoundarySize!==void 0&&ma(e.worldBoundarySize),e.worldBoundaryHeight!==void 0&&ga(e.worldBoundaryHeight),e.worldBoundaryYExtend!==void 0&&va(e.worldBoundaryYExtend),e.liveMode!==void 0&&ba(e.liveMode),e.sceneId!==void 0&&wa(e.sceneId),e.envId!==void 0&&ja(e.envId),e.envEra!==void 0&&Ma(e.envEra),e.envTime!==void 0&&Pa(e.envTime),e.timeTravelBaseMs!==void 0&&Ia(e.timeTravelBaseMs),e.timeTravelSetAtMs!==void 0&&Ra(e.timeTravelSetAtMs),e.timeSeasonalSync!==void 0&&Ba(e.timeSeasonalSync),e.clockOn!==void 0&&Ha(e.clockOn),e.surfaceId!==void 0&&Qa(e.surfaceId),e.reflStrength!==void 0&&eo(e.reflStrength),e.bottomColor!==void 0&&no(e.bottomColor),e.sphereMaterial!==void 0&&io(e.sphereMaterial),e.sphereStrength!==void 0&&oo(e.sphereStrength),e.trochoid!==void 0&&co(e.trochoid),e.heaveSkew!==void 0&&uo(e.heaveSkew),e.causticsOn!==void 0&&po(e.causticsOn),e.chromaticAberrationOn!==void 0&&ho(e.chromaticAberrationOn),e.chromaticAberrationAmount!==void 0&&_o(e.chromaticAberrationAmount),e.cameraMode!==void 0&&vo(e.cameraMode),e.noclipSpeed!==void 0&&bo(e.noclipSpeed),e.noclipFallRiseSpeed!==void 0&&So(e.noclipFallRiseSpeed),e.noclipVertEaseTime!==void 0&&wo(e.noclipVertEaseTime),e.swingPositionY!==void 0&&Eo(e.swingPositionY),e.swingIntensity!==void 0&&Oo(e.swingIntensity),e.swingXFactor!==void 0&&Ao(e.swingXFactor),e.swingHeight!==void 0&&Mo(e.swingHeight),e.swingPreset!==void 0&&Io(e.swingPreset),e.swingYWaveform!==void 0&&Po(e.swingYWaveform),e.swingTornadoOn!==void 0&&Ro(e.swingTornadoOn),e.swingTornadoRadius!==void 0&&Bo(e.swingTornadoRadius),e.swingTornadoSpeed!==void 0&&Ho(e.swingTornadoSpeed),e.swingTornadoDirection!==void 0&&Wo(e.swingTornadoDirection),e.intervalSessionOn!==void 0&&Ko(e.intervalSessionOn),e.intervalDuration!==void 0&&Jo(e.intervalDuration),e.intervalSessionType!==void 0&&Xo(e.intervalSessionType),e.intervalCount!==void 0&&Qo(e.intervalCount),e.intervalShowStats!==void 0&&es(e.intervalShowStats),e.intervalIncludeFloat!==void 0&&ns(e.intervalIncludeFloat),e.intervalIncludeWhirlpool!==void 0&&is(e.intervalIncludeWhirlpool),e.intervalIncludeSwing!==void 0&&os(e.intervalIncludeSwing),e.surfaceArea!==void 0&&_s(e.surfaceArea),e.torusRingsOn!==void 0&&ys(e.torusRingsOn),e.torusRadius!==void 0&&xs(e.torusRadius),e.torusTube!==void 0&&Cs(e.torusTube),e.torusScale!==void 0&&Ts(e.torusScale),e.torusOpacity!==void 0&&Ds(e.torusOpacity),e.torusTextureIdx!==void 0&&ks(e.torusTextureIdx),e.torusCellSize!==void 0&&js(e.torusCellSize),e.torusVerticalSpacing!==void 0&&Ns(e.torusVerticalSpacing),e.torusVerticalCount!==void 0&&Fs(e.torusVerticalCount),e.torusViewDistance!==void 0&&Ls(e.torusViewDistance),e.torusFadeDistance!==void 0&&zs(e.torusFadeDistance)},yf=e=>e===`all`?_:x[e],bf=(e,t)=>{let n=new Set(yf(e)),r={};for(let[e,i]of Object.entries(t))n.has(e)&&(r[e]=i);return r},xf=e=>{let t=Ne(e,ze(jl(),yf(e)));Me(`aquafulness-${e}-preset-${new Date().toISOString().replace(/[:.]/g,`-`)}.json`,t)},Sf=async(t,n)=>{try{let e=ae(await re(n));if(!e)throw Error(`invalid preset file`);vf(bf(t,e))}catch{window.alert(e(`presets.invalidPresetFile`))}},Cf=(e,t)=>{let n=ze(jl(),yf(e));xc(r=>p(r,t,e,n))},wf=e=>{let t=bc.find(t=>t.id===e);t&&vf(bf(t.scope,t.data))},Tf=e=>{xc(t=>D(t,e))},Ef=()=>({camera:{x:J.current.x,y:J.current.y,z:J.current.z,yaw:Z.current,pitch:Q.current},driftDir:{x:Lu.current.x,z:Lu.current.z},swayDir:{x:X.current.x,z:X.current.z},noclipDriftDir:{x:Ru.current.x,z:Ru.current.z},noclipVertDrift:{x:Kl.current.x,y:Kl.current.y},surgeDir:{x:zu.current.x,z:zu.current.z}}),Df=e=>{J.current.x=e.camera.x,J.current.y=e.camera.y,J.current.z=e.camera.z,Z.current=e.camera.yaw,Q.current=e.camera.pitch,Rt({x:J.current.x,y:J.current.y,z:J.current.z,yaw:Z.current,pitch:Q.current}),Lu.current=e.driftDir;let t=je(e.driftDir.x,e.driftDir.z,Z.current);Hu.current=t,Us(t),X.current=e.swayDir;let n=je(e.swayDir.x,e.swayDir.z,Z.current);if(Uu.current=n,qs(n),e.noclipDriftDir){Ru.current=e.noclipDriftDir;let t=je(e.noclipDriftDir.x,e.noclipDriftDir.z,Z.current);Wu.current=t,$s(t)}if(e.noclipVertDrift&&(Kl.current=e.noclipVertDrift,Zs(e.noclipVertDrift)),e.surgeDir){zu.current=e.surgeDir,Bu.current=Math.atan2(e.surgeDir.x,e.surgeDir.z);let t=je(e.surgeDir.x,e.surgeDir.z,Z.current);Gu.current=t,Ys(t)}},Of=()=>({...ze(jl(),_),runtime:Ef()}),kf=e=>{let{runtime:t,...n}=e;vf(bf(`all`,n)),T(t)&&Df(t)},Af=()=>{Me(`aquafulness-state-${new Date().toISOString().replace(/[:.]/g,`-`)}.json`,s(Of()))},jf=async t=>{try{let e=S(await re(t));if(!e)throw Error(`invalid state file`);kf(e)}catch{window.alert(e(`presets.invalidStateFile`))}},Mf=e=>{Cc(t=>C(t,e,Of()))},Nf=e=>{let t=Sc.find(t=>t.id===e);t&&kf(t.data)},Pf=e=>{Cc(t=>it(t,e))},Ff=async(e,t)=>{let n={v:1,s:ze(jl(),_),c:{x:J.current.x,y:J.current.y,z:J.current.z,yaw:Z.current,pitch:Q.current}},r=e.trim().slice(0,80),i=t.trim().slice(0,200);r&&(n.t=r),i&&(n.d=i);let a=await h(n);return de(window.location.origin,a)},If=e=>{let t=Ft[e];vr(e),M(t.waveAmp),lt(t.waveSpeed),zt(t.waveFreq),ir(t.regularWaves),or(t.realisticWaves),dr(t.dyingWave),pr(t.dyingWaveAmp),hr(t.dyingWaveSpeed),br(t.regularCross),Sr(t.regularPeriod),wr(t.wavePeak)},Lf=()=>{let e=Lt();e&&(J.current.x=e.x,J.current.z=e.z,typeof e.y==`number`&&(J.current.y=e.y),Z.current=e.yaw,Q.current=e.pitch)},Rf=e=>{let t=v.indexOf(W);vo(v[(t+e+v.length)%v.length])},zf=()=>{Ei(0),Id.current=0,Ld.current=0},Bf=e=>{Io(e),e===`water`?Eo(12):e===`clouds`&&Eo(Math.round(60+Fi*440))},Vf=e=>{let t=We.indexOf(Fo);Bf(We[(t+e+We.length)%We.length])},Hf=e=>{let t=b.indexOf(No);Po(b[(t+e+b.length)%b.length])},Uf=e=>{let t=j.indexOf(Ci);wi(j[(t+e+j.length)%j.length])},Wf=e=>{let t=[null,...xa.map(e=>e.id)],n=t.indexOf(Ca??null),r=((n<0?0:n)+e+t.length)%t.length;wa(t[r])},Gf=Ta.find(e=>e.id===Da)??Ta[0]??kt,Kf=e=>{let t=Ta.findIndex(e=>e.id===Gf.id),n=((t<0?0:t)+e+Ta.length)%Ta.length;Oa(Ta[n].id)},qf=()=>{let e=Gf;J.current.x=e.x,J.current.y=e.y,J.current.z=e.z,Z.current=e.yaw,Q.current=0,Y.current=e.y,Rt({x:e.x,y:e.y,z:e.z,yaw:e.yaw,pitch:0})},Jf=ka.find(e=>e.id===H)??null,Yf=Jf?.eras.find(e=>e.id===U)??null,Xf=Yf?.times.find(e=>e.id===Na)??null,Zf=e=>{if(!e){ja(null),Ma(null),Pa(null);return}let t=(ka.find(t=>t.id===e)??null)?.eras[0]??null;ja(e),Ma(t?.id??null),Pa(t?.times[0]?.id??null)},Qf=e=>{let t=[null,...ka.map(e=>e.id)],n=t.indexOf(H??null);Zf(t[((n<0?0:n)+e+t.length)%t.length])},$f=e=>{let t=Jf?.eras.find(t=>t.id===e);Ma(e),Pa(t?.times[0]?.id??null)},ep=e=>{if(!Jf||Jf.eras.length===0)return;let t=Jf.eras,n=Math.max(0,t.findIndex(e=>e.id===U));$f(t[(n+e+t.length)%t.length].id)},tp=e=>{if(!Yf||Yf.times.length===0)return;let t=Yf.times,n=Math.max(0,t.findIndex(e=>e.id===Na));Pa(t[(n+e+t.length)%t.length].id)};(0,R.useEffect)(()=>{if(!Va)return;let e=()=>{let e=Ee(Fa,La);Ka(e),za&&Ge(Oe(e));let t=ka.find(e=>e.id===H),n=Le(e),r=t?.eras.some(e=>e.id===`future`)??!1,i=t?.eras.some(e=>e.id===`present`)??!1;if(n&&r&&U!==`future`)Ja.current=!0,Ma(`future`),Pa(e=>{let n=t?.eras.find(e=>e.id===`future`);return n?.times.some(t=>t.id===e)?e:n?.times[0]?.id??e});else if(!n&&Ja.current&&U===`future`){Ja.current=!1;let e=i?`present`:t?.eras[0]?.id??null;e&&(Ma(e),Pa(n=>{let r=t?.eras.find(t=>t.id===e);return r?.times.some(e=>e.id===n)?n:r?.times[0]?.id??n}))}};e();let t=window.setInterval(e,6e4);return()=>window.clearInterval(t)},[Fa,La,za,Va,ka,H,U]);let np=e=>{let t=[null,...Ya.map(e=>e.id)],n=t.indexOf(Za??null);Qa(t[((n<0?0:n)+e+t.length)%t.length])},rp=()=>{let e=_l.current;e&&(e.uReflMix.value=$u.current?0:Math.max(0,Math.min(1,xl.current*Sl.current)))};(0,R.useEffect)(()=>{if(!ln){if(Ml.current){let e=Ml.current;e.master.gain.cancelScheduledValues(e.ctx.currentTime),e.master.gain.setTargetAtTime(0,e.ctx.currentTime,.4);let t=e;setTimeout(()=>{try{t.el.pause()}catch{}try{t.ctx.close()}catch{}},600),Ml.current=null}return}if(Ml.current){let e=Ml.current;try{e.el.pause()}catch{}try{e.ctx.close()}catch{}Ml.current=null}let e=new(window.AudioContext||window.webkitAudioContext),t=new Audio(he[_n]?.url??he[0].url);t.loop=!0,t.crossOrigin=`anonymous`,t.preload=`auto`,t.playbackRate=pn?Math.max(.2,Math.min(5,B)):1,t.preservesPitch=!0;let n=e.createMediaElementSource(t),r=e.createBiquadFilter();r.type=`lowpass`,r.frequency.value=18e3,r.Q.value=.6;let i=e.createGain();i.gain.value=0;let a=e.createGain();a.gain.value=1,n.connect(r).connect(i).connect(a).connect(e.destination),t.play().catch(()=>{}),i.gain.setTargetAtTime(dn,e.currentTime,.6),Ml.current={ctx:e,el:t,master:i,depthGain:a,lp:r}},[ln,_n]),(0,R.useEffect)(()=>{let e=Ml.current;e&&e.master.gain.setTargetAtTime(dn,e.ctx.currentTime,.2)},[dn]),(0,R.useEffect)(()=>{let e=Ml.current;e&&(e.el.playbackRate=pn?Math.max(.2,Math.min(5,B)):1,e.el.preservesPitch=!0)},[pn,B]),(0,R.useEffect)(()=>{if(typeof window>`u`)return;let e=navigator;if(!e.wakeLock)return;let t=null,n=!0,r=!1,i=async()=>{if(!(!kr||document.hidden))try{let a=await e.wakeLock.request(`screen`);if(!n){a.release().catch(()=>{});return}t=a,a.addEventListener(`release`,()=>{if(t=null,r){r=!1;return}n&&kr&&!document.hidden&&i()})}catch{}},a=()=>{t&&=(r=!0,t.release().catch(()=>{r=!1}),null)},o=()=>{document.hidden?a():i()};return i(),document.addEventListener(`visibilitychange`,o),()=>{n=!1,document.removeEventListener(`visibilitychange`,o),a()}},[kr]),(0,R.useEffect)(()=>{if(typeof window>`u`)return;let e=()=>{Dc(!0),Fc.current&&window.clearTimeout(Fc.current),!fc&&(Fc.current=window.setTimeout(()=>Dc(!1),3500))};e();let t={passive:!0};return window.addEventListener(`pointerdown`,e,t),window.addEventListener(`pointermove`,e,t),window.addEventListener(`touchstart`,e,t),window.addEventListener(`keydown`,e),()=>{Fc.current&&window.clearTimeout(Fc.current),window.removeEventListener(`pointerdown`,e),window.removeEventListener(`pointermove`,e),window.removeEventListener(`touchstart`,e),window.removeEventListener(`keydown`,e)}},[fc]),(0,R.useEffect)(()=>{if(typeof document>`u`)return;let e=()=>kc(!!document.fullscreenElement);return document.addEventListener(`fullscreenchange`,e),()=>document.removeEventListener(`fullscreenchange`,e)},[]);let ip=()=>{typeof document>`u`||(document.fullscreenElement?document.exitFullscreen?.().catch(()=>{}):document.documentElement.requestFullscreen?.().catch(()=>{}))};(0,R.useEffect)(()=>{let e=!0;return fetch(`/scenes/scenes.json`).then(e=>e.ok?e.json():Promise.reject(Error(`no scenes.json`))).then(t=>{if(!e)return;let n=Array.isArray(t)?t:t.scenes??[],r=(Array.isArray(n)?n:[]).map(e=>{let t=e;return typeof t.id==`string`?{id:t.id,name:typeof t.name==`string`?t.name:t.id}:null}).filter(e=>e!==null);Sa(r),wa(e=>e&&!r.some(t=>t.id===e)?null:e)}).catch(()=>{e&&Sa([])}),()=>{e=!1}},[]),(0,R.useEffect)(()=>{let e=!0;return fetch(`/environments/environment.json`).then(e=>e.ok?e.json():Promise.reject(Error(`no environment.json`))).then(t=>{e&&Aa(Pt(t))}).catch(()=>{e&&Aa([])}),()=>{e=!1}},[]),(0,R.useEffect)(()=>{if(ka.length===0||!H)return;let e=ka.find(e=>e.id===H);if(!e){ja(null),Ma(null),Pa(null);return}let t=e.eras.find(e=>e.id===U)??e.eras[0]??null;t?.id!==U&&Ma(t?.id??null);let n=t?.times.find(e=>e.id===Na)??t?.times[0]??null;n?.id!==Na&&Pa(n?.id??null)},[ka]),(0,R.useEffect)(()=>{let e=!0;return fetch(`/surfaces/surfaces.json`).then(e=>e.ok?e.json():Promise.reject(Error(`no surfaces.json`))).then(t=>{if(!e)return;let n=Array.isArray(t)?t:t.surfaces??[],r=(Array.isArray(n)?n:[]).map(e=>{let t=e;return typeof t.id==`string`?{id:t.id,name:typeof t.name==`string`?t.name:t.id}:null}).filter(e=>e!==null);Xa(r),Qa(e=>e&&!r.some(t=>t.id===e)?null:e)}).catch(()=>{e&&Xa([])}),()=>{e=!1}},[]),(0,R.useEffect)(()=>{let e=n.current;if(!e)return;let t=new De({antialias:!0,alpha:!0});t.setPixelRatio(Math.min(window.devicePixelRatio,2)*Qu.current),t.setSize(e.clientWidth,e.clientHeight),t.setClearColor(204851,1),t.domElement.style.position=`absolute`,t.domElement.style.top=`0`,t.domElement.style.left=`0`,e.appendChild(t.domElement);let i=new se;i.fog=new ue(8956620,0),Ic.current=i;let a=new nt(16777215,1);i.add(a);let o=new f(16777215,2241348,.6);i.add(o);let s=new m(Ju.current,e.clientWidth/e.clientHeight,ed.current,td.current),l=new Ze(e,s,i,e.clientWidth,e.clientHeight);l.setEditMode(Pc.current),Wc.current=l;let d=new Ue(t);d.addPass(new Te(i,s));let p=new Re(Vt);p.renderToScreen=!0,d.addPass(p);let h=new Ie(i,{enabled:r.torusRingsOn&&!r.lowGraphicsMode,radius:r.torusRadius,tube:r.torusTube,scale:r.torusScale,opacity:r.torusOpacity,color:16777215,textureUrl:r.lowGraphicsMode?null:me[r.torusTextureIdx]?.url??null,cellSize:r.torusCellSize,verticalSpacing:r.torusVerticalSpacing,verticalCount:r.torusVerticalCount,viewDistance:r.torusViewDistance,fadeDistance:r.torusFadeDistance});Gc.current=h;let g=new Ce(i,Dt,Ot,{onBlockCountChange:ol,onImportedStatic:()=>cl(`Imported as a static model (not a saved watercraft world).`)});G.current=g;let ee=e=>{ql.current!==`watercraft`||e.button!==0||(g.setPointerFromEvent(t.domElement,e.clientX,e.clientY),g.pointerDown(s))},_=e=>{ql.current===`watercraft`&&g.setPointerFromEvent(t.domElement,e.clientX,e.clientY)},v=()=>{g.pointerUp()};t.domElement.addEventListener(`pointerdown`,ee),t.domElement.addEventListener(`pointermove`,_),t.domElement.addEventListener(`pointerup`,v),t.domElement.addEventListener(`pointercancel`,v);let ne=new w(ft,ft,320,320);ne.rotateX(-Math.PI/2),bl.current=t.capabilities.getMaxAnisotropy?.()??4;let b=new xe(new Uint8Array([255,255,255,255]),1,1,Pe);b.needsUpdate=!0,yl.current=b;let{wave:x,phase:re}=Xe(lr),{wave:ae,phase:S}=Xe(gr),C={uTime:{value:0},uAmp:{value:y},uFft:{value:0},uFftWave:{value:x},uFftPhase:{value:re},uDying:{value:0},uDyingAmp:{value:fr},uDyingTime:{value:0},uDyingWave:{value:ae},uDyingPhase:{value:S},uSunDir:{value:new at(0,1,0)},uSkyColor:{value:new L(8956620)},uHorizonColor:{value:new L(16768426)},uWaterDeep:{value:new L(139844)},uWaterShallow:{value:new L(2787768)},uSunColor:{value:new L(16770736)},uFogColor:{value:new L(8956620)},uWaterColor:{value:new at(1,1,1)},uOverlayColor:{value:new at(1,0,0)},uOpacity:{value:1},uWaterColorAlpha:{value:0},uTintHue:{value:0},uTintSat:{value:1},uTintBright:{value:1},uSurfBright:{value:1},uSurfSat:{value:1},uUnderwater:{value:0},uRegular:{value:0},uCross:{value:1},uPeriod:{value:1},uFreq:{value:pt},uPeak:{value:1},uQuality:{value:0},uDir:{value:0},uVortex:{value:0},uVortexOpening:{value:14},uVortexCenter:{value:new ce(0,0)},uReflTex:{value:b},uReflMix:{value:0},uSphereMix:{value:0},uTrochoid:{value:0},uSkew:{value:0},uTurbidity:{value:0},uRefraction:{value:0},uFloorColor:{value:new L(14205048)},uFloorDepth:{value:14}};_l.current=C;let T=new E({uniforms:C,vertexShader:`
      uniform float uTime;
      uniform float uAmp;
      uniform float uRegular;
      uniform float uCross;
      uniform float uPeriod;
      uniform float uFreq;
      uniform float uPeak;
      uniform float uTrochoid;
      uniform float uSkew;
      uniform float uDir;
      uniform float uVortex;
      uniform float uVortexOpening;
      uniform vec2 uVortexCenter;
      // Realistic (JONSWAP/FFT-ocean) waveform, ported from
      // https://github.com/drsounds/OceanDemo (MIT, Popov / evpopov.com) —
      // see src/lib/ocean/fftOceanSpectrum.ts for the full derivation. Each
      // component is one cosine term of a spectrum-sampled sum-of-sinusoids
      // realization: vec4(kx, kz, amplitude, omega) + a parallel phase.
      uniform float uFft;
      uniform vec4 uFftWave[${ve}];
      uniform float uFftPhase[${ve}];
      // DÖENDE VÅG (dying wave) — a long, decaying-swell overlay blended in
      // on top of whichever base waveform (uRegular/uFft) is active, with its
      // own time base (uDyingTime, driven by the DÖD VÅG TEMPO dial) and own
      // height (uDyingAmp, DÖD VÅG HÖJD) so it can run independently of the
      // other wave layers. See generateDyingWaveComponents() in
      // src/lib/ocean/fftOceanSpectrum.ts.
      uniform float uDying;
      uniform float uDyingAmp;
      uniform float uDyingTime;
      uniform vec4 uDyingWave[10];
      uniform float uDyingPhase[10];
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      // FREKVENS scales each component's wave vector, which can push it past
      // the mesh's Nyquist limit into aliasing noise — fade those out. Mirror
      // of kAliasFade() in src/lib/ocean/fftOceanSpectrum.ts (same edges, so
      // the camera physics and the rendered surface agree); a no-op at
      // uFreq = 1, where no generated component reaches the fade's start.
      float kAliasFade(vec2 k) {
        return 1.0 - smoothstep(${Be.start}, ${Be.end}, length(k));
      }

      float fftHeight(vec2 xz, float t) {
        float h = 0.0;
        for (int i = 0; i < ${ve}; i++) {
          vec4 w = uFftWave[i];
          vec2 k = w.xy * uFreq;
          h += w.z * kAliasFade(k) * cos(k.x * xz.x + k.y * xz.y - w.w * t + uFftPhase[i]);
        }
        return h;
      }

      // Same idea as fftHeight() above, sampling the long-swell-only
      // DÖENDE VÅG component set instead — see generateDyingWaveComponents().
      float dyingHeight(vec2 xz, float t) {
        float h = 0.0;
        for (int i = 0; i < 10; i++) {
          vec4 w = uDyingWave[i];
          vec2 k = w.xy * uFreq;
          h += w.z * kAliasFade(k) * cos(k.x * xz.x + k.y * xz.y - w.w * t + uDyingPhase[i]);
        }
        return h;
      }

      // HEAVE SKEW — see warpPhase() in the JS above, kept in sync: warps
      // only a temporal phase (never a term that also carries x/z), applied
      // at each wave()/waveHeight() call site *before* combining with that
      // term's spatial phase, so any fixed-time snapshot of the mesh stays
      // an undistorted sine — no new phase-bunched faces.
      float warpPhase(float phase, float skew) {
        return phase + clamp(skew, 0.0, 0.9) * sin(phase);
      }

      // Rounded Gaussian crest boost — sharpens the wave top without creating
      // near-vertical phase-bunched faces that alias when viewed from the side.
      float shp(float theta) {
        float k = clamp((uPeak - 1.0) / 5.0, 0.0, 1.0);
        // Gaussian crest-pulse strength cut hard (was 0.28) — see
        // shapedWave() in the JS above for the numeric reasoning, kept in
        // sync.
        float amount = max(0.0, uPeak - 1.0) * 0.08;
        float wrapped = atan(sin(theta - 1.57079632679), cos(theta - 1.57079632679));
        float width = mix(0.72, 0.6, k);
        float crest = exp(-(wrapped * wrapped) / (2.0 * width * width));
        // Analytic mean of the Gaussian pulse over one period, so raising
        // SPETS keeps the mean surface level and only sharpens the top.
        float mean = width * 0.3989;
        // Extra pow-based crest boost purely on the positive lobe — adds a
        // realistic near-cusp peak without steepening the wave face.
        float base = sin(theta);
        float peakBoost = pow(max(base, 0.0), mix(1.0, 1.8, k)) - 0.3183 * mix(0.0, 1.0, k);
        // Smooth (Stokes-like) second-harmonic term — see shapedWave() in
        // the JS above, kept in sync. No kinks, safe at any SPETS value.
        float stokes = -cos(2.0 * theta) * k * 0.01;
        return (base + stokes + amount * (crest - mean) + k * 0.55 * peakBoost) / (1.0 + amount * 0.28 + k * 0.35 + k * 0.01);
      }


      float wave(vec3 pIn, float t, float amp, float rippleFade, float dyingAmp) {
        // Rotate horizontal coords by uDir so wave crests advance in the
        // chosen direction. Small ripples stay in world space so they still
        // sparkle from every angle. Uses compass-bearing convention (0 =
        // world +z, 90deg = world +x), matching the JS waveHeight() and the
        // angle dial, rather than the math-angle convention. Negated to
        // match waveHeight(): every phase term below is p.x/p.z*k + t*speed,
        // and that sign makes crests travel toward -p, not +p — the
        // negation here points +p (and so crest travel) at uDir directly.
        float cd = -sin(uDir), sd = -cos(uDir);
        vec3 p = vec3(cd * pIn.x + sd * pIn.z, pIn.y, -sd * pIn.x + cd * pIn.z);
        // Regular sine along x, with optional cross-axis sine so it doesn't
        // look like a flat carpet when uRegular = 1. uPeriod scales the
        // spatial wavelength (higher = longer, calmer swells); uFreq (FREKVENS)
        // scales it the other way, and unlike uPeriod also reaches the swell
        // and FFT terms below.
        float regX = shp(p.x * (0.12 * uFreq / uPeriod) + warpPhase(t * 0.9, uSkew)) * 2.6 * amp;
        float regZ = shp(p.z * (0.09 * uFreq / uPeriod) + warpPhase(t * 0.7 + 1.1, uSkew)) * 1.4 * amp * uCross;
        float reg = regX + regZ;

        // Large primary swell (chaotic sum of sines)
        float w1 = shp(p.x * 0.12 * uFreq + warpPhase(t * 0.9, uSkew)) * 1.0;
        float w2 = shp(p.z * 0.17 * uFreq + warpPhase(t * 0.7 + 1.3, uSkew)) * 0.75;
        float w3 = shp((p.x * 0.22 + p.z * 0.19) * uFreq + warpPhase(t * 1.4 + 2.1, uSkew)) * 0.5;
        float w4 = shp((p.x * 0.31 - p.z * 0.11) * uFreq + warpPhase(t * 1.8 + 0.4, uSkew)) * 0.35;
        float big = (w1 + w2 + w3 + w4) * amp;

        // Small ripples on top of the swell — high frequency, so they must
        // fade with distance well before the mesh becomes under-sampled or
        // they alias into jagged spikes at grazing angles. Deliberately left
        // out of uFreq: these are decorative surface sparkle rather than part
        // of the wave train, and they already sit near the mesh's resolution
        // limit, so scaling them up would alias straight into the boiling
        // look the distance fade above exists to prevent.
        float r1 = sin(p.x * 0.85 + p.z * 0.42 + t * 2.6) * 0.06;
        float r2 = sin(p.x * 0.55 - p.z * 0.95 + t * 3.1 + 1.7) * 0.05;
        float r3 = sin((p.x * 1.35 + p.z * 1.15) + t * 3.8 + 0.6) * 0.035;
        float r4 = sin((p.x * 1.9 - p.z * 1.6) + t * 4.7 + 2.3) * 0.022;
        float ripples = (r1 + r2 + r3 + r4) * (1.0 - uRegular) * rippleFade;

        float base = mix(big + ripples, reg, uRegular);
        if (uFft > 0.001) {
          float fft = fftHeight(p.xz, t) * amp;
          base = mix(base, fft, uFft);
        }
        if (uDying > 0.001) {
          float dying = dyingHeight(p.xz, uDyingTime) * dyingAmp;
          base = mix(base, dying, uDying);
        }
        return base;
      }

      void main() {
        vec3 p = position;
        vec4 wpBase = modelMatrix * vec4(p, 1.0);

        // Distance-based amplitude falloff — far triangles get very thin at
        // grazing angles and alias into jagged spikes on the horizon. Fade
        // waves smoothly to flat well before they hit the plane edge.
        float distXZ = length(wpBase.xz - cameraPosition.xz);
        // In vortex mode the camera orbits near the throat, so far water is
        // in view around the funnel. Push the fade out much further so the
        // surrounding sea stays alive instead of looking like a lone tornado
        // on a mirror-flat plane.
        float fadeNear = mix(40.0, 180.0, uVortex);
        float fadeFar  = mix(180.0, 500.0, uVortex);
        float ampFade = 1.0 - smoothstep(fadeNear, fadeFar, distXZ);
        float rippleNear = mix(18.0, 60.0, uVortex);
        float rippleFar  = mix(70.0, 220.0, uVortex);
        float rippleFade = 1.0 - smoothstep(rippleNear, rippleFar, distXZ);
        float ampF = uAmp * ampFade;
        float dyingAmpF = uDyingAmp * ampFade;

        float h = wave(wpBase.xyz, uTime, ampF, rippleFade, dyingAmpF);
        p.y += h;


        // approximate normal via finite differences — small epsilon so
        // the ripples contribute crisp shading.
        float e = 0.22;
        float hx = wave(wpBase.xyz + vec3(e, 0.0, 0.0), uTime, ampF, rippleFade, dyingAmpF);
        float hz = wave(wpBase.xyz + vec3(0.0, 0.0, e), uTime, ampF, rippleFade, dyingAmpF);
        vec3 n = normalize(vec3(h - hx, e, h - hz));

        // Trochoidal (Gerstner-like) horizontal displacement: shifts each
        // vertex sideways along the local wave slope, which bunches vertices
        // together on the rising face and spreads them apart in the trough —
        // the classic sharp-crest, wide-trough trochoid silhouette a pure
        // sine height field can't produce. This only ever moves the mesh
        // (visual); the JS-side waveHeight() the camera buoyancy reads is a
        // separate function untouched by uTrochoid, so it never feeds back
        // into camera movement.
        if (uTrochoid > 0.001) {
          float dhdx = (h - hx) / e;
          float dhdz = (h - hz) / e;
          float steepness = min(ampF, 3.0) * 0.7 * uTrochoid;
          p.x += dhdx * steepness;
          p.z += dhdz * steepness;
        }

        // Vortex funnel: sink the mesh toward the center with a Gaussian well.
        // Depth of the pit scales with the opening so the walls stay steep but
        // proportional. Inside the vortex we swap the directional swell for a
        // concentric radial wave — from an orbiting camera that reads as even,
        // uniform ripples rolling around the funnel instead of a directional
        // chop that appears to change direction as you circle.
        if (uVortex > 0.001) {
          vec2 rvec = wpBase.xz - uVortexCenter;
          float r = length(rvec);
          float op = max(1.0, uVortexOpening);
          float g = exp(-(r*r) / (op*op));
          float pit = -op * 1.6 * g;
          // Radial wave — analytic so the normal stays clean.
          float kR = 0.12 * uFreq / uPeriod;
          float phase = r * kR - uTime * 0.9;
          // Vortex waves must be an even sine wave: ignore SPETS/chaos/cross-wave
          // shaping here so the orbit never produces uneven jumps.
          float hR = sin(phase) * 2.6 * ampF;
          // dHr/dr for the radial normal
          float dHr = cos(phase) * kR * 2.6 * ampF;
          float pyRad = pit + hR * (1.0 - g * 0.85);
          p.y = mix(p.y, pyRad, uVortex);
          // Combined normal: funnel wall + radial ripple slope along rvec.
          float dg = -2.0 * g / (op * op);
          vec2 rn = r > 0.0001 ? rvec / r : vec2(0.0);
          float slopeR = dHr * (1.0 - g * 0.85) + (-op * 1.6) * dg * r; // d(pyRad)/dr
          vec3 nv = normalize(vec3(-rn.x * slopeR, 1.0, -rn.y * slopeR));
          n = normalize(mix(n, nv, uVortex));
        }

        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vNormal = n;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }

    `,fragmentShader:`
      uniform vec3 uSunDir;
      uniform vec3 uSkyColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uWaterDeep;
      uniform vec3 uWaterShallow;
      uniform vec3 uSunColor;
      uniform vec3 uWaterColor;
      // The water color picker's own flat overlay color (see the "Water
      // color overlay" block below) — independent of uWaterColor, which is
      // the always-on WATER preset tint multiplier.
      uniform vec3 uOverlayColor;
      uniform float uOpacity;
      // Independent alpha for the flat overlay color blended in below (see
      // the "Water color overlay" block) — separate from uOpacity
      // (translucency to whatever's behind the water).
      uniform float uWaterColorAlpha;
      uniform float uTintHue;
      uniform float uTintSat;
      uniform float uTintBright;
      uniform float uSurfBright;
      uniform float uSurfSat;
      uniform float uUnderwater;
      uniform float uTime;
      uniform float uAmp;
      uniform float uQuality;
      uniform sampler2D uReflTex;
      uniform float uReflMix;
      uniform float uSphereMix;
      uniform float uTurbidity;
      uniform float uRefraction;
      uniform vec3 uFloorColor;
      uniform float uFloorDepth;
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      // Hue rotation in RGB space (angle in radians).
      mat3 hueRotate(float angle) {
        float c = cos(angle), s = sin(angle);
        float oneThird = 1.0 / 3.0;
        float root3inv = 0.57735026919;
        return mat3(
          c + oneThird * (1.0 - c),         -root3inv * s + oneThird * (1.0 - c),  root3inv * s + oneThird * (1.0 - c),
          root3inv * s + oneThird * (1.0 - c), c + oneThird * (1.0 - c),          -root3inv * s + oneThird * (1.0 - c),
          -root3inv * s + oneThird * (1.0 - c), root3inv * s + oneThird * (1.0 - c), c + oneThird * (1.0 - c)
        );
      }

      // Value noise + fbm reused from the seafloor shader, for the optional
      // high-quality micro-chop and foam below. Kept to 3 octaves (vs the
      // floor's 5) since this runs per-pixel over the whole ocean plane.
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
      float vnoise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0,0.0));
        float c = hash(i + vec2(0.0,1.0));
        float d = hash(i + vec2(1.0,1.0));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
      }
      float fbm(vec2 p){
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * vnoise(p);
          p *= 2.02; a *= 0.5;
        }
        return v;
      }

      // Procedural sphere-map ("matcap") material: instead of sampling a
      // real environment, a glossy sphere-lit look is derived analytically
      // from the surface's VIEW-SPACE normal (the classic matcap trick) —
      // an off-center highlight blob plus a rim brighten, always coherent
      // from any camera angle and needing no extra texture asset.
      vec3 sphereMapShade(vec3 Nsh, vec3 baseCol) {
        vec3 viewN = normalize((viewMatrix * vec4(Nsh, 0.0)).xyz);
        vec2 muv = viewN.xy * 0.5 + 0.5;
        float hiCore = smoothstep(0.16, 0.0, length(muv - vec2(0.32, 0.68)));
        float hiSoft = smoothstep(0.55, 0.0, length(muv - vec2(0.32, 0.68)));
        float rim = pow(clamp(1.0 - viewN.z, 0.0, 1.0), 3.0);
        vec3 body = mix(baseCol * 0.32, baseCol * 0.95, hiSoft);
        return body + vec3(1.0) * hiCore * 0.95 + uSkyColor * rim * 0.6;
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // Apply user color adjustments on top of the water-color preset.
        vec3 tint = uWaterColor * uTintBright;
        tint = hueRotate(uTintHue) * tint;
        vec3 gray = vec3(dot(tint, vec3(0.299, 0.587, 0.114)));
        tint = mix(gray, tint, uTintSat);

        float NdotV = clamp(dot(N, V), 0.0, 1.0);

        // Schlick Fresnel with water's real F0 (~0.02) — grazing angles push
        // reflectance to 1.0 for natural rim shimmer, straight-down stays dim.
        float F0 = 0.02;
        float fres = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);

        // Distance from camera in the water plane — same idea as the vertex
        // shader's ampFade/rippleFade (see uTrochoid's neighborhood above),
        // but computed here since the fine per-pixel normal perturbations
        // below have no vertex-side equivalent to inherit a fade from. Every
        // wave mode (REGELBUNDEN/FFT-HAV/DÖENDE VÅG) shares this same
        // fragment shader, so an un-faded high-frequency term here reads as
        // "boiling water" regardless of which waveform is actually driving
        // the mesh underneath it.
        float shimDist = length(vWorldPos.xz - cameraPosition.xz);

        // Micro-shimmer: high-frequency normal perturbation for scale-fine
        // sparkle that only shows up near the Fresnel rim / sun highlight.
        // At ~4-6 rad/m (≈1-1.7m wavelength) this is far finer than anything
        // else in the shader and had no distance fade at all, so once enough
        // of the visible water sits at a grazing angle — where each pixel's
        // footprint spans many wavelengths of it — it aliased into a dense,
        // shimmering "boiling" texture instead of the intended sparse sparkle.
        // Distance alone isn't enough to tame it though: reflect(-V, Nshim)
        // is inherently hypersensitive to normal perturbation right as NdotV
        // approaches 0 (a grazing ray's reflection direction swings hugely
        // for a tiny normal wobble), so even a mostly-distance-faded shim
        // still visibly shimmers at the most extreme grazing angles — fade
        // it out there too, accepting a little less rim sparkle for a lot
        // less boiling.
        float shimFade = (1.0 - smoothstep(10.0, 40.0, shimDist)) * smoothstep(0.02, 0.15, NdotV);
        float shim = sin(vWorldPos.x * 3.7 + vWorldPos.z * 4.3) *
                     sin(vWorldPos.x * 5.1 - vWorldPos.z * 6.2) * shimFade;
        vec3 Nshim = normalize(N + vec3(shim * 0.06, 0.0, shim * 0.05));

        // Fine procedural micro-chop + whitecap foam (HIGH quality only) —
        // breaks up the too-clean analytic-sine "plasma" look with organic,
        // non-repeating detail, and adds animated, patchy foam near steep,
        // high crests. uQuality is a uniform (same value for every fragment
        // in the draw call), so this branch is free when off, and LOW
        // quality stays byte-for-byte the original shading.
        float foam = 0.0;
        if (uQuality > 0.5) {
          // Coarser frequency than shim above, so it stays resolved (and
          // fades out) at a proportionally longer distance; same grazing-
          // angle taming since it feeds the same reflection-sensitive Nshim.
          float microFade = (1.0 - smoothstep(20.0, 90.0, shimDist)) * smoothstep(0.02, 0.15, NdotV);
          float n1 = fbm(vWorldPos.xz * 0.6 + vec2(uTime * 0.05, uTime * 0.03));
          float n2 = fbm(vWorldPos.xz * 2.3 - vec2(uTime * 0.08, uTime * 0.11));
          float microBump = ((n1 - 0.5) * 0.05 + (n2 - 0.5) * 0.025) * microFade;
          Nshim = normalize(Nshim + vec3(microBump, 0.0, microBump * 0.7));

          float slope = 1.0 - N.y;
          float crestF = smoothstep(uAmp * 0.55, uAmp * 1.3, vWorldPos.y);
          float foamNoise = fbm(vWorldPos.xz * 0.8 + vec2(uTime * 0.12, -uTime * 0.09));
          foam = clamp(crestF * (0.35 + slope * 1.8) * smoothstep(0.3, 0.75, foamNoise), 0.0, 1.0);
        }

        // Sky reflection — sample along the reflection vector so different
        // camera angles pick different sky bands (horizon vs zenith).
        vec3 R = reflect(-V, Nshim);
        float rUp = clamp(R.y, 0.0, 1.0);
        vec3 skyRef = mix(uHorizonColor, uSkyColor, pow(rUp, 0.65));

        // Selectable photo reflection: map the reflection direction to
        // equirectangular-ish UVs (azimuth → u, elevation → v) and sample a
        // real surface photo. Because R is built from the wave-perturbed
        // normal, the reflected image ripples and breaks up with the swell —
        // far cheaper than planar/SSR reflections but far richer than the flat
        // gradient. Modulated by daylight so it still darkens at night.
        if (uReflMix > 0.001) {
          vec2 reflUv = vec2(atan(R.z, R.x) * 0.15915494 + 0.5, clamp(1.0 - rUp, 0.0, 1.0));
          vec3 photo = texture2D(uReflTex, reflUv).rgb;
          float daylight = clamp(uSunDir.y + 0.35, 0.12, 1.15);
          // Keep the gradient's hue as a base (25%) so dawn/dusk still tints
          // the water; the photo supplies the detail (75%).
          vec3 envRefl = mix(skyRef, photo * daylight, 0.75);
          skyRef = mix(skyRef, envRefl, uReflMix);
        }

        // Refraction tint — view-dependent transmitted color. Straight down
        // we see into the deep hue; at grazing angles the shallow tint takes
        // over just before Fresnel flips everything to reflection.
        vec3 deepT = uWaterDeep * tint;
        vec3 shalT = uWaterShallow * tint;
        float refrMix = mix(0.15, 0.85, pow(1.0 - NdotV, 1.6));
        vec3 water = mix(deepT, shalT, refrMix);

        // ÄKTA KAUSTIK / optisk ljusbrytning: bend the view ray through the
        // surface with real Snell's law (air->water, IOR 1.333) and see how
        // far it has to travel to reach the seafloor. Near-vertical looks
        // into shallow water land close by, so the true sand tint shows
        // through instead of the fixed deep/shallow gradient; steep angles
        // or deep water travel far enough that the approximation fades back
        // to the plain gradient.
        if (uRefraction > 0.001) {
          vec3 refr = refract(-V, N, 1.0 / 1.333);
          if (dot(refr, refr) > 0.0001) {
            float travel = uFloorDepth / max(0.05, -refr.y);
            float seeBottom = clamp(1.0 - travel / 45.0, 0.0, 1.0);
            vec3 bottomTint = uFloorColor * clamp(uSunDir.y + 0.3, 0.2, 1.0) * tint;
            water = mix(water, bottomTint, seeBottom * 0.6 * uRefraction);
          }
        }

        // Subsurface scattering — light bleeding through wave crests
        float height = clamp((vWorldPos.y + 1.0) / 3.0, 0.0, 1.0);
        vec3 sss = uSunColor * pow(height, 2.0) * 0.35 * clamp(uSunDir.y + 0.2, 0.0, 1.0);
        water += sss * tint;

        // Specular sun glint — Blinn-Phong with shimmer-perturbed normal so
        // sparkle scatters realistically. Sharpen when sun is low (long glitter
        // path across the surface), soften at noon.
        vec3 H = normalize(L + V);
        float sunElev = clamp(uSunDir.y, 0.0, 1.0);
        float shin = mix(220.0, 80.0, sunElev);
        float spec = pow(max(dot(Nshim, H), 0.0), shin);
        float grazeBoost = 1.0 + (1.0 - NdotV) * 1.5;
        vec3 sun = uSunColor * spec * clamp(uSunDir.y + 0.2, 0.0, 1.0)
                   * 2.8 * grazeBoost * (1.0 - uUnderwater);

        // Reflective share of this pixel (sky/photo Fresnel term) — kept
        // around post-mix so the alpha/compositing step below can tell it
        // apart from the transmitted water body.
        float reflAmt = fres * (1.0 - uUnderwater * 0.85);
        vec3 col = mix(water, skyRef, reflAmt) + sun;

        // Selectable sphere-map ("matcap") material — a distinct, glossier
        // look the user opts into per VÅGMATERIAL, blended on top of the
        // regular Fresnel/sky shading rather than replacing it outright.
        if (uSphereMix > 0.001) {
          col = mix(col, sphereMapShade(Nshim, water), uSphereMix);
        }

        // The color picker's flat uOverlayColor and the whitecap foam are
        // *not* folded into col here — they're composited as their own
        // layers, on top of the shaded water body, further down (see the
        // Translucency block below) so they stay visible independently of
        // how transparent uOpacity makes the body underneath.

        // Final surface color adjustment (independent of internal tint).
        col *= uSurfBright;
        float sg = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(sg), col, uSurfSat);

        // Underwater tone-down: desaturate + darken, pulled toward tinted deep hue.
        if (uUnderwater > 0.0) {
          float g = dot(col, vec3(0.299, 0.587, 0.114));
          vec3 muted = mix(vec3(g), deepT * 1.1, 0.55) * (1.0 - 0.35 * uUnderwater);
          col = mix(col, muted, clamp(uUnderwater, 0.0, 1.0));
        }

        // Grumlighet (turbidity): once submerged, real depth-based fog on
        // top of the flat tone-down above so diving deeper into murky water
        // keeps getting hazier instead of plateauing at the same fixed
        // darken. This plane is small and finely tessellated (unlike the
        // seafloor), so a plain interpolated-position distance is accurate
        // here — no depth-buffer reconstruction needed.
        if (uTurbidity > 0.001 && uUnderwater > 0.001) {
          float distC = length(cameraPosition - vWorldPos);
          float murk = clamp(1.0 - exp(-distC * uTurbidity * 0.01), 0.0, 0.95) * uUnderwater;
          col = mix(col, deepT * 0.55, murk);
        }

        // Translucency — uOpacity controls how see-through the water is.
        // The water is built from three independent layers, each composited
        // "over" the last with its own alpha (standard Porter-Duff, kept in
        // premultiplied form — see mat.premultipliedAlpha below), instead of
        // one flat mix of everything into a single alpha. That's what makes
        // uOpacity actually empty the shaded body out to nothing rather than
        // leaving a residual tinted haze:
        //   1. body  — col as shaded above (tint, reflection, sun, sphere
        //      material, underwater tone-down, turbidity). Alpha is
        //      bodyAlpha, plain uOpacity with no boost: 0 is fully gone, 1
        //      is fully opaque, and every value between fades linearly.
        //   2. paint — the color picker's flat uOverlayColor (WaterColorPicker
        //      in SettingsPanel.tsx). Alpha is uWaterColorAlpha ("COLOR
        //      STRENGTH") times visGate — deliberately *not* multiplied by
        //      bodyAlpha, so a chosen color reads as paint sitting on top of
        //      however transparent the water is, not something that fades
        //      away at the same rate the body does.
        //   3. foam — whitecap highlights, alpha is the foam strength
        //      computed above times visGate, unaffected by uSurfBright/
        //      uSurfSat/underwater toning (those apply to the body only).
        // visGate is a curve that's exactly 0 at uOpacity = 0 (so paint and
        // foam still respect "0 = fully invisible", same as VATTENYTA/
        // hideWater) but rises to ~1 almost immediately after, so neither
        // layer fades proportionally with the body — they stay visible
        // through fairly transparent water instead of thinning out with it.
        float bodyAlpha = clamp(uOpacity, 0.0, 1.0);
        float visGate = pow(bodyAlpha, 0.35);

        vec3 premult = col * bodyAlpha;
        float alpha = bodyAlpha;

        float paintAlpha = clamp(uWaterColorAlpha, 0.0, 1.0) * visGate;
        premult = uOverlayColor * paintAlpha + premult * (1.0 - paintAlpha);
        alpha = paintAlpha + alpha * (1.0 - paintAlpha);

        float foamAlpha = clamp(foam * 0.85 * (1.0 - uUnderwater), 0.0, 1.0) * visGate;
        premult = vec3(0.95, 0.98, 1.0) * foamAlpha + premult * (1.0 - foamAlpha);
        alpha = foamAlpha + alpha * (1.0 - foamAlpha);

        gl_FragColor = vec4(premult, alpha);
      }
    `,transparent:!0,premultipliedAlpha:!0,depthWrite:!0,side:2});T.forceSinglePass=!0;let D=new O(ne,T);Rc.current=D,i.add(D);let le=new O(Ct(su.current),T);zc.current=le,i.add(le);let de=new w(9e5,9e5,32,32);de.rotateX(-Math.PI/2);let k=new ie().load(u.url);k.wrapS=c,k.wrapT=c,k.anisotropy=t.capabilities.getMaxAnisotropy?.()??4,k.colorSpace=oe;let A={uColor:{value:new L(14205048)},uTextured:{value:0},uClouds:{value:0},uCloudScroll:{value:new ce(0,0)},uTime:{value:0},uSunDir:{value:C.uSunDir.value},uSandTex:{value:k},uSandScale:{value:.35},uTurbidity:{value:0},uUnderwater:{value:0},uFogColor:{value:new L(666170)},uCamNear:{value:ed.current},uCamFar:{value:td.current},uCausticsOn:{value:0},uSunColor:{value:C.uSunColor.value},uFftWave:{value:x},uFftPhase:{value:re},uCausticAmp:{value:y},uCausticFreq:{value:pt},uCausticDepth:{value:14},uOpacity:{value:1}},j=new E({uniforms:A,side:2,transparent:!0,depthWrite:!0,vertexShader:`
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,fragmentShader:`
        precision highp float;
        varying vec2 vUv;
        varying vec3 vWorld;
        uniform vec3 uColor;
        uniform float uTextured;
        uniform float uClouds;
        uniform vec2 uCloudScroll;
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform sampler2D uSandTex;
        uniform float uSandScale;
        uniform float uTurbidity;
        uniform float uUnderwater;
        uniform vec3 uFogColor;
        uniform float uCamNear;
        uniform float uCamFar;
        // ÄKTA KAUSTIK: real Snell's-law refraction + ray-density caustics,
        // driven by the same FFT wave spectrum the ocean surface itself
        // renders with (see uFftWave/uFftPhase in the ocean vertex shader,
        // src/lib/ocean/fftOceanSpectrum.ts) — off by default since it costs
        // several extra wave-sum evaluations per seafloor fragment.
        uniform float uCausticsOn;
        uniform vec3 uSunColor;
        uniform vec4 uFftWave[${ve}];
        uniform float uFftPhase[${ve}];
        uniform float uCausticAmp;
        uniform float uCausticFreq;
        uniform float uCausticDepth;
        // Per-mesh fade-in/out multiplier (see uOpacity in floorUniforms/
        // midCloudUniforms/skyCloudUniforms) — lets each cloud layer (the
        // main mid/sky decks and VÄRLDSGRÄNS's extra y-extension layers,
        // each with its own material instance) ease in/out independently
        // instead of popping visible/invisible, at MOLN TONING's rate.
        uniform float uOpacity;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
        float vnoise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0,0.0));
          float c = hash(i + vec2(0.0,1.0));
          float d = hash(i + vec2(1.0,1.0));
          vec2 u = f*f*(3.0-2.0*f);
          return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
        }
        float fbm(vec2 p){
          float v = 0.0; float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * vnoise(p);
            p *= 2.02; a *= 0.5;
          }
          return v;
        }

        // Same FFT ocean-spectrum sum used by the water surface's vertex
        // shader (kept in sync via the shared FFT_WAVE_COUNT/K_ALIAS_FADE_GLSL
        // constants), so the seafloor caustics below are driven by the
        // actual live wave state rather than independent decorative noise.
        float kAliasFade(vec2 k) {
          return 1.0 - smoothstep(${Be.start}, ${Be.end}, length(k));
        }
        float fftHeight(vec2 xz, float t) {
          float h = 0.0;
          for (int i = 0; i < ${ve}; i++) {
            vec4 w = uFftWave[i];
            vec2 k = w.xy * uCausticFreq;
            h += w.z * kAliasFade(k) * cos(k.x * xz.x + k.y * xz.y - w.w * t + uFftPhase[i]);
          }
          return h;
        }

        // Real caustics: refract the sun ray through the true wave-surface
        // normal at three neighboring points (finite differences of
        // fftHeight) and measure how much the resulting rays converge
        // (bright focus) or spread apart (dim) by the time they reach the
        // seafloor — the actual ray-density mechanism real underwater
        // caustics come from, applied to this scene's live wave field.
        float causticIntensity(vec2 xz) {
          float e = 0.5;
          float h0  = fftHeight(xz, uTime) * uCausticAmp;
          float hx  = fftHeight(xz + vec2(e, 0.0), uTime) * uCausticAmp;
          float hz  = fftHeight(xz + vec2(0.0, e), uTime) * uCausticAmp;
          float hxx = fftHeight(xz + vec2(2.0 * e, 0.0), uTime) * uCausticAmp;
          float hxz = fftHeight(xz + vec2(e, e), uTime) * uCausticAmp;
          float hzz = fftHeight(xz + vec2(0.0, 2.0 * e), uTime) * uCausticAmp;

          vec3 n0 = normalize(vec3(h0 - hx, e, h0 - hz));
          vec3 nx = normalize(vec3(hx - hxx, e, hx - hxz));
          vec3 nz = normalize(vec3(hz - hxz, e, hz - hzz));

          vec3 sunDirN = normalize(uSunDir);
          float eta = 1.0 / 1.333; // air -> water
          vec3 r0 = refract(-sunDirN, n0, eta);
          vec3 rx = refract(-sunDirN, nx, eta);
          vec3 rz = refract(-sunDirN, nz, eta);

          float depth0 = max(0.1, uCausticDepth - h0);
          float depthx = max(0.1, uCausticDepth - hx);
          float depthz = max(0.1, uCausticDepth - hz);

          vec2 hit0 = xz + r0.xz * (depth0 / max(0.05, -r0.y));
          vec2 hitx = (xz + vec2(e, 0.0)) + rx.xz * (depthx / max(0.05, -rx.y));
          vec2 hitz = (xz + vec2(0.0, e)) + rz.xz * (depthz / max(0.05, -rz.y));

          vec2 edge1 = hitx - hit0;
          vec2 edge2 = hitz - hit0;
          float refractedArea = abs(edge1.x * edge2.y - edge1.y * edge2.x);
          float undisturbedArea = e * e;
          float intensity = clamp(undisturbedArea / max(refractedArea, 0.02), 0.0, 8.0);
          return pow(intensity, 1.3);
        }

        // Grumlighet (turbidity): murks up whatever is visible below the
        // water line — suspended particles both dim/desaturate light overall
        // (a flat mix toward the fog tint, independent of distance) and
        // scatter it more the further away / the more submerged the camera
        // is, swallowing detail into a patchy haze. uTurbidity=0 reproduces
        // the exact original look; the fbm patchiness keeps dense turbidity
        // from reading as a flat, unnaturally uniform curtain.
        vec3 applyTurbidity(vec3 col) {
          if (uTurbidity <= 0.001) return col;
          // Distance from the depth buffer, not from interpolating vWorld:
          // this seafloor is one 200,000-unit plane with only 32 segments,
          // so its vertices sit thousands of units apart. A triangle with
          // one corner almost underfoot and the other two kilometers away
          // makes the rasterizer's perspective-correct interpolation of any
          // world-space varying (vWorld included) collapse — every nearby
          // fragment was reading back thousands of units "away". Rebuilding
          // linear view depth from gl_FragCoord.z sidesteps that entirely.
          float ndcZ = gl_FragCoord.z * 2.0 - 1.0;
          float distC = (2.0 * uCamNear * uCamFar) / (uCamFar + uCamNear - ndcZ * (uCamFar - uCamNear));
          // At a level, near-horizon gaze the grazing angle over this huge
          // seafloor plane means most on-screen "floor" pixels are actually
          // hundreds/thousands of units away, so the density has to be tiny
          // — this keeps nearby sand (tens of units) essentially clear even
          // at uTurbidity=1, only swallowing the far distance into haze, and
          // thickens noticeably once the camera itself is submerged.
          float density = uTurbidity * (0.0012 + 0.006 * uUnderwater);
          float fogAmt = clamp(1.0 - exp(-distC * density), 0.0, 0.92);
          float patchy = fbm(vWorld.xz * 0.06 + uTime * 0.015);
          fogAmt *= 0.75 + 0.35 * patchy;
          vec3 muted = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), uFogColor, 0.6);
          col = mix(col, muted, uTurbidity * 0.3);
          col = mix(col, uFogColor, fogAmt);
          return col;
        }

        void main(){
          if (uClouds > 0.5) {
            vec2 p = vWorld.xz * 0.025 + uCloudScroll;
            float n = fbm(p);
            float cloud = smoothstep(0.45, 0.78, n);
            if (cloud < 0.01) discard;
            // Mild ljus/skugga för volym.
            float shade = 0.85 + 0.25 * fbm(p * 2.3 + 5.0);
            vec3 col = uColor * shade;
            col = applyTurbidity(col);
            gl_FragColor = vec4(col, cloud * uOpacity);
            return;
          }
          vec3 base = uColor;
          if (uTextured > 0.001) {
            vec2 uv0 = vWorld.xz * uSandScale;
            vec3 s1 = texture2D(uSandTex, uv0).rgb;
            mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
            vec3 s2 = texture2D(uSandTex, rot * uv0 * 0.25 + 0.13).rgb;
            vec3 sand = (s1 + s2) * 0.5;
            sand = (sand - 0.5) * 1.15 + 0.55;
            sand *= uColor * 1.9;
            sand = clamp(sand, 0.0, 1.6);
            vec2 p = vWorld.xz;
            float caustic = 0.0;
            caustic += sin(p.x*0.9 + uTime*0.7 + vnoise(p*0.4)*4.0);
            caustic += sin(p.y*0.85 - uTime*0.55 + vnoise(p*0.35 + 3.1)*4.0);
            caustic = pow(max(0.0, caustic*0.5 + 0.5), 3.0);
            if (uCausticsOn > 0.001) {
              float realCaustic = causticIntensity(p) * clamp(uSunDir.y + 0.15, 0.0, 1.0);
              caustic = mix(caustic, realCaustic, uCausticsOn);
              sand += uSunColor * caustic * 0.22 * uCausticsOn;
              sand += vec3(0.95, 0.88, 0.7) * caustic * 0.22 * (1.0 - uCausticsOn);
            } else {
              sand += vec3(0.95, 0.88, 0.7) * caustic * 0.22;
            }
            base = mix(uColor, sand, clamp(uTextured, 0.0, 1.0));
          }
          base = applyTurbidity(base);
          gl_FragColor = vec4(base, 1.0);
        }
      `}),he=new O(de,j);he.position.y=-14,he.visible=!1,he.renderOrder=-2,i.add(he);let ge=new w(2e5,2e5,8,8);ge.rotateX(-Math.PI/2);let _e={uColor:{value:new L(16777215)},uTextured:{value:0},uClouds:{value:1},uCloudScroll:{value:new ce(0,0)},uTime:{value:0},uSunDir:{value:C.uSunDir.value},uSandTex:{value:k},uSandScale:{value:.35},uTurbidity:{value:0},uUnderwater:{value:0},uFogColor:{value:new L(666170)},uCamNear:{value:ed.current},uCamFar:{value:td.current},uOpacity:{value:0}},be=new E({uniforms:_e,side:2,transparent:!0,depthWrite:!1,vertexShader:j.vertexShader,fragmentShader:j.fragmentShader}),Se=new O(ge,be);Se.position.y=-7,Se.visible=!1,Se.renderOrder=-1;let M=su.current/mt;Se.scale.set(M,1,M),Bc.current=Se,i.add(Se);let we=new w(2e5,2e5,8,8);we.rotateX(-Math.PI/2);let N={uColor:{value:new L(16777215)},uTextured:{value:0},uClouds:{value:1},uCloudScroll:{value:new ce(0,0)},uTime:{value:0},uSunDir:{value:C.uSunDir.value},uSandTex:{value:k},uSandScale:{value:.35},uTurbidity:{value:0},uUnderwater:{value:0},uFogColor:{value:new L(666170)},uCamNear:{value:ed.current},uCamFar:{value:td.current},uOpacity:{value:0}},P=new E({uniforms:N,side:2,transparent:!0,depthWrite:!1,vertexShader:j.vertexShader,fragmentShader:j.fragmentShader}),Ee=new O(we,P);Ee.position.y=150,Ee.visible=!1,Ee.renderOrder=-1,Ee.scale.set(M,1,M),Vc.current=Ee,i.add(Ee);let Oe=[];for(let e=0;e<_t;e++){let e=P.clone();e.uniforms.uOpacity.value=0;let t=new O(we,e);t.visible=!1,t.renderOrder=-1,t.scale.set(M,1,M),Oe.push(t),i.add(t)}Hc.current=Oe,Uc.current=Oe.map(()=>({layerIdx:NaN,opacity:0}));let ke=new w(1,1,1,1);ke.rotateX(-Math.PI/2);let Ae=[],Me=[];for(let e=0;e<yt;e++){let e=new O(ke,new E({uniforms:{uOpacity:{value:0},uSeed:{value:0},uColor:{value:new L(16777215)}},side:2,transparent:!0,depthWrite:!1,vertexShader:`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
          }
        `,fragmentShader:`
          precision highp float;
          varying vec2 vUv;
          uniform float uOpacity;
          uniform float uSeed;
          uniform vec3 uColor;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
          float vnoise(vec2 p){
            vec2 i = floor(p); vec2 f = fract(p);
            float a = hash(i);
            float b = hash(i + vec2(1.0,0.0));
            float c = hash(i + vec2(0.0,1.0));
            float d = hash(i + vec2(1.0,1.0));
            vec2 u = f*f*(3.0-2.0*f);
            return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
          }
          float fbm(vec2 p){
            float v = 0.0; float a = 0.5;
            for (int i = 0; i < 5; i++) {
              v += a * vnoise(p);
              p *= 2.02; a *= 0.5;
            }
            return v;
          }
          void main(){
            vec2 c = vUv - 0.5;
            float dist = length(c) * 2.0;
            float edge = 1.0 - smoothstep(0.55, 1.0, dist);
            if (edge < 0.01) discard;
            vec2 p = vUv * 3.0 + uSeed;
            float n = fbm(p);
            float cloud = smoothstep(0.35, 0.75, n) * edge;
            if (cloud < 0.01) discard;
            float shade = 0.85 + 0.25 * fbm(p * 2.3 + 5.0);
            vec3 col = uColor * shade;
            gl_FragColor = vec4(col, cloud * uOpacity);
          }
        `}));e.visible=!1,e.renderOrder=-1,i.add(e),Ae.push(e);let t=xt(J.current.x,J.current.z);Me.push({...t,cycleT:Math.random()*bt,cycleLen:bt})}Yd.current=Ae,Xd.current=Me;let F=new te(800,32,32),Ne={uTop:{value:new L(8956620)},uBottom:{value:new L(16768426)},uSunDir:{value:C.uSunDir.value},uSunColor:{value:new L(16770736)},uUnderwater:C.uUnderwater,uTurbidity:{value:0},uFogColor:{value:new L(666170)}},Fe=new E({uniforms:Ne,side:1,depthWrite:!1,vertexShader:`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,fragmentShader:`
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uUnderwater;
        uniform float uTurbidity;
        uniform vec3 uFogColor;
        varying vec3 vDir;
        void main() {
          float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(uBottom, uTop, smoothstep(0.35, 0.75, t));
          float sd = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
          col += uSunColor * pow(sd, 180.0) * 3.0;
          col += uSunColor * pow(sd, 8.0) * 0.15;
          if (uUnderwater > 0.001) {
            float murk = clamp(uUnderwater * (0.25 + uTurbidity * 0.7), 0.0, 1.0);
            col = mix(col, uFogColor, murk);
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `}),Le=new O(F,Fe);i.add(Le);let ze=()=>{if(!e)return;let n=e.clientWidth,r=e.clientHeight;t.setSize(n,r),d.setSize(n,r),s.aspect=n/r,s.updateProjectionMatrix(),l.setSize(n,r)};window.addEventListener(`resize`,ze);let Ve=e=>{let t=Math.sin(e*Math.PI*2-Math.PI/2),n=e*Math.PI*2,r=new at(Math.cos(n),Math.max(t,-.2),Math.sin(n)*.5).normalize(),i={top:[.02,.03,.1],bot:[.05,.08,.2],sun:[.5,.6,.9]},a={top:[.35,.45,.7],bot:[1,.55,.35],sun:[1,.75,.5]},o={top:[.4,.65,.95],bot:[.75,.88,1],sun:[1,.95,.85]},s={top:[.25,.15,.4],bot:[1,.45,.3],sun:[1,.55,.35]},c,l,u;e<.25?(c=i,l=a,u=e/.25):e<.5?(c=a,l=o,u=(e-.25)/.25):e<.75?(c=o,l=s,u=(e-.5)/.25):(c=s,l=i,u=(e-.75)/.25);let d=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n],f=d(c.top,l.top,u),p=d(c.bot,l.bot,u),m=d(c.sun,l.sun,u),h=[f[0]*.4+.1,f[1]*.5+.15,f[2]*.6+.2];return{top:f,bot:p,sun:m,sunDir:r,waterShallow:h,waterDeep:[h[0]*.15,h[1]*.2,h[2]*.35]}},He=0,We=performance.now(),Ge=0,Ke=0,qe=16.67,Je=Qu.current,Ye=0,Qe=0,et=new $e,I=()=>{Rt({x:J.current.x,z:J.current.z,y:J.current.y,yaw:Z.current,pitch:Q.current})};window.addEventListener(`pagehide`,I);let rt=()=>{let e=$u.current;if(Qu.current!==Je){Je=Qu.current;let e=Math.min(window.devicePixelRatio,2)*Je;t.setPixelRatio(e),d.setPixelRatio(e)}(s.fov!==Ju.current||s.near!==ed.current||s.far!==td.current)&&(s.fov=Ju.current,s.near=ed.current,s.far=td.current,s.updateProjectionMatrix()),A.uCamNear.value=s.near,A.uCamFar.value=s.far,_e.uCamNear.value=s.near,_e.uCamFar.value=s.far;let n=performance.now(),r=n-We,c=Math.min(r/1e3,.1);We=n,r>4&&r<40&&(qe+=(r-qe)*.1);let u=Pc.current?0:c;Ye+=u*Pl.current;let f=Ye;Qe+=u*Ou.current,C.uTime.value=f,C.uAmp.value=K.current,C.uDyingTime.value=Qe,C.uDyingAmp.value=Du.current,C.uQuality.value+=((Mu.current&&!e?1:0)-C.uQuality.value)*Math.min(1,c*4),C.uRegular.value+=(+!!wu.current-C.uRegular.value)*Math.min(1,c*4),C.uFft.value+=(+!!Tu.current-C.uFft.value)*Math.min(1,c*4),C.uDying.value+=(+!!Eu.current-C.uDying.value)*Math.min(1,c*4),C.uCross.value+=(+!!ku.current-C.uCross.value)*Math.min(1,c*4),C.uPeriod.value+=(Au.current-C.uPeriod.value)*Math.min(1,c*4),C.uFreq.value+=(Fl.current-C.uFreq.value)*Math.min(1,c*4),C.uPeak.value+=(ju.current-C.uPeak.value)*Math.min(1,c*4),C.uSkew.value+=(Dl.current-C.uSkew.value)*Math.min(1,c*4);{let e=nd.current*Math.PI/180-C.uDir.value;e=Math.atan2(Math.sin(e),Math.cos(e)),C.uDir.value+=e*Math.min(1,c*4)}let m=+(ql.current===`whirlpool`);$.current+=(m-$.current)*Math.min(1,c*.7),$.current<8e-4?$.current=0:$.current>.9992&&($.current=1),C.uVortex.value=$.current,C.uVortexOpening.value+=(od.current-C.uVortexOpening.value)*Math.min(1,c*4),C.uVortexCenter.value.set(yd.current.x,yd.current.z);let g=Ve(Nl.current);a.position.copy(g.sunDir).multiplyScalar(100),a.color.setRGB(g.sun[0],g.sun[1],g.sun[2]),a.intensity=Math.max(0,g.sunDir.y)*2.2+.15,o.color.setRGB(g.top[0],g.top[1],g.top[2]),o.groundColor.setRGB(g.bot[0]*.4,g.bot[1]*.4,g.bot[2]*.4),C.uSunDir.value.copy(g.sunDir),C.uSkyColor.value.setRGB(g.top[0],g.top[1],g.top[2]),C.uHorizonColor.value.setRGB(g.bot[0],g.bot[1],g.bot[2]),C.uSunColor.value.setRGB(g.sun[0],g.sun[1],g.sun[2]),C.uWaterShallow.value.setRGB(g.waterShallow[0],g.waterShallow[1],g.waterShallow[2]),C.uWaterDeep.value.setRGB(g.waterDeep[0],g.waterDeep[1],g.waterDeep[2]),C.uFogColor.value.setRGB(g.bot[0],g.bot[1],g.bot[2]),Ne.uTop.value.copy(C.uSkyColor.value),Ne.uBottom.value.copy(C.uHorizonColor.value),Ne.uSunColor.value.copy(C.uSunColor.value),i.fog.color.copy(C.uFogColor.value);let ee=pe[pu.current]??pe[0];C.uWaterColor.value.set(ee.rgb[0],ee.rgb[1],ee.rgb[2]);let te=ye(gu.current,1,1);C.uOverlayColor.value.x+=(te[0]-C.uOverlayColor.value.x)*Math.min(1,c*6),C.uOverlayColor.value.y+=(te[1]-C.uOverlayColor.value.y)*Math.min(1,c*6),C.uOverlayColor.value.z+=(te[2]-C.uOverlayColor.value.z)*Math.min(1,c*6),C.uOpacity.value+=(mu.current-C.uOpacity.value)*Math.min(1,c*6),C.uWaterColorAlpha.value+=(hu.current-C.uWaterColorAlpha.value)*Math.min(1,c*6),C.uTintSat.value+=(_u.current-C.uTintSat.value)*Math.min(1,c*6),C.uTintBright.value+=(vu.current-C.uTintBright.value)*Math.min(1,c*6),C.uSurfBright.value+=(yu.current-C.uSurfBright.value)*Math.min(1,c*6),C.uSurfSat.value+=(bu.current-C.uSurfSat.value)*Math.min(1,c*6),C.uRefraction.value+=((Ol.current&&!e?1:0)-C.uRefraction.value)*Math.min(1,c*4);let _=fe[Su.current]??fe[0],v=f*jd.current*Ad.current*Math.PI*2/Math.max(.001,Md.current),ne=Pd.current===`sawtooth`?st:ot,y=Od.current?ne(v,Nd.current)*kd.current:0;Id.current+=(Fd.current-Id.current)*Math.min(1,c*2),Ld.current+=Id.current*c;let b=Math.max(.5,rd.current),x=y+Ld.current;if(D.position.y=x,le.position.y=x,_.rgb){he.visible=!0;let t=_.id===`custom`?Et(Cl.current):_.rgb;A.uColor.value.setRGB(t[0],t[1],t[2]),C.uFloorColor.value.setRGB(t[0],t[1],t[2]);let n=Math.max(.5,b+x);C.uFloorDepth.value=n,he.position.y=-b,A.uTime.value=f,A.uCausticDepth.value=n,A.uCausticAmp.value=K.current,A.uCausticFreq.value=C.uFreq.value,A.uCausticsOn.value+=((Ol.current&&!e?1:0)-A.uCausticsOn.value)*Math.min(1,c*4);let r=_.id===`clouds`&&!e,i=+!!r;A.uClouds.value+=(i-A.uClouds.value)*Math.min(1,c*4);let a=r||e?0:+!!id.current;A.uTextured.value+=(a-A.uTextured.value)*Math.min(1,c*4),ad.current&&(A.uCloudScroll.value.x=f*.015,A.uCloudScroll.value.y=f*.01);let o=A.uClouds.value>.5;j.transparent!==o&&(j.transparent=o,j.needsUpdate=!0),j.depthWrite=!o}else he.visible=!1;let re=zd.current&&!e;if(re){let e=Math.max(.05,Math.min(.95,Bd.current));Se.position.y=-b+b*e+x,_e.uTime.value=f,_e.uCloudScroll.value.x=f*.04,_e.uCloudScroll.value.y=f*.025}if(Qd.current+=(+!!re-Qd.current)*Math.min(1,c*Ud.current),_e.uOpacity.value=Qd.current,Se.visible=Qd.current>.003,Vd.current&&!e){let e=Math.max(0,Math.min(1,Hd.current));Ee.position.y=60+e*440+x,N.uTime.value=f,N.uCloudScroll.value.x=f*.02,N.uCloudScroll.value.y=f*.013}D.visible=!Rd.current;let ie=Math.max(1e-4,tu.current),ae=.55*ie,oe=tt.degToRad(Math.min(75,40*ie))*Math.sin(f*ae);ou.current=oe;let S=ql.current,se=S===`whirlpool`,w=4.4,T,E;if(S===`noclip`||S===`watercraft`){let e=Z.current,t=Q.current,n=Math.cos(t),r=-Math.sin(e)*n,i=Math.sin(t),a=-Math.cos(e)*n,o=Math.cos(e),s=-Math.sin(e),c=16*Math.max(.1,Jl.current),l=w*Math.max(.1,Jl.current),d=q.current.x*o+q.current.y*r,f=q.current.x*s+q.current.y*a,p=Yl.current*Math.max(.1,Jl.current),m=df.current?-p:ff.current?p:(q.current.y*i+Kl.current.y)*c,h=Math.max(.02,Xl.current),g=1-Math.exp(-u/h);mf.current+=(m-mf.current)*g,J.current.x+=(d*c+Ru.current.x*l)*u,J.current.y+=mf.current*u,J.current.z+=(f*c+Ru.current.z*l)*u,T=J.current.x,E=J.current.z,Y.current=J.current.y,Gl.current=0}else if(S===`swing`){let e=ae,t=oe,r=eu.current+ru.current*dt(iu.current,t,f*e),i,a;if(bd.current){let e=Cd.current===`ccw`?-1:1,t=.35*Sd.current*e;wd.current+=t*u;let n=wd.current;i=Math.cos(n)*xd.current,a=Math.sin(n)*xd.current}else{let e=Math.cos(cu.current),n=-Math.sin(cu.current),r=Math.max(8,Math.min(60,eu.current*.6)),o=Math.sin(t)*r*nu.current;i=e*o,a=n*o}let o=1,s=au.current;if(s){let e=.6,t=(n-s.startMs)/1e3;if(t>=e)au.current=null;else{let n=Math.max(0,t/e);o=n*n*(3-2*n)}}T=J.current.x+(s?i*o:i),E=J.current.z+(s?a*o:a),Y.current=s?s.fromY+(r-s.fromY)*o:r,Gl.current=0}else if(se){let e=od.current,t=sd.current,r=ld.current===`ccw`?-1:1,i=Math.max(e*.55,3),a,o=r;if(ud.current){let e=_d.current,s=(n-e.startMs)/1e3,c=Math.max(2,dd.current*Math.max(.5,fd.current)),l=Math.max(i,t-c);if(e.phase===`drag`){let r=Math.max(.5,fd.current),i=Math.min(1,s/r),o=i*i*(3-2*i);a=t+(l-t)*o,i>=1&&(e.phase=`stay`,e.startMs=n)}else if(e.phase===`stay`)a=l,s>=Math.max(0,pd.current)&&(e.phase=`exit`,e.startMs=n);else{let i=Math.max(2,t-l),c=Math.max(.3,i/Math.max(.5,hd.current)),u=Math.min(1,s/c);if(md.current===`reverseSpin`){let e=u*u*(3-2*u);a=l+(t-l)*e,o=-r}else{let e=1-(1-u)*(1-u)*(1-u);a=l+(t-l)*e}u>=1&&(e.phase=`drag`,e.startMs=n)}sd.current=a}else{let e=-q.current.y*16+Lu.current.z*w;sd.current=Math.max(i,Math.min(220,sd.current+e*u)),Jr(sd.current),a=sd.current}let s=.35*cd.current*o*$.current,c=q.current.x*1.4;gd.current+=(s+c)*u;let l=gd.current,d=yd.current,f=d.x+Math.cos(l)*a,p=d.z+Math.sin(l)*a,m=$.current;T=J.current.x+(f-J.current.x)*m,E=J.current.z+(p-J.current.z)*m,vd.current.x=T,vd.current.z=E}else{let e=Z.current,t=-Math.sin(e),n=-Math.cos(e),r=Math.cos(e),i=-Math.sin(e),a=q.current.x*r+q.current.y*t,o=q.current.x*i+q.current.y*n;J.current.x+=(a*16+Lu.current.x*w)*u,J.current.z+=(o*16+Lu.current.z*w)*u,T=J.current.x,E=J.current.z}if(!se&&$.current>8e-4){let e=ld.current===`ccw`?-1:1,t=.35*cd.current*e*$.current;gd.current+=t*u;let n=gd.current,r=yd.current,i=r.x+Math.cos(n)*sd.current,a=r.z+Math.sin(n)*sd.current,o=$.current;T=i*o+T*(1-o),E=a*o+E*(1-o)}if(sf.current&&!se){let e=Math.max(50,cf.current),t=ht(J.current.x,e),n=ht(J.current.z,e);t!==J.current.x&&(T+=t-J.current.x,J.current.x=t),n!==J.current.z&&(E+=n-J.current.z,J.current.z=n)}D.position.x=T,D.position.z=E,le.position.x=T,le.position.z=E,he.position.x=T,he.position.z=E,Se.position.x=T,Se.position.z=E,Ee.position.x=T,Ee.position.z=E;let ce=nd.current*Math.PI/180,ue=se?ut(T-yd.current.x,E-yd.current.z,f,K.current,Au.current,od.current,Fl.current):ct(T,E,f,K.current,wu.current,ku.current,Au.current,ju.current,ce,Tu.current,lr,Eu.current,gr,Du.current,Qe,Fl.current,Dl.current),de=G.current;if(de){if(S===`watercraft`){let e=ct(Dt,Ot,f,K.current,wu.current,ku.current,Au.current,ju.current,ce,Tu.current,lr,Eu.current,gr,Du.current,Qe,Fl.current,Dl.current);de.setBob(e-.3,Math.cos(f*.33)*.02,Math.sin(f*.5+.4)*.035),de.tick(s)}de.setVisible(S===`watercraft`)}let O=0,k=0;{let e=af.current,t=of.current*Math.PI/180;e===`cw`||e===`ccw`?Bu.current+=(e===`cw`?-1:1)*t*u:e===`random`&&(Vu.current+=(Math.random()*2-1)*t*u,Vu.current*=Math.max(0,1-u*.5),Bu.current+=Vu.current*u),zu.current={x:Math.sin(Bu.current),z:Math.cos(Bu.current)};let n=nf.current,r=0,i=0;if(n>.001){let e=Math.max(.02,rf.current),t=Math.sin(f*e*.4);r=n*t*zu.current.x,i=n*t*zu.current.z}let a=5+20*Math.max(.05,rf.current),o=2*.6*Math.sqrt(a),s=a*(r-du.current.x)-o*fu.current.x,c=a*(i-du.current.z)-o*fu.current.z;fu.current.x+=s*u,fu.current.z+=c*u,du.current.x+=fu.current.x*u,du.current.z+=fu.current.z*u,S!==`swing`&&(O=du.current.x,k=du.current.z)}let me=0,ge=0;if(S===`float`||S===`whirlpool`){Ku.current===null&&(Ku.current=ue);let e=K.current*8,t=Math.max(-e,Math.min(e,(ue-Ku.current)/Math.max(c,1e-4)));Ku.current=ue;let n=Math.min(1,Math.max(0,(ju.current-1)/5)),r=Vl.current,i=r/(1+n*6),a=se?ut(T-yd.current.x,E-yd.current.z,f+i,K.current,Au.current,od.current,Fl.current):ct(T,E,f+i,K.current,wu.current,ku.current,Au.current,ju.current,ce,Tu.current,lr,Eu.current,gr,Du.current,Qe+i,Fl.current,Dl.current),o=K.current*6,s=Math.max(-o,Math.min(o,(a-ue)/Math.max(i,1e-4))),l=1-n*.85,d=s*l+t*(1-l);if(Tu.current||Eu.current){let e=Math.min(1,c*8);qu.current+=(d-qu.current)*e}else qu.current=d;let p=qu.current,m=K.current,h=Ll.current,g=zl.current,ee=Bl.current,te=Math.min(.95,.75*r),_=ue*(1-te)+a*te,v=m*1.4,ne=o*.12,y=(p+Math.sqrt(p*p+ne*ne))/2*g*.6*(.6+m*.6),b=p*ee*.35*(.6+m*.6),x=Math.min(v,y),re=Math.max(-v,Math.min(v,b)),ie=_+Rl.current-x+re;Y.current===null&&(Y.current=ie);let ae=(10+26*Il.current)*(1+n*.2),oe=2*(.85+n*.1)*Math.sqrt(ae),S=(1.2+3*m)*h*g-(1+2*m)*h*ee,C=ae*(ie-Y.current)-oe*Gl.current-S;Gl.current+=C*u,Y.current+=Gl.current*u;let w=m>1e-4?Math.tanh(ue/(m*2.2)):0,D=Zd.current,le=0,de=0;if(D>.001){let e=ef.current,t=nd.current*Math.PI/180,n=Math.cos(t),r=-Math.sin(t),i=tf.current,a=f*Math.max(.02,e),o=Math.sin(a*.09)*.5+.5;le=D*(w*n+i*n*o*1.2),de=D*(w*r+i*r*o*1.2)}let O=X.current.x,k=X.current.z;if(Math.abs(O)+Math.abs(k)>.001){let e=D>.001?D:12;le+=e*O*w,de+=e*k*w}let fe=5+20*Math.max(.05,ef.current),A=2*.6*Math.sqrt(fe),j=fe*(le-lu.current.x)-A*uu.current.x,pe=fe*(de-lu.current.z)-A*uu.current.z;uu.current.x+=j*u,uu.current.z+=pe*u,lu.current.x+=uu.current.x*u,lu.current.z+=uu.current.z*u,me=lu.current.x,ge=lu.current.z}else if(S===`noclip`||S===`watercraft`){let e=!df.current&&!ff.current,t=Math.max(.02,Xl.current),n=1-Math.exp(-u/t),r=e&&Zl.current?ue:0;$l.current+=(r-$l.current)*n,Y.current=J.current.y+$l.current;let i=0,a=0;if(e&&Ql.current){let e=K.current,t=e>1e-4?Math.tanh(ue/(e*2.2)):0,n=Zd.current;if(n>.001){let e=ef.current,r=nd.current*Math.PI/180,o=Math.cos(r),s=-Math.sin(r),c=tf.current,l=f*Math.max(.02,e),u=Math.sin(l*.09)*.5+.5;i=n*(t*o+c*o*u*1.2),a=n*(t*s+c*s*u*1.2)}let r=X.current.x,o=X.current.z;if(Math.abs(r)+Math.abs(o)>.001){let e=n>.001?n:12;i+=e*r*t,a+=e*o*t}}let o=5+20*Math.max(.05,ef.current),s=2*.6*Math.sqrt(o),c=o*(i-lu.current.x)-s*uu.current.x,l=o*(a-lu.current.z)-s*uu.current.z;uu.current.x+=c*u,uu.current.z+=l*u,lu.current.x+=uu.current.x*u,lu.current.z+=uu.current.z*u,me=lu.current.x,ge=lu.current.z}if(sf.current&&S!==`swing`&&Y.current!==null){let e=Math.max(50,lf.current),t=ht(Y.current,e);t!==Y.current&&(Y.current=t,J.current.y=t)}let ve=Y.current??0;s.position.set(T+Hl.current+me+O,ve+Ul.current+x,E+Wl.current+ge+k);let be=s.position.y,xe=T+Hl.current+me+O,Ce=E+Wl.current+ge+k-20,M=$.current,we=xe*(1-M),P=Ce*(1-M);s.lookAt(we,be,P);let Te=1.6;Z.current-=Iu.current.x*Te*c,Q.current+=Iu.current.y*Te*c;let De=S===`noclip`||S===`watercraft`?1.5:1.2;Q.current>De&&(Q.current=De),Q.current<-De&&(Q.current=-De),s.rotateY(Z.current),s.rotateX(Q.current);let Oe=je(Lu.current.x,Lu.current.z,Z.current);(Math.abs(Oe.x-Hu.current.x)>.0015||Math.abs(Oe.y-Hu.current.y)>.0015)&&(Hu.current=Oe,Us(Oe));let ke=je(X.current.x,X.current.z,Z.current);(Math.abs(ke.x-Uu.current.x)>.0015||Math.abs(ke.y-Uu.current.y)>.0015)&&(Uu.current=ke,qs(ke));let Ae=je(zu.current.x,zu.current.z,Z.current);(Math.abs(Ae.x-Gu.current.x)>.0015||Math.abs(Ae.y-Gu.current.y)>.0015)&&(Gu.current=Ae,Ys(Ae));let Me=je(Ru.current.x,Ru.current.z,Z.current);if((Math.abs(Me.x-Wu.current.x)>.0015||Math.abs(Me.y-Wu.current.y)>.0015)&&(Wu.current=Me,$s(Me)),n-Ge>1e3&&(Ge=n,Rt({x:J.current.x,z:J.current.z,y:J.current.y,yaw:Z.current,pitch:Q.current})),Cu.current&&S===`float`){let e=q.current.y*.12;s.rotateX(e)}let F=ue-ve,Pe=Ml.current;if(Pe){let e=Pe.ctx.currentTime;if(Fu.current){let t=F>0?Math.min(1+.35*F,2.5):1;Pe.depthGain.gain.setTargetAtTime(t,e,.12);let n=F>0?Math.max(18e3-4e3*F,500):18e3;Pe.lp.frequency.setTargetAtTime(n,e,.15)}else Pe.depthGain.gain.setTargetAtTime(1,e,.2),Pe.lp.frequency.setTargetAtTime(18e3,e,.2)}let Fe=F>0?Math.min(F/2.5,1):0;C.uUnderwater.value+=(Fe-C.uUnderwater.value)*Math.min(1,c*6),A.uTurbidity.value+=(xu.current-A.uTurbidity.value)*Math.min(1,c*6),A.uUnderwater.value=C.uUnderwater.value,A.uFogColor.value.copy(C.uWaterDeep.value),_e.uTurbidity.value=A.uTurbidity.value,_e.uUnderwater.value=C.uUnderwater.value,_e.uFogColor.value.copy(C.uWaterDeep.value),N.uTurbidity.value=A.uTurbidity.value,N.uUnderwater.value=C.uUnderwater.value,N.uFogColor.value.copy(C.uWaterDeep.value);let Ie=Hc.current,Re=Uc.current,ze=sf.current&&uf.current&&Vd.current&&!gl.current&&Nu.current<=0&&!e,Be=Math.min(1,c*Ud.current);if(ze){let e=gt,t=Y.current??0,n=Math.floor(t/e),r=Math.floor(Ie.length/2),i=su.current/mt;for(let t=0;t<Ie.length;t++){let a=n+(t-r),o=St(a),s=Ie[t],c=Re[t];c.layerIdx!==a&&(c.layerIdx=a,c.opacity=0),c.opacity+=(1-c.opacity)*Be,s.visible=!0,s.position.set(T+o.x,a*e+x,E+o.z),s.scale.set(i,1,i);let l=s.material.uniforms;l.uOpacity.value=c.opacity,l.uTime.value=f,l.uCloudScroll.value.x=f*.02,l.uCloudScroll.value.y=f*.013,l.uTurbidity.value=N.uTurbidity.value,l.uUnderwater.value=N.uUnderwater.value,l.uFogColor.value.copy(N.uFogColor.value)}}else for(let e=0;e<Ie.length;e++){let t=Ie[e],n=Re[e];n.opacity+=(0-n.opacity)*Be,n.opacity>.003?(t.visible=!0,t.material.uniforms.uOpacity.value=n.opacity):(t.visible=!1,n.layerIdx=NaN)}C.uTurbidity.value=A.uTurbidity.value,Ne.uTurbidity.value=A.uTurbidity.value,Ne.uFogColor.value.copy(C.uWaterDeep.value);let Ue=i.fog;Ue.density=A.uTurbidity.value*C.uUnderwater.value*.05,Ue.color.copy(C.uFogColor.value).lerp(C.uWaterDeep.value,A.uTurbidity.value*C.uUnderwater.value),C.uSphereMix.value+=((wl.current&&!e?Tl.current:0)-C.uSphereMix.value)*Math.min(1,c*6),C.uTrochoid.value+=(El.current-C.uTrochoid.value)*Math.min(1,c*6),Le.position.copy(s.position);let Xe=gl.current,Ze=Nu.current>0&&!Xe;Le.visible=!Ze&&!Xe;let $e=Vd.current&&!Ze&&!Xe&&!e;$d.current+=(+!!$e-$d.current)*Math.min(1,c*Ud.current),N.uOpacity.value=$d.current,Ee.visible=$d.current>.003,t.setClearColor(204851,+!!Xe);{let t=Yd.current,n=Xd.current,r=Wd.current&&!e?Math.min(t.length,Math.max(0,Math.round(Gd.current))):0,i=Math.max(1,Kd.current),a=Math.max(.01,qd.current);for(let e=0;e<t.length;e++){let o=t[e];if(e>=r){o.visible=!1;continue}let s=n[e];if(s.cycleLen=bt/a,s.cycleT+=c,s.cycleT>=s.cycleLen){s.cycleT-=s.cycleLen;let e=xt(T,E);s.x=e.x,s.y=e.y,s.z=e.z,s.seed=e.seed}let l=s.cycleT/s.cycleLen,u=Math.sin(Math.PI*Math.min(1,Math.max(0,l))),d=o.material;d.uniforms.uOpacity.value=u*Jd.current,d.uniforms.uSeed.value=s.seed,o.position.set(s.x,s.y,s.z),o.scale.set(i,1,i),o.visible=u>.003}}let I=Kc.current,nt=Lc.current;if(I&&nt){let e;e=I.bob.follow?(se?ut(I.base.x-yd.current.x,I.base.z-yd.current.z,f,K.current,Au.current,od.current,Fl.current):ct(I.base.x,I.base.z,f,K.current,wu.current,ku.current,Au.current,ju.current,ce,Tu.current,lr,Eu.current,gr,Du.current,Qe,Fl.current,Dl.current))*I.bob.amp:Math.sin(f*I.bob.speed)*I.bob.amp,nt.position.set(I.base.x,I.base.y+e,I.base.z)}h.update(s.position,c);let L=Yu.current?Xu.current:Zu.current;Ke++;let it=L<=0?1:Math.max(1,Math.round(1e3/L/qe));(L<=0||Ke%it===0)&&(l.render(),kl.current&&!e?(p.uniforms.uAmount.value=Al.current*.05,d.render()):t.render(i,s)),He=requestAnimationFrame(rt),et.getDelta()};return rt(),()=>{cancelAnimationFrame(He),window.removeEventListener(`resize`,ze),window.removeEventListener(`pagehide`,I),I(),t.dispose(),p.dispose(),d.dispose(),ne.dispose(),le.geometry.dispose(),T.dispose(),de.dispose(),j.dispose(),ge.dispose(),be.dispose(),we.dispose(),P.dispose();for(let e of Hc.current)e.material.dispose();Hc.current=[],Uc.current=[];for(let e of Yd.current)e.material.dispose();Yd.current=[],Xd.current=[],ke.dispose(),k.dispose(),F.dispose(),Fe.dispose(),Lc.current&&=(i.remove(Lc.current),Nt(Lc.current),null),Kc.current=null,i.background=null,hl.current&&=(hl.current.dispose(),null),gl.current=!1,vl.current&&=(vl.current.dispose(),null),b.dispose(),yl.current=null,_l.current=null,Ic.current=null,Rc.current=null,zc.current=null,Bc.current=null,Vc.current=null,l.dispose(),Wc.current=null,h.dispose(),Gc.current=null,t.domElement.removeEventListener(`pointerdown`,ee),t.domElement.removeEventListener(`pointermove`,_),t.domElement.removeEventListener(`pointerup`,v),t.domElement.removeEventListener(`pointercancel`,v),g.dispose(),G.current=null,t.domElement.parentNode===e&&e.removeChild(t.domElement)}},[]);let[ap,op]=(0,R.useState)(!1),[sp,cp]=(0,R.useState)(!1),[lp,up]=(0,R.useState)(!1),[dp,fp]=(0,R.useState)(!1);(0,R.useEffect)(()=>{let e=window.setTimeout(()=>fp(!0),12e3);return()=>window.clearTimeout(e)},[]);let pp=ap&&sp&&lp||dp,[mp,hp]=(0,R.useState)(!0);(0,R.useEffect)(()=>{if(!pp)return;let e=window.setTimeout(()=>hp(!1),400);return()=>window.clearTimeout(e)},[pp]),(0,R.useEffect)(()=>{let e=Ic.current;if(!e)return;if(Lc.current&&=(e.remove(Lc.current),Nt(Lc.current),null),Kc.current=null,!Ca){Ea([kt]),op(!0);return}let t=!1,n=`/scenes/${encodeURIComponent(Ca)}`,r=new ke;return fetch(`${n}/manifest.json`).then(e=>e.ok?e.json():{}).catch(()=>({})).then(i=>{t||(Ea(At(i)),r.load(`${n}/${encodeURIComponent(Ca)}.glb`,n=>{if(t){Nt(n.scene);return}let r=n.scene;Mt(r,i),e.add(r),Lc.current=r;let a=jt(i.bob);Kc.current=a?{base:r.position.clone(),bob:a}:null,op(!0)},void 0,e=>{console.error(`Failed to load scene "${Ca}"`,e),t||op(!0)}))}),()=>{t=!0}},[Ca]),(0,R.useEffect)(()=>{Oa(e=>e&&Ta.some(t=>t.id===e)?e:Ta[0]?.id??null)},[Ta]),(0,R.useEffect)(()=>{let e=Ic.current;if(!e)return;let t=()=>{e.background=null,gl.current=!1,hl.current&&=(hl.current.dispose(),null)};if(!H||!U||!Na){t(),cp(!0);return}let n=!1,r=[H,U,Na].map(encodeURIComponent).join(`/`),i=`/environments/${r}`;return fetch(`${i}/manifest.json`).then(e=>e.ok?e.json():{}).catch(()=>({})).then(a=>{if(n)return;let o=a.image??`skybox.png`;new ie().load(`${i}/${encodeURIComponent(o)}`,t=>{if(n){t.dispose();return}t.mapping=303,t.colorSpace=oe,hl.current&&hl.current.dispose(),hl.current=t,e.background=t,e.backgroundRotation.set(0,(a.rotationY??0)*Math.PI/180,0),gl.current=!0,typeof a.timeOfDay==`number`&&Ge((a.timeOfDay%1+1)%1),cp(!0)},void 0,e=>{console.error(`Failed to load skybox "${r}"`,e),n||(t(),cp(!0))})}),()=>{n=!0}},[H,U,Na]),(0,R.useEffect)(()=>{let e=_l.current;if(!e)return;let t=()=>{xl.current=0,rp(),e.uReflTex.value=yl.current,vl.current&&=(vl.current.dispose(),null)};if(!Za){t(),up(!0);return}let n=!1,r=`/surfaces/${encodeURIComponent(Za)}`;return fetch(`${r}/manifest.json`).then(e=>e.ok?e.json():{}).catch(()=>({})).then(i=>{if(n)return;let a=i.image??`surface.png`;new ie().load(`${r}/${encodeURIComponent(a)}`,t=>{if(n){t.dispose();return}t.wrapS=g,t.wrapT=_e,t.colorSpace=oe,t.anisotropy=bl.current,vl.current&&vl.current.dispose(),vl.current=t,e.uReflTex.value=t,xl.current=typeof i.strength==`number`?Math.max(0,Math.min(1,i.strength)):.6,rp(),up(!0)},void 0,e=>{console.error(`Failed to load surface "${Za}"`,e),n||(t(),up(!0))})}),()=>{n=!0}},[Za]);let gp=(()=>{let t=F;return e(t<.15||t>.9?`tod.night`:t<.3?`tod.dawn`:t<.45?`tod.morning`:t<.6?`tod.midday`:t<.75?`tod.afternoon`:`tod.dusk`)})(),_p=ls*qo,vp=Math.max(0,qo-_p),yp=Yo===`fixed`?Zo*qo:null,bp=yp===null?null:Math.max(0,yp-ds),xp={settingsTab:mc,setSettingsTab:hc,restoreCameraPosition:Lf,resetToDefaults:_f,savedPresets:bc,exportSettingsFile:xf,importSettingsFile:Sf,savePresetAs:Cf,loadSavedPreset:wf,deleteSavedPreset:Tf,savedStates:Sc,exportStateFile:Af,importStateFile:jf,saveStateAs:Mf,loadSavedStateById:Nf,deleteSavedState:Pf,buildBathLink:Ff,waveAmp:y,setWaveAmp:M,waveSpeed:B,setWaveSpeed:lt,waveFreq:pt,setWaveFreq:zt,heightOffset:Kt,setHeightOffset:qt,submergeAmp:Jt,setSubmergeAmp:Yt,floatLift:Xt,setFloatLift:Zt,waveAnticipation:Qt,setWaveAnticipation:$t,driftWorldRef:Lu,driftDisplayRef:Hu,setDriftStick:Us,swayWorldRef:X,swayDisplayRef:Uu,setSwayStick:qs,setStickBearing:hf,swayAmp:Yi,setSwayAmp:Xi,swaySpeed:Zi,setSwaySpeed:Qi,swayBias:$i,setSwayBias:ea,surgeWorldRef:zu,setSurgeBearing:gf,surgeAmp:ra,setSurgeAmp:ia,surgeSpeed:aa,setSurgeSpeed:oa,surgeRotationMode:sa,setSurgeRotationMode:ca,surgeRotationSpeed:la,setSurgeRotationSpeed:ua,buoyAmp:Ut,setBuoyAmp:Wt,bobSpeed:Bt,setBobSpeed:Ht,regularWaves:rr,setRegularWaves:ir,realisticWaves:ar,setRealisticWaves:or,dyingWave:ur,setDyingWave:dr,dyingWaveAmp:fr,setDyingWaveAmp:pr,dyingWaveSpeed:mr,setDyingWaveSpeed:hr,randomizeWaves:sr,setRandomizeWaves:cr,wavePreset:_r,applyWavePreset:If,regularCross:yr,setRegularCross:br,regularPeriod:xr,setRegularPeriod:Sr,wavePeak:Cr,setWavePeak:wr,trochoid:so,setTrochoid:co,heaveSkew:lo,setHeaveSkew:uo,waveHighQuality:Tr,setWaveHighQuality:Er,waveDir:Lr,setWaveDir:Rr,whirlpoolOpening:Gr,setWhirlpoolOpening:Kr,whirlpoolRadius:qr,setWhirlpoolRadius:Jr,whirlpoolSpeed:Yr,setWhirlpoolSpeed:Xr,whirlpoolDirection:Zr,setWhirlpoolDirection:Qr,whirlpoolSequenceOn:$r,setWhirlpoolSequenceOn:ei,whirlpoolDragSpeed:ti,setWhirlpoolDragSpeed:ni,whirlpoolDragDuration:ri,setWhirlpoolDragDuration:ii,whirlpoolStayDuration:ai,setWhirlpoolStayDuration:oi,whirlpoolExitMode:si,setWhirlpoolExitMode:ci,whirlpoolExitSpeed:li,setWhirlpoolExitSpeed:ui,cameraMode:W,setCameraMode:vo,cycleCameraMode:Rf,noclipSpeed:yo,setNoclipSpeed:bo,noclipFallRiseSpeed:xo,setNoclipFallRiseSpeed:So,noclipVertEaseTime:Co,setNoclipVertEaseTime:wo,noclipAutoAlternateOn:ic,setNoclipAutoAlternateOn:ac,noclipAutoAlternateInterval:oc,setNoclipAutoAlternateInterval:sc,swingPositionY:To,setSwingPositionY:Eo,swingIntensity:Do,setSwingIntensity:Oo,swingXFactor:ko,setSwingXFactor:Ao,swingHeight:jo,setSwingHeight:Mo,swingPreset:Fo,applySwingPreset:Bf,cycleSwingPreset:Vf,swingYWaveform:No,setSwingYWaveform:Po,cycleSwingYWaveform:Hf,swingTornadoOn:Lo,setSwingTornadoOn:Ro,swingTornadoRadius:zo,setSwingTornadoRadius:Bo,swingTornadoSpeed:Vo,setSwingTornadoSpeed:Ho,swingTornadoDirection:Uo,setSwingTornadoDirection:Wo,intervalSessionOn:Go,setIntervalSessionOn:Ko,intervalDuration:qo,setIntervalDuration:Jo,intervalSessionType:Yo,setIntervalSessionType:Xo,intervalCount:Zo,setIntervalCount:Qo,intervalShowStats:$o,setIntervalShowStats:es,intervalIncludeFloat:ts,setIntervalIncludeFloat:ns,intervalIncludeWhirlpool:rs,setIntervalIncludeWhirlpool:is,intervalIncludeSwing:as,setIntervalIncludeSwing:os,camOffX:en,setCamOffX:tn,camOffY:nn,setCamOffY:rn,camOffZ:an,setCamOffZ:on,camFov:jr,setCamFov:Mr,camNear:Nr,setCamNear:Pr,camFar:Fr,setCamFar:Ir,leanEnabled:zn,setLeanEnabled:Bn,gogglesOn:Vn,setGogglesOn:Hn,gogglesBlur:Un,setGogglesBlur:Wn,gogglesLoop:Gn,setGogglesLoop:Kn,gogglesIntensity:qn,setGogglesIntensity:Jn,gogglesFpsCap:Yn,setGogglesFpsCap:Xn,targetFps:Zn,setTargetFps:Qn,resolutionScale:$n,setResolutionScale:er,lowGraphicsMode:tr,setLowGraphicsMode:nr,chromaticAberrationOn:mo,setChromaticAberrationOn:ho,chromaticAberrationAmount:go,setChromaticAberrationAmount:_o,wakeLock:kr,setWakeLock:Ar,waterColorIdx:yn,setWaterColorIdx:bn,waterColorAlpha:Cn,setWaterColorAlpha:wn,surfaces:Ya,surfaceId:Za,setSurfaceId:Qa,cycleSurface:np,reflStrength:$a,setReflStrength:eo,sphereMaterial:ro,setSphereMaterial:io,sphereStrength:ao,setSphereStrength:oo,waterOpacity:xn,setWaterOpacity:Sn,waterHue:Tn,setWaterHue:En,waterSat:Dn,setWaterSat:On,waterBright:kn,setWaterBright:An,surfBright:jn,setSurfBright:Mn,surfSat:Nn,setSurfSat:Pn,turbidity:Fn,setTurbidity:In,bottomIdx:Ln,setBottomIdx:Rn,bottomColor:to,setBottomColor:no,floorDepth:zr,setFloorDepth:Br,floorTexture:Vr,setFloorTexture:Hr,floorCloudsAnimated:Ur,setFloorCloudsAnimated:Wr,depthSineOn:di,setDepthSineOn:fi,depthSineAmp:pi,setDepthSineAmp:mi,depthSineFreq:hi,setDepthSineFreq:gi,depthSineSpeed:_i,setDepthSineSpeed:vi,depthSineInterval:yi,setDepthSineInterval:bi,depthSinePeak:xi,setDepthSinePeak:Si,depthSineWaveform:Ci,setDepthSineWaveform:wi,cycleDepthSineWaveform:Uf,depthDriftSpeed:Ti,setDepthDriftSpeed:Ei,hideWater:Di,setHideWater:Oi,causticsOn:fo,setCausticsOn:po,todLabel:gp,setTimeOfDay:Ge,clockOn:Va,setClockOn:Ha,midCloudsOn:ki,setMidCloudsOn:Ai,midCloudsHeight:ji,setMidCloudsHeight:Mi,skyCloudsOn:Ni,setSkyCloudsOn:Pi,skyCloudsHeight:Fi,setSkyCloudsHeight:Ii,cloudFadeSpeed:Li,setCloudFadeSpeed:Ri,skyPuffsOn:zi,setSkyPuffsOn:Bi,skyPuffsCount:Vi,setSkyPuffsCount:Hi,skyPuffsSize:Ui,setSkyPuffsSize:Wi,skyPuffsFreq:Gi,setSkyPuffsFreq:Ki,skyPuffsOpacity:qi,setSkyPuffsOpacity:Ji,worldBoundaryOn:da,setWorldBoundaryOn:fa,worldBoundarySize:pa,setWorldBoundarySize:ma,worldBoundaryHeight:ha,setWorldBoundaryHeight:ga,worldBoundaryYExtend:_a,setWorldBoundaryYExtend:va,surfaceArea:gs,setSurfaceArea:_s,torusRingsOn:vs,setTorusRingsOn:ys,torusRadius:bs,setTorusRadius:xs,torusTube:Ss,setTorusTube:Cs,torusScale:ws,setTorusScale:Ts,torusOpacity:Es,setTorusOpacity:Ds,torusTextureIdx:Os,setTorusTextureIdx:ks,torusCellSize:As,setTorusCellSize:js,torusVerticalSpacing:Ms,setTorusVerticalSpacing:Ns,torusVerticalCount:Ps,setTorusVerticalCount:Fs,torusViewDistance:Is,setTorusViewDistance:Ls,torusFadeDistance:Rs,setTorusFadeDistance:zs,scenes:xa,sceneId:Ca,setSceneId:wa,cycleScene:Wf,spawnLocations:Ta,spawnLocationId:Da,setSpawnLocationId:Oa,cycleSpawnLocation:Kf,environments:ka,curEnv:Jf,applyEnv:Zf,cycleEnv:Qf,curEra:Yf,applyEra:$f,cycleEra:ep,curTime:Xf,setEnvTime:Pa,cycleTime:tp,backdropIdx:Dr,setBackdropIdx:Or,liveMode:ya,setLiveMode:ba,audioOn:ln,setAudioOn:un,audioVol:dn,setAudioVol:fn,audioSyncSpeed:pn,setAudioSyncSpeed:mn,audioSpatial:hn,setAudioSpatial:gn,waterSoundIdx:_n,setWaterSoundIdx:vn},Sp=ec?`fall`:nc?`rise`:`still`,Cp=e=>{ac(!1),tc(e===`fall`),rc(e===`rise`)},wp={cameraMode:W,driftStick:Hs,onDriftChange:e=>{Us(e),Hu.current=e,Lu.current=Ye(e.x,e.y,Z.current)},vertStick:Xs,onVertChange:Zs,noclipDriftStick:Qs,onNoclipDriftChange:e=>{$s(e),Wu.current=e,Ru.current=Ye(e.x,e.y,Z.current)},noclipFreeFallOn:ec,setNoclipFreeFallOn:tc,noclipReverseRiseOn:nc,setNoclipReverseRiseOn:rc,noclipAutoAlternateOn:ic,setNoclipAutoAlternateOn:ac,swayStick:Ks,onSwayChange:e=>{qs(e),Uu.current=e,X.current=Ye(e.x,e.y,Z.current),ta&&Rr(Ke(X.current.x,X.current.z))},waveDirStick:Ws,onWaveDirChange:e=>{if(Gs(e),Math.hypot(e.x,e.y)>.15){let t=Math.atan2(e.x,e.y)*180/Math.PI;Rr((t%360+360)%360)}},depthDriftSpeed:Ti,setDepthDriftSpeed:Ei,resetDepthDrift:zf,syncWaveWithSway:ta,setSyncWaveWithSway:na};return(0,z.jsxs)(`main`,{className:`relative h-screen w-screen overflow-hidden bg-black`,children:[!H&&l[Dr]?.url&&(0,z.jsx)(`img`,{src:l[Dr].url,alt:``,"aria-hidden":`true`,className:`pointer-events-none absolute inset-0 h-full w-full object-cover`}),(0,z.jsx)(`div`,{ref:n,className:`absolute inset-0 touch-none`}),mp&&(0,z.jsx)(`div`,{role:`status`,"aria-live":`polite`,className:`absolute inset-0 z-40 flex items-center justify-center bg-black transition-opacity duration-[400ms] ${pp?`pointer-events-none opacity-0`:`opacity-100`}`,children:(0,z.jsxs)(`div`,{className:`flex flex-col items-center gap-3`,children:[(0,z.jsx)(`div`,{className:`h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70`}),(0,z.jsx)(`p`,{className:`ui-ink-muted text-[10px] font-light tracking-[0.2em]`,children:e(`hud.loading`)})]})}),Vn&&(0,z.jsx)(ge,{blur:Un,loop:Gn,intensity:qn,fpsCap:Yn,pitchRef:Q,camFovRef:Ju,underwaterRef:_l}),(0,z.jsx)(`img`,{src:A.url,alt:`Aquafulness`,"aria-hidden":`true`,className:`pointer-events-none absolute z-30`,style:{top:`12pt`,right:`12pt`,width:`24pt`,height:`24pt`,filter:`invert(1)`,opacity:.5}}),Va&&qa&&(0,z.jsx)(`button`,{onClick:()=>Wa(!0),className:`absolute z-30 text-right text-[10px] font-light tabular-nums ui-ink-faint transition ui-press-ink`,style:{top:`40pt`,right:`12pt`},"aria-label":e(`hud.timeTravelOpenAria`),title:e(`hud.timeTravelOpenAria`),children:qa}),Va&&Ua&&(0,z.jsx)(He,{open:Ua,onClose:()=>Wa(!1),timeTravelBaseMs:Fa,timeTravelSetAtMs:La,onTravel:e=>{Ia(e),Ra(Date.now())},onReturnToNow:()=>{Ia(null),Ra(null)},timeSeasonalSync:za,onSeasonalSyncChange:Ba}),!t&&(0,z.jsx)(`div`,{className:`pointer-events-none absolute left-1/2 top-[12pt] z-30 -translate-x-1/2 rounded-full border ui-line-2 ui-surface px-3 py-1 text-[10px] font-light tracking-[0.2em] ui-ink backdrop-blur-md`,role:`status`,children:e(`hud.offline`)}),ya&&(0,z.jsx)(Gt,{}),(0,z.jsxs)(`div`,{className:`pointer-events-none absolute inset-0 z-10 transition-opacity duration-700 ${Ec?`opacity-100`:`opacity-0`}`,children:[(0,z.jsxs)(`div`,{className:`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-6 pt-6`,children:[(0,z.jsx)(`button`,{onClick:()=>un(e=>!e),className:`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border ui-line-2 ui-surface ui-ink backdrop-blur-md transition active:scale-95 ui-press`,"aria-label":e(ln?`hud.audioMuteAria`:`hud.audioUnmuteAria`),"aria-pressed":ln,title:e(ln?`hud.audioOnTitle`:`hud.audioOffTitle`),children:ln?(0,z.jsxs)(`svg`,{viewBox:`0 0 24 24`,width:`20`,height:`20`,fill:`none`,stroke:`currentColor`,strokeWidth:`1.6`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:[(0,z.jsx)(`path`,{d:`M4 10v4h3l5 4V6L7 10H4z`}),(0,z.jsx)(`path`,{d:`M16 8.5a4 4 0 010 7`}),(0,z.jsx)(`path`,{d:`M18.5 6a7 7 0 010 12`})]}):(0,z.jsxs)(`svg`,{viewBox:`0 0 24 24`,width:`20`,height:`20`,fill:`none`,stroke:`currentColor`,strokeWidth:`1.6`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:[(0,z.jsx)(`path`,{d:`M4 10v4h3l5 4V6L7 10H4z`}),(0,z.jsx)(`path`,{d:`M22 9l-6 6M16 9l6 6`})]})}),(0,z.jsx)(`button`,{onClick:()=>pc(e=>!e),className:`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 ${fc?`ui-line-3 ui-tint-2 ui-ink`:`ui-line-2 ui-surface ui-ink ui-press`}`,"aria-label":e(fc?`hud.settingsCloseAria`:`hud.settingsOpenAria`),"aria-expanded":fc,title:e(fc?`hud.settingsCloseAria`:`hud.settingsOpenAria`),children:(0,z.jsxs)(`svg`,{viewBox:`0 0 24 24`,width:`20`,height:`20`,fill:`none`,stroke:`currentColor`,strokeWidth:`1.6`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:[(0,z.jsx)(`circle`,{cx:`12`,cy:`12`,r:`3`}),(0,z.jsx)(`path`,{d:`M19.4 13a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V19a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H4a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H10a1.65 1.65 0 001-1.51V4a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V10a1.65 1.65 0 001.51 1H20a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z`})]})}),(0,z.jsxs)(`div`,{className:`flex gap-2`,children:[(0,z.jsx)(`button`,{onClick:qf,className:`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border ui-line-2 ui-surface ui-ink backdrop-blur-md transition active:scale-95 ui-press`,"aria-label":e(`hud.respawnAria`),title:e(`hud.respawnAria`),children:(0,z.jsxs)(`svg`,{viewBox:`0 0 24 24`,width:`20`,height:`20`,fill:`none`,stroke:`currentColor`,strokeWidth:`1.6`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:[(0,z.jsx)(`path`,{d:`M12 21s-7-6.1-7-11a7 7 0 0114 0c0 4.9-7 11-7 11z`}),(0,z.jsx)(`circle`,{cx:`12`,cy:`10`,r:`2.5`})]})}),(0,z.jsx)(`button`,{onClick:()=>Tc(e=>!e),className:`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 ${wc?`ui-line-3 ui-tint-2 ui-ink`:`ui-line-2 ui-surface ui-ink ui-press`}`,"aria-label":e(wc?`hud.phoneCloseAria`:`hud.phoneOpenAria`),"aria-pressed":wc,title:e(wc?`hud.phoneCloseTitle`:`hud.phoneOpenTitle`),children:(0,z.jsxs)(`svg`,{viewBox:`0 0 24 24`,width:`20`,height:`20`,fill:`none`,stroke:`currentColor`,strokeWidth:`1.6`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:[(0,z.jsx)(`rect`,{x:`7`,y:`2.5`,width:`10`,height:`19`,rx:`2`}),(0,z.jsx)(`path`,{d:`M11 18h2`})]})}),(0,z.jsx)(`button`,{onClick:ip,className:`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border ui-line-2 ui-surface ui-ink backdrop-blur-md transition active:scale-95 ui-press`,"aria-label":e(Oc?`hud.fullscreenExitAria`:`hud.fullscreenEnterAria`),"aria-pressed":Oc,title:e(Oc?`hud.fullscreenExitAria`:`hud.fullscreenEnterAria`),children:Oc?(0,z.jsx)(`svg`,{viewBox:`0 0 24 24`,width:`20`,height:`20`,fill:`none`,stroke:`currentColor`,strokeWidth:`1.6`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:(0,z.jsx)(`path`,{d:`M9 4v4H5M15 4v4h4M9 20v-4H5M15 20v-4h4`})}):(0,z.jsx)(`svg`,{viewBox:`0 0 24 24`,width:`20`,height:`20`,fill:`none`,stroke:`currentColor`,strokeWidth:`1.6`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:(0,z.jsx)(`path`,{d:`M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5`})})}),(0,z.jsx)(`button`,{onClick:()=>jc(!0),className:`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border ui-line-2 ui-surface ui-ink backdrop-blur-md transition active:scale-95 ui-press`,"aria-label":e(`hud.shareBathAria`),title:e(`hud.shareBathAria`),children:(0,z.jsxs)(`svg`,{viewBox:`0 0 24 24`,width:`20`,height:`20`,fill:`none`,stroke:`currentColor`,strokeWidth:`1.6`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:[(0,z.jsx)(`circle`,{cx:`18`,cy:`5`,r:`3`}),(0,z.jsx)(`circle`,{cx:`6`,cy:`12`,r:`3`}),(0,z.jsx)(`circle`,{cx:`18`,cy:`19`,r:`3`}),(0,z.jsx)(`path`,{d:`M8.6 13.5l6.8 4M15.4 6.5l-6.8 4`})]})})]})]}),(0,z.jsx)(`div`,{className:`pointer-events-none absolute inset-x-0 top-20 z-20 flex justify-center`,children:Go?(0,z.jsxs)(`div`,{className:`pointer-events-auto rounded-full border ui-line-1 ui-surface px-4 py-1.5 text-[10px] font-light tracking-[0.3em] ui-ink-muted backdrop-blur-md`,children:[e(k[W]),` `,e(`camera.mode.autoSuffix`)]}):(0,z.jsx)(`div`,{className:`pointer-events-auto flex items-center gap-1 rounded-full border ui-line-2 ui-surface p-1.5 backdrop-blur-md`,children:vt.map(t=>(0,z.jsx)(`button`,{type:`button`,onClick:()=>vo(t),"aria-pressed":W===t,className:`rounded-full px-3 py-1.5 text-[10px] font-light tracking-[0.2em] transition active:scale-95 ${W===t?`ui-tint-2 ui-ink`:`ui-ink-muted`}`,children:e(k[t])},t))})}),(0,z.jsx)(et,{open:Ac,onClose:()=>jc(!1),buildBathLink:Ff}),fc&&(0,z.jsx)(`div`,{className:`pointer-events-auto absolute inset-x-0 top-16 z-20 mx-auto max-w-2xl px-6`,children:(0,z.jsx)(`div`,{className:`max-h-[70vh] overflow-y-auto rounded-3xl border ui-line-1 ui-surface-strong p-4 shadow-2xl backdrop-blur-xl`,children:(0,z.jsx)(d,{...xp})})}),W!==`swing`&&(0,z.jsx)(rt,{onChange:cn,value:sn,label:e(`hud.joystick.nav`),positionClass:`bottom-8 left-8`}),W===`float`&&(0,z.jsx)(rt,{onChange:wp.onDriftChange,value:wp.driftStick,label:e(`hud.joystick.current`),positionClass:`bottom-36 left-8`,sticky:!0}),W===`float`&&(0,z.jsx)(rt,{onChange:wp.onSwayChange,value:wp.swayStick,label:e(`hud.joystick.sway`),positionClass:`bottom-64 left-8`,sticky:!0}),(W===`noclip`||W===`watercraft`)&&(0,z.jsx)(rt,{onChange:wp.onNoclipDriftChange,value:wp.noclipDriftStick,label:e(`hud.joystick.noclipDriftXZ`),positionClass:`bottom-36 left-8`,sticky:!0}),(W===`noclip`||W===`watercraft`)&&(0,z.jsx)(`div`,{className:`pointer-events-none absolute bottom-64 left-8 z-10 select-none`,children:(0,z.jsxs)(`div`,{className:`flex flex-col items-center gap-1`,children:[(0,z.jsx)(`button`,{type:`button`,onClick:()=>{ac(!1),rc(e=>!e)},"aria-pressed":nc,className:`pointer-events-auto rounded-full border px-2 py-0.5 text-[8px] font-light tracking-[0.2em] backdrop-blur-md transition active:scale-95 ${nc?`ui-line-3 ui-tint-2 ui-ink`:`ui-line-2 ui-surface ui-ink-muted`}`,children:e(`hud.joystick.reverseRise`)}),(0,z.jsx)(be,{label:e(`hud.joystick.noclipDriftY`),value:Xs,onChange:Zs,sticky:!0}),(0,z.jsx)(`button`,{type:`button`,onClick:()=>{ac(!1),tc(e=>!e)},"aria-pressed":ec,className:`pointer-events-auto rounded-full border px-2 py-0.5 text-[8px] font-light tracking-[0.2em] backdrop-blur-md transition active:scale-95 ${ec?`ui-line-3 ui-tint-2 ui-ink`:`ui-line-2 ui-surface ui-ink-muted`}`,children:e(`hud.joystick.freeFall`)}),(0,z.jsx)(`button`,{type:`button`,onClick:()=>ac(e=>!e),"aria-pressed":ic,className:`pointer-events-auto rounded-full border px-2 py-0.5 text-[8px] font-light tracking-[0.2em] backdrop-blur-md transition active:scale-95 ${ic?`ui-line-3 ui-tint-2 ui-ink`:`ui-line-2 ui-surface ui-ink-muted`}`,children:e(`hud.joystick.autoAlternate`)}),(0,z.jsx)(`button`,{type:`button`,onClick:()=>lc(e=>!e),"aria-pressed":cc,className:`pointer-events-auto rounded-full border px-2 py-0.5 text-[8px] font-light tracking-[0.2em] backdrop-blur-md transition active:scale-95 ${cc?`ui-line-3 ui-tint-2 ui-ink`:`ui-line-2 ui-surface ui-ink-muted`}`,children:e(`hud.joystick.heave`)}),(0,z.jsx)(`button`,{type:`button`,onClick:()=>dc(e=>!e),"aria-pressed":uc,className:`pointer-events-auto rounded-full border px-2 py-0.5 text-[8px] font-light tracking-[0.2em] backdrop-blur-md transition active:scale-95 ${uc?`ui-line-3 ui-tint-2 ui-ink`:`ui-line-2 ui-surface ui-ink-muted`}`,children:e(`hud.joystick.sway`)})]})}),(0,z.jsx)(rt,{onChange:Vs,value:Bs,label:e(`hud.joystick.look`),positionClass:`bottom-8 right-8`}),W===`float`&&(0,z.jsx)(rt,{onChange:wp.onWaveDirChange,value:wp.waveDirStick,label:e(`hud.joystick.waveDirection`),positionClass:`bottom-36 right-8`,sticky:!0}),(0,z.jsx)(`div`,{className:`pointer-events-none absolute bottom-64 right-8 z-10 select-none`,children:(0,z.jsx)(I,{value:Ti,onChange:Ei,onReset:zf,label:e(`hud.joystick.levelDrift`),min:-20,max:20})}),(W===`noclip`||W===`watercraft`)&&(0,z.jsx)(`div`,{className:`pointer-events-none absolute bottom-36 right-8 z-10 select-none`,children:(0,z.jsx)(le,{value:Sp,onChange:Cp,label:e(`hud.joystick.jump`)})}),W!==`watercraft`&&(0,z.jsxs)(`div`,{className:`pointer-events-auto absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2`,children:[gc&&(0,z.jsxs)(`div`,{className:`flex flex-col items-center gap-2 rounded-3xl border ui-line-1 ui-surface-strong p-4 shadow-2xl backdrop-blur-xl`,children:[(0,z.jsx)(`div`,{className:`flex gap-1 rounded-full border ui-line-1 ui-surface p-1`,children:v.map(t=>(0,z.jsx)(`button`,{type:`button`,onClick:()=>yc(t),"aria-pressed":vc===t,className:`rounded-full px-3 py-1 text-[9px] font-light tracking-[0.2em] transition active:scale-95 ${vc===t?`ui-tint-2 ui-ink`:`ui-ink-muted`}`,children:e(k[t])},t))}),vc===`float`&&(0,z.jsxs)(z.Fragment,{children:[(0,z.jsx)(P,{label:e(`hud.slider.wave`),value:y,min:0,max:100,step:.5,curve:4,format:e=>`${e.toFixed(2)}m`,onChange:M}),(0,z.jsx)(P,{label:e(`hud.slider.tempo`),value:B,min:0,max:10,step:.1,curve:2,format:e=>`${e.toFixed(2)}×`,onChange:lt}),(0,z.jsx)(P,{label:e(`hud.slider.frequency`),value:pt,min:.25,max:4,step:.05,curve:`log`,format:e=>`${e.toFixed(2)}×`,onChange:zt})]}),vc===`noclip`&&(0,z.jsxs)(z.Fragment,{children:[(0,z.jsx)(P,{label:e(`dial.camera.noclipSpeed`),value:yo,min:.2,max:6,step:.1,curve:2,format:e=>`${e.toFixed(1)}×`,onChange:bo}),(0,z.jsx)(P,{label:e(`dial.camera.noclipFallRiseSpeed`),value:xo,min:2,max:300,step:2,curve:2,format:e=>`${e.toFixed(0)}m/s`,onChange:So})]}),vc===`whirlpool`&&(0,z.jsxs)(z.Fragment,{children:[(0,z.jsx)(P,{label:e(`dial.wave.whirlpoolSpeed`),value:Yr,min:0,max:10,step:.1,curve:2,format:e=>`${e.toFixed(2)}×`,onChange:Xr}),(0,z.jsx)(P,{label:e(`dial.wave.whirlpoolDistance`),value:qr,min:3,max:220,step:1,curve:2,format:e=>`${e.toFixed(0)}m`,onChange:Jr})]}),vc===`swing`&&(0,z.jsxs)(z.Fragment,{children:[(0,z.jsx)(P,{label:e(`dial.camera.swingIntensity`),value:Do,min:1e-4,max:2.5,step:.05,curve:2,format:e=>`${e.toFixed(2)}×`,onChange:Oo}),(0,z.jsx)(P,{label:e(`dial.camera.swingPositionY`),value:To,min:0,max:1e5,step:100,curve:2,format:e=>`${e.toFixed(0)}m`,onChange:Eo})]})]}),(0,z.jsx)(`button`,{onClick:()=>_c(e=>!e),className:`rounded-full border ui-line-2 ui-surface px-5 py-2 text-[10px] font-light tracking-[0.35em] ui-ink backdrop-blur-md transition active:scale-95 ui-press`,"aria-label":e(gc?`hud.cameraDrawer.closeAria`:`hud.cameraDrawer.openAria`),"aria-expanded":gc,children:e(gc?`hud.cameraDrawer.closeLabel`:k[vc])})]})]}),Go&&(0,z.jsxs)(`div`,{className:`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col-reverse`,children:[(0,z.jsx)(`div`,{className:`h-1 w-full ui-tint-1`,children:(0,z.jsx)(`div`,{className:`h-full bg-emerald-400`,style:{width:`${Math.round(ls*100)}%`}})}),Yo===`fixed`&&(0,z.jsx)(`div`,{className:`mb-[3px] flex h-1.5 w-full gap-[2px] px-[2px]`,children:Array.from({length:Zo}).map((e,t)=>(0,z.jsx)(`div`,{className:`h-full flex-1 rounded-full ${t<ss?`bg-emerald-400`:t===ss?`bg-emerald-400/50`:`ui-tint-2`}`},t))}),$o&&(0,z.jsx)(`div`,{className:`mb-2 flex justify-center px-4`,children:(0,z.jsxs)(`span`,{className:`rounded-full border ui-line-1 ui-surface px-3 py-1 text-center text-[10px] font-light tracking-[0.15em] ui-ink backdrop-blur-md`,children:[e(k[W]),` · `,N(_p),`/`,N(qo),` (`,e(`hud.intervalRemaining`,{time:N(vp)}),`)`,Yo===`fixed`?` · ${e(`hud.intervalFixedLabel`,{n:ss+1,total:Zo})}`:` · ${e(`hud.intervalInfiniteLabel`,{n:ss+1})}`,e(`hud.totalLabel`),N(ds),yp===null?``:`/${N(yp)} (${e(`hud.intervalRemaining`,{time:N(bp)})})`]})})]}),wc&&(0,z.jsx)(Qe,{onClose:()=>Tc(!1),listDisplays:()=>Wc.current?.listEntries()??[],onCastNew:(e,t)=>Wc.current?.addTV(e,t),onCastTo:(e,t)=>Wc.current?.castTo(e,t),onRemoveAll:()=>Wc.current?.removeAll(),settingsPanelProps:xp,remoteControllerProps:wp,editMode:Mc,setEditMode:Nc}),W===`watercraft`&&(0,z.jsx)(Je,{mode:qc,onModeChange:Jc,buildAction:Yc,onBuildActionChange:Xc,blockType:Zc,onBlockTypeChange:Qc,sculptAction:$c,onSculptActionChange:el,brushRadius:tl,onBrushRadiusChange:nl,brushStrength:rl,onBrushStrengthChange:il,blockCount:al,status:sl,onExport:()=>void dl(),onImportFile:pl,onReset:ml,onDone:()=>vo(`float`)}),(0,z.jsx)(Ve,{open:ll!==null,title:ll?.kind===`reset`?`Clear your build?`:`Import over your current build?`,message:ll?.kind===`reset`?`This removes every block and sculpted shape. This can't be undone.`:`If this file is a saved watercraft world, it will replace your current blocks and sculpt. Export first if you want to keep this build.`,confirmLabel:ll?.kind===`reset`?`Clear`:`Import`,cancelLabel:`Cancel`,onCancel:()=>ul(null),onConfirm:()=>{ll?.kind===`reset`?(G.current?.reset(),cl(`Cleared.`)):ll?.file&&fl(ll.file),ul(null)}})]})}var Ut=[`❤️`,`👍`,`✨`,`🌊`,`💧`,`🙏`,`😊`,`💖`,`🔥`,`🫧`,`☯️`,`💫`,`🧘`,`🥰`];function Wt(e,t){return e>=1e9?`${(e/1e9).toFixed(2)} ${t(`live.viewerBillion`)}`:e>=1e6?`${(e/1e6).toFixed(2)} ${t(`live.viewerMillion`)}`:e>=1e3?`${(e/1e3).toFixed(1)} ${t(`live.viewerThousand`)}`:`${Math.round(e)}`}function Gt(){let{t:e,i18n:t}=i(),[n,r]=(0,R.useState)(28e9),[a,o]=(0,R.useState)(0),[s,c]=(0,R.useState)([]),l=(0,R.useRef)(1);return(0,R.useEffect)(()=>{let e=!0,t=window.setInterval(()=>{e&&r(e=>{let t=(Math.random()-.48)*4e6,n=(Math.random()-.5)*2e7,r=e+t+n;return Math.max(265e8,Math.min(295e8,r))})},700);return()=>{e=!1,window.clearInterval(t)}},[]),(0,R.useEffect)(()=>{let e=window.setInterval(()=>{o(e=>e+Math.floor(1+Math.random()*40))},900);return()=>window.clearInterval(e)},[]),(0,R.useEffect)(()=>{let e=!0,t,n=()=>{if(!e)return;let r=1+Math.floor(Math.random()*3),i=[];for(let e=0;e<r;e++){let e=l.current++;i.push({id:e,emoji:Ut[Math.floor(Math.random()*Ut.length)],x:60+Math.random()*30,drift:(Math.random()-.5)*16,duration:4200+Math.random()*2600,scale:.85+Math.random()*.9})}c(e=>[...e,...i]),i.forEach(e=>{window.setTimeout(()=>{c(t=>t.filter(t=>t.id!==e.id))},e.duration+200)}),t=window.setTimeout(n,260+Math.random()*620)};return t=window.setTimeout(n,400),()=>{e=!1,window.clearTimeout(t)}},[]),(0,z.jsxs)(`div`,{className:`pointer-events-none absolute inset-0 z-40`,children:[(0,z.jsx)(`style`,{children:`
        @keyframes aq-live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.35); }
        }
        @keyframes aq-viewer-blip {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        @keyframes aq-reaction-rise {
          0% { transform: translate3d(0, 0, 0) scale(var(--aq-s, 1)); opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translate3d(var(--aq-dx, 0), -85vh, 0) scale(calc(var(--aq-s, 1) * 1.2)); opacity: 0; }
        }
      `}),(0,z.jsxs)(`div`,{className:`absolute left-4 top-4 flex flex-col gap-2`,children:[(0,z.jsxs)(`div`,{className:`flex items-center gap-2 rounded-md bg-red-600/95 px-2.5 py-1 text-white shadow-lg`,children:[(0,z.jsx)(`span`,{className:`inline-block h-2 w-2 rounded-full bg-white`,style:{animation:`aq-live-pulse 1.4s ease-in-out infinite`},"aria-hidden":`true`}),(0,z.jsx)(`span`,{className:`text-[10px] font-bold tracking-[0.25em]`,children:e(`live.badge`)})]}),(0,z.jsxs)(`div`,{className:`flex items-center gap-1.5 rounded-md ui-surface-strong px-2 py-1 ui-ink backdrop-blur-sm`,style:{animation:`aq-viewer-blip 2.6s ease-in-out infinite`},children:[(0,z.jsxs)(`svg`,{viewBox:`0 0 24 24`,width:`14`,height:`14`,fill:`none`,stroke:`currentColor`,strokeWidth:`1.8`,strokeLinecap:`round`,strokeLinejoin:`round`,"aria-hidden":`true`,children:[(0,z.jsx)(`path`,{d:`M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z`}),(0,z.jsx)(`circle`,{cx:`12`,cy:`12`,r:`3`})]}),(0,z.jsx)(`span`,{className:`text-[11px] font-medium tabular-nums tracking-wide`,children:Wt(n,e)}),(0,z.jsx)(`span`,{className:`text-[9px] ui-ink-muted`,children:e(`live.cellsUnit`)})]}),(0,z.jsx)(`div`,{className:`rounded-md ui-surface px-2 py-1 text-[10px] ui-ink backdrop-blur-sm`,children:e(`live.followerFlow`)})]}),(0,z.jsxs)(`div`,{className:`absolute bottom-[calc(env(safe-area-inset-bottom,0px)+8rem)] right-4 flex items-center gap-1.5 rounded-full ui-surface-strong px-2.5 py-1 ui-ink backdrop-blur-sm`,children:[(0,z.jsx)(`span`,{className:`text-sm leading-none`,children:`❤️`}),(0,z.jsx)(`span`,{className:`text-[11px] font-medium tabular-nums`,children:a.toLocaleString(t.language)})]}),(0,z.jsx)(`div`,{className:`absolute inset-0 overflow-hidden`,children:s.map(e=>(0,z.jsx)(`span`,{className:`absolute select-none`,style:{left:`${e.x}vw`,bottom:`6rem`,fontSize:`26px`,filter:`drop-shadow(0 2px 4px rgba(0,0,0,0.4))`,animation:`aq-reaction-rise ${e.duration}ms ease-out forwards`,"--aq-dx":`${e.drift}vw`,"--aq-s":e.scale},"aria-hidden":`true`,children:e.emoji},e.id))})]})}export{Ht as Aquafulness,Bt as component};