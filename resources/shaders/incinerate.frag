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

// This maps a given value in [0..1] to a color from the rgba color ramp
// [transparent black ... semi-transparent uColor ... opaque white].
vec4 getFireColor(float val) {
  return vec4(tritone(val, vec3(0.0), uColor, vec3(1.0)), val);
}

void main() {

  // The burning fire edge is composed of multiple regions. The width of all regions is
  // defined below. If a window is closed and the burning direction happens to be from top
  // to bottom, the different zones are arragned like this:
  //
  //   .      .    .      .   ^
  //      .  :     .:   .     |  smokeRange: In this zone, smoke and little ember
  //   . :  : .. :   :  .     |              particles are drawn.
  //     : .  .:.:  .:  :..   |
  //   ...:: ..: :: : .  ..   |
  //    :: )  .. : : ..: : .  |  ^
  //    ( /(   (  (  . .::.   |  |  flameRange: Flames are drawn in this zone.
  //    )\()) ))\ )( . (  .   |  |
  //   ((_)\ /((_|()\  )\ )   |  |                                     ^
  //   | |(_|_))( ((_)_(_/(   v  v                                     | burnRange: In
  //   /////////////////////  <- hideThreshold: From here on,          | this zone, a
  //   | / / / / / / / / / |  ^                 the window is hidden.  | firery edge is
  //   |  /  /  /  /  /  / |  |                                        v drawn.
  //   | /   /   /   /   / |  v  scorchRange: The window becomes
  //   |                   |                  brownish and a subtle
  //   |                   |                  heat distortion effect
  //   |                   |                  kicks in.
  //   |                   |
  //   \___________________/
  //
  // If a window is opened, the window texture is visible on the other side of the
  // hideThreshold and the scorchRange is also flipped to the other side (so it is drawn
  // below the flames and the smoke).

  // All widths depend on the configured scale of the effect.
  float SCORCH_WIDTH = 0.2 * uScale;
  float BURN_WIDTH   = 0.03 * uScale;
  float SMOKE_WIDTH  = 0.9 * uScale;
  float FLAME_WIDTH  = 0.2 * uScale;

  // During the animation, the hideThreshold transitions from a small value to a larger
  // value, so that all the above ranges are covered.
  float hideThreshold =
    mix(uForOpening ? 0.0 : -SCORCH_WIDTH, 1.0 + SMOKE_WIDTH, uProgress);

  // The individual ranges are now given by the current hideThreshold and the widths of
  // the zones.
  vec2 scorchRange = uForOpening ? vec2(hideThreshold - SCORCH_WIDTH, hideThreshold)
                                 : vec2(hideThreshold, hideThreshold + SCORCH_WIDTH);
  vec2 burnRange   = vec2(hideThreshold - BURN_WIDTH, hideThreshold + BURN_WIDTH);
  vec2 flameRange  = vec2(hideThreshold - FLAME_WIDTH, hideThreshold);
  vec2 smokeRange  = vec2(hideThreshold - SMOKE_WIDTH, hideThreshold);

  vec2 center  = uSeed.x > uSeed.y ? vec2(uSeed.x, floor(uSeed.y + 0.5))
                                   : vec2(floor(uSeed.x + 0.5), uSeed.y);
  float circle = length(iTexCoord - center);

  vec2 uv = iTexCoord / uScale * uSize / 1.5;
  float smokeNoise =
    simplex2DFractal(uv * 0.01 + uSeed + uProgress * vec2(0.0, 0.3 * uDuration));

  float mask =
    mix(circle, smokeNoise, 200.0 * uTurbulence * uScale / max(uSize.x, uSize.y));

  float smokeMask = smoothstep(0.0, 1.0, (mask - smokeRange.x) / SMOKE_WIDTH) *
                    getAbsoluteEdgeMask(100.0, 0.3);
  float flameMask = smoothstep(0.0, 1.0, (mask - flameRange.x) / FLAME_WIDTH) *
                    getAbsoluteEdgeMask(20.0, 0.0);
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