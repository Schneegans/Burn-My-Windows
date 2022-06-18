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
uniform vec3 uColor;
uniform float uScale;
// uniform float uWidth;
uniform float uTurbulence;

const float SCORCH_WIDTH = 0.1;
const float BURN_WIDTH   = 0.02;
const float SMOKE_WIDTH  = 0.6;
const float FLAME_WIDTH  = 0.1;

vec4 getFireColor(float val) {
  return vec4(tritone(val, vec3(0.0), uColor, vec3(1.0)), val);
}

void main() {

  float hideThreshold = mix(-SCORCH_WIDTH, 1.0 + SMOKE_WIDTH, uProgress);
  vec2 scorchRange    = uForOpening ? vec2(hideThreshold - SCORCH_WIDTH, hideThreshold)
                                    : vec2(hideThreshold, hideThreshold + SCORCH_WIDTH);
  vec2 burnRange      = vec2(hideThreshold - BURN_WIDTH, hideThreshold + BURN_WIDTH);
  vec2 flameRange     = vec2(hideThreshold - FLAME_WIDTH, hideThreshold);
  vec2 smokeRange     = vec2(hideThreshold - SMOKE_WIDTH, hideThreshold);

  vec2 uv = cogl_tex_coord_in[0].st / uScale * uSize;

  float noise    = simplex2DFractal(uv * 0.005 + uSeed);
  float gradient = rotate(cogl_tex_coord_in[0].st - 0.5, uSeed.x * 2.0 * 3.141).x + 0.5;

  float mask = mix(gradient, noise, 0.15);

  // Now we retrieve the window color. We add some distortion in the scorch zone.
  vec2 distort = vec2(0.0);

  if ((uForOpening && mask > scorchRange.x) || (!uForOpening && mask <= scorchRange.y)) {
    distort =
      0.5 * vec2(dFdx(mask), dFdy(mask)) * (scorchRange.y - mask) / SCORCH_WIDTH * 5.0;
  }

  vec4 oColor = getInputColor(cogl_tex_coord_in[0].st + distort);

  // Hide after buring zone has passed.
  if ((uForOpening && mask > smokeRange.y) || (!uForOpening && mask < smokeRange.y)) {
    oColor = vec4(0.0);
  }

  float smokeMask =
    smoothstep(0, 1, (mask - smokeRange.x) / SMOKE_WIDTH) * getRelativeEdgeMask(0.1);

  float smokeNoise = simplex2DFractal(uv * 0.01 + uSeed -
                                      smokeMask * smokeMask * vec2(0.0, 0.1 * uDuration));

  float flameNoise =
    simplex2DFractal(uv * 0.02 + uSeed - smokeNoise * vec2(0.0, 1.0 * uDuration) -
                     vec2(0.0, uProgress * uDuration));
  float emberNoise =
    simplex2DFractal(uv * 0.075 + uSeed - smokeMask * vec2(0.0, 0.2 * uDuration));

  if (smokeRange.x < mask && mask < smokeRange.y) {

    float smoke = smokeMask * smokeNoise;
    oColor      = alphaOver(oColor, vec4(0.5 * vec3(smoke), smoke));

    float embers = clamp(pow(emberNoise + 0.3, 100.0), 0.0, 2.0) * smoke;
    // embers += clamp(pow(emberNoise + 0.32, 10.0), 0.0, 2.0) * smoke;
    oColor += getFireColor(embers);
  }

  if (flameRange.x < mask && mask < flameRange.y) {

    float flameMask =
      smoothstep(0, 1, (mask - flameRange.x) / FLAME_WIDTH) * getRelativeEdgeMask(0.1);

    float flame = clamp(pow(flameNoise + 0.3, 20.0), 0.0, 2.0) * flameMask;
    flame += clamp(pow(flameNoise + 0.8, 5.0), 0.0, 2.0) * flameMask * 0.1;
    oColor += getFireColor(flame);
  }

  // Add scorch effect.
  if (scorchRange.x < mask && mask < scorchRange.y) {
    float scorch = smoothstep(1, 0, (mask - scorchRange.x) / SCORCH_WIDTH);

    if (uForOpening) {
      scorch = 1.0 - scorch;
    }

    oColor.rgb = mix(oColor.rgb, mix(oColor.rgb, vec3(0.1, 0.05, 0.02), 0.4), scorch);
  }

  // Add burning edge.
  if (burnRange.x < mask && mask < burnRange.y) {
    float fireEdge = smoothstep(1, 0, abs(mask - hideThreshold) / BURN_WIDTH) * oColor.a;
    fireEdge       = fireEdge * pow(flameNoise + 0.4, 4.0);
    oColor += getFireColor(fireEdge * oColor.a);
  }

  setOutputColor(oColor);
}