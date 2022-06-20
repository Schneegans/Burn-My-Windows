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
uniform float uTurbulence;

vec4 getFireColor(float val) {
  return vec4(tritone(val, vec3(0.0), uColor, vec3(1.0)), val);
}

void main() {

  float SCORCH_WIDTH = 0.15 * uScale;
  float BURN_WIDTH   = 0.02 * uScale;
  float SMOKE_WIDTH  = 0.6 * uScale;
  float FLAME_WIDTH  = 0.15 * uScale;

  float hideThreshold = mix(-SCORCH_WIDTH, 1.0 + SMOKE_WIDTH, uProgress);
  vec2 scorchRange    = uForOpening ? vec2(hideThreshold - SCORCH_WIDTH, hideThreshold)
                                    : vec2(hideThreshold, hideThreshold + SCORCH_WIDTH);
  vec2 burnRange      = vec2(hideThreshold - BURN_WIDTH, hideThreshold + BURN_WIDTH);
  vec2 flameRange     = vec2(hideThreshold - FLAME_WIDTH, hideThreshold);
  vec2 smokeRange     = vec2(hideThreshold - SMOKE_WIDTH, hideThreshold);

  vec2 uv = iTexCoord / uScale * uSize;

  float smokeNoise =
    simplex2DFractal(uv * 0.01 + uSeed + uProgress * vec2(0.0, 0.3 * uDuration));

  vec2 center  = uSeed.x > uSeed.y ? vec2(uSeed.x, floor(uSeed.y + 0.5))
                                   : vec2(floor(uSeed.x + 0.5), uSeed.y);
  float circle = length(iTexCoord - center);
  float mask   = mix(circle, smokeNoise, 0.2 * uTurbulence * uScale);

  float smokeMask =
    smoothstep(0.0, 1.0, (mask - smokeRange.x) / SMOKE_WIDTH) * getRelativeEdgeMask(0.2);
  float flameMask =
    smoothstep(0.0, 1.0, (mask - flameRange.x) / FLAME_WIDTH) * getRelativeEdgeMask(0.1);
  float fireMask   = smoothstep(1.0, 0.0, abs(mask - hideThreshold) / BURN_WIDTH);
  float scorchMask = smoothstep(1.0, 0.0, (mask - scorchRange.x) / SCORCH_WIDTH);

  if (uForOpening) {
    scorchMask = 1.0 - scorchMask;
  }

  // Now we retrieve the window color. We add some distortion in the scorch zone.
  vec2 distort = vec2(0.0);

  if ((uForOpening && mask >= scorchRange.x) || (!uForOpening && mask <= scorchRange.y)) {
    distort = vec2(dFdx(mask), dFdy(mask)) * scorchMask * 5.0;
  }

  vec4 oColor = getInputColor(iTexCoord + distort);

  // Hide after buring zone has passed.
  if ((uForOpening && mask > smokeRange.y) || (!uForOpening && mask < smokeRange.y)) {
    oColor = vec4(0.0);
  }

  // Add smoke and embers.
  if (smokeRange.x < mask && mask < smokeRange.y) {
    float smoke = smokeMask * smokeNoise;
    oColor      = alphaOver(oColor, vec4(0.5 * vec3(smoke), smoke));

    float emberNoise = simplex2DFractal(
      uv * 0.05 + uSeed - smokeNoise * vec2(0.0, 0.3 * smokeMask * uDuration));
    float embers = clamp(pow(emberNoise + 0.3, 100.0), 0.0, 2.0) * smoke;
    oColor += getFireColor(embers);
  }

  // Add scorch effect.
  if (scorchRange.x < mask && mask < scorchRange.y) {
    oColor.rgb = mix(oColor.rgb, mix(oColor.rgb, vec3(0.1, 0.05, 0.02), 0.4), scorchMask);
  }

  // Add trailing flames.
  if (min(burnRange.x, flameRange.x) < mask && mask < max(burnRange.y, flameRange.y)) {
    float flameNoise =
      simplex2DFractal(uv * 0.02 + uSeed + smokeNoise * vec2(0.0, 1.0 * uDuration) +
                       vec2(0.0, uProgress * uDuration));

    if (flameRange.x < mask && mask < flameRange.y) {
      float flame = clamp(pow(flameNoise + 0.3, 20.0), 0.0, 2.0) * flameMask;
      flame += clamp(pow(flameNoise + 0.4, 10.0), 0.0, 2.0) * flameMask * flameMask * 0.1;
      oColor += getFireColor(flame);
    }

    // Add burning edge.
    if (burnRange.x < mask && mask < burnRange.y) {
      float fire = fireMask * pow(flameNoise + 0.4, 4.0) * oColor.a;
      oColor += getFireColor(fire);
    }
  }

  setOutputColor(oColor);
}