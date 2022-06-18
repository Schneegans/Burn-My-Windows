//////////////////////////////////////////////////////////////////////////////////////////
//          )                                                   (                       //
//       ( /(   (  (               )    (       (  (  (         )\ )    (  (            //
//       )\()) ))\ )(   (         (     )\ )    )\))( )\  (    (()/( (  )\))(  (        //
//      ((_)\ /((_|()\  )\ )      )\  '(()/(   ((_)()((_) )\ )  ((_)))\((_)()\ )\       //
//      | |(_|_))( ((_)_(_/(    _((_))  )(_))  _(()((_|_)_(_/(  _| |((_)(()((_|(_)      //
//      | '_ \ || | '_| ' \))  | '  \()| || |  \ V  V / | ' \)) _` / _ \ V  V (_-<      //
//      |_.__/\_,_|_| |_||_|   |_|_|_|  \_, |   \_/\_/|_|_||_|\__,_\___/\_/\_//__/      //
//                                 |__/                                                 //
//                       Copyright (c) 2021 Simon Schneegans                            //
//          Released under the GPLv3 or later. See LICENSE file for details.            //
//////////////////////////////////////////////////////////////////////////////////////////

// The content from common.glsl is automatically prepended to each shader effect.

uniform vec2 uSeed;
// uniform vec3 uColor;
uniform float uScale;
// uniform float uWidth;
uniform float uTurbulence;

const float SCORCH_WIDTH = 0.1;
const float BURN_WIDTH   = 0.02;
const float SMOKE_WIDTH  = 0.6;

vec4 getFireColor(float val) {
  return vec4(tritone(val, vec3(0.0), vec3(1.0, 0.8, 0.6), vec3(1.0)), val);
}

void main() {

  float hideThreshold = mix(-SCORCH_WIDTH, 1.0 + SMOKE_WIDTH, uProgress);
  vec2 scorchRange    = uForOpening ? vec2(hideThreshold - SCORCH_WIDTH, hideThreshold)
                                    : vec2(hideThreshold, hideThreshold + SCORCH_WIDTH);
  vec2 smokeRange     = vec2(hideThreshold - SMOKE_WIDTH, hideThreshold);
  vec2 burnRange      = vec2(hideThreshold - BURN_WIDTH, hideThreshold + BURN_WIDTH);

  vec2 uv = cogl_tex_coord_in[0].st / uScale * uSize;

  float noise    = simplex2DFractal(uv * 0.005 + uSeed);
  float gradient = rotate(cogl_tex_coord_in[0].st - 0.5, uSeed.x * 2.0 * 3.141).x + 0.5;

  float mask = mix(gradient, noise, 0.15);

  vec2 distort = vec2(0.0);

  if (!uForOpening && (smokeRange.x < mask && mask < smokeRange.y)) {
    distort.y += pow(1.0 - (mask - smokeRange.x) / SMOKE_WIDTH, 2.0) * 0.1;
  }

  if ((uForOpening && mask > scorchRange.x) || (!uForOpening && mask <= scorchRange.y)) {
    distort +=
      0.5 * vec2(dFdx(mask), dFdy(mask)) * (scorchRange.y - mask) / SCORCH_WIDTH * 5.0;
  }

  vec4 oColor = getInputColor(cogl_tex_coord_in[0].st + distort);

  if ((uForOpening && mask > smokeRange.y) || (!uForOpening && mask < smokeRange.y)) {
    oColor = vec4(0.0);
  }

  float smoke =
    smoothstep(0, 1, (mask - smokeRange.x) / SMOKE_WIDTH) * getRelativeEdgeMask(0.1);
  smoke *=
    simplex2DFractal(uv * 0.01 + uSeed - smoke * smoke * vec2(0.0, 0.1 * uDuration));
  float emberNoise =
    simplex2DFractal(uv * 0.075 + uSeed - smoke * vec2(0.0, 0.5 * uDuration));

  if (smokeRange.x < mask && mask < smokeRange.y) {

    oColor       = alphaOver(oColor, vec4(0.5 * vec3(smoke), smoke));
    float embers = clamp(pow(emberNoise + 0.32, 100.0), 0.0, 2.0) * smoke;
    embers += clamp(pow(emberNoise + 0.32, 10.0), 0.0, 2.0) * smoke;
    oColor = alphaOver(oColor, getFireColor(embers));
  }

  // Add scorch effect.
  if (scorchRange.x < mask && mask < scorchRange.y) {
    float scorch = smoothstep(1, 0, (mask - scorchRange.x) / SCORCH_WIDTH);

    if (uForOpening) {
      scorch = 1.0 - scorch;
    }

    oColor.rgb = mix(oColor.rgb, mix(oColor.rgb, vec3(0.1, 0.05, 0.02), 0.4), scorch);
  }

  if (burnRange.x < mask && mask < burnRange.y) {
    float fireEdge = smoothstep(1, 0, abs(mask - hideThreshold) / BURN_WIDTH) * oColor.a;
    fireEdge       = fireEdge * pow(emberNoise + 0.4, 4.0);
    oColor         = alphaOver(oColor, getFireColor(fireEdge));
  }

  setOutputColor(oColor);
}