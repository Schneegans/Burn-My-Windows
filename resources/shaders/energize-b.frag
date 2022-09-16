//////////////////////////////////////////////////////////////////////////////////////////
//          )                                                   (                       //
//       ( /(   (  (               )    (       (  (  (         )\ )    (  (            //
//       )\()) ))\ )(   (         (     )\ )    )\))( )\  (    (()/( (  )\))(  (        //
//      ((_)\ /((_|()\  )\ )      )\  '(()/(   ((_)()((_) )\ )  ((_)))\((_)()\ )\       //
//      | |(_|_))( ((_)_(_/(    _((_))  )(_))  _(()((_|_)_(_/(  _| |((_)(()((_|(_)      //
//      | '_ \ || | '_| ' \))  | '  \()| || |  \ V  V / | ' \)) _` / _ \ V  V (_-<      //
//      |_.__/\_,_|_| |_||_|   |_|_|_|  \_, |   \_/\_/|_|_||_|\__,_\___/\_/\_//__/      //
//                                 |__/                                                 //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

// The content from common.glsl is automatically prepended to each shader effect.

uniform vec3 uColor;
uniform float uScale;

const float SHOWER_TIME  = 0.3;
const float SHOWER_WIDTH = 0.3;
const float STREAK_TIME  = 0.6;
const float EDGE_FADE    = 50.0;

// This method returns four values:
//  result.x: A mask for the particles which lead the shower.
//  result.y: A mask for the streaks which follow the shower particles.
//  result.z: A mask for the final "atom" particles.
//  result.w: The opacity of the fading window.
vec4 getMasks(float progress) {
  float showerProgress = progress / SHOWER_TIME;
  float streakProgress = clamp((progress - SHOWER_TIME) / STREAK_TIME, 0.0, 1.0);
  float fadeProgress   = clamp((progress - SHOWER_TIME) / (1.0 - SHOWER_TIME), 0.0, 1.0);

  // Gradient from top to bottom.
  float t = iTexCoord.t;

  // A smooth gradient which moves to the bottom within the showerProgress.
  float showerMask =
    smoothstep(1.0, 0.0, abs(showerProgress - t - SHOWER_WIDTH) / SHOWER_WIDTH);

  // This is 1 above the streak mask.
  float streakMask = (showerProgress - t - SHOWER_WIDTH) > 0.0 ? 1.0 : 0.0;

  // Compute mask for the "atom" particles.
  float atomMask = getRelativeEdgeMask(0.2);
  atomMask       = max(0.0, atomMask - showerMask);
  atomMask *= streakMask;
  atomMask *= sqrt(1.0 - fadeProgress * fadeProgress);

  // Make some particles visible in the streaks.
  showerMask += 0.05 * streakMask;

  // Add shower mask to streak mask.
  streakMask = max(streakMask, showerMask);

  // Fade-out the masks at the window edges.
  float edgeFade = getAbsoluteEdgeMask(EDGE_FADE, 0.5);
  streakMask *= edgeFade;
  showerMask *= edgeFade;

  // Fade-out the masks from top to bottom.
  float fade = smoothstep(0.0, 1.0, 1.0 + t - 2.0 * streakProgress);
  streakMask *= fade;
  showerMask *= fade;

  // Compute fading window opacity.
  float windowMask = pow(1.0 - fadeProgress, 2.0);

  if (uForOpening) {
    windowMask = 1.0 - windowMask;
  }

  return vec4(showerMask, streakMask, atomMask, windowMask);
}

void main() {
  float progress = easeOutQuad(uProgress);

  vec4 masks  = getMasks(progress);
  vec4 oColor = getInputColor(iTexCoord.st);

  // Dissolve window to effect color / transparency.
  oColor.rgb = mix(uColor, oColor.rgb, 0.5 * masks.w + 0.5);
  oColor.a   = oColor.a * masks.w;

  // Add leading shower particles.
  vec2 showerUV = iTexCoord.st + vec2(0.0, -0.7 * progress / SHOWER_TIME);
  showerUV *= 0.02 * uSize / uScale;
  float shower = pow(simplex2D(showerUV), 10.0);
  oColor.rgb += uColor * shower * masks.x;
  oColor.a += shower * masks.x;

  // Add trailing streak lines.
  vec2 streakUV = iTexCoord.st + vec2(0.0, -progress / SHOWER_TIME);
  streakUV *= vec2(0.05 * uSize.x, 0.001 * uSize.y) / uScale;
  float streaks = simplex2DFractal(streakUV) * 0.5;
  oColor.rgb += uColor * streaks * masks.y;
  oColor.a += streaks * masks.y;

  // Add glimmering atoms.
  vec2 atomUV = iTexCoord.st + vec2(0.0, -0.025 * progress / SHOWER_TIME);
  atomUV *= 0.2 * uSize / uScale;
  float atoms = pow((simplex3D(vec3(atomUV, uProgress * uDuration))), 5.0);
  oColor.rgb += uColor * atoms * masks.z;
  oColor.a += atoms * masks.z;

  // These are pretty useful for understanding how this works.
  // oColor = vec4(masks.rgb, 1.0);
  // oColor = vec4(vec3(masks.x), 1.0);
  // oColor = vec4(vec3(masks.y), 1.0);
  // oColor = vec4(vec3(masks.z), 1.0);
  // oColor = vec4(vec3(masks.w), 1.0);
  // oColor = vec4(vec3(shower), 1.0);
  // oColor = vec4(vec3(streaks), 1.0);
  // oColor = vec4(vec3(atoms), 1.0);

  setOutputColor(oColor);
}