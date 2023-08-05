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

uniform vec2 uActorScale;
uniform vec2 uInitialPointerPos;
uniform vec2 uCurrentPointerPos;
uniform vec2 uControlPointA;
uniform vec2 uControlPointB;

vec2 threeWayMix(float fac, vec2 a, vec2 b, vec2 c) {
  if (fac < 0.5) {
    return mix(a, b, smoothstep(0.0, 1.0, fac * 2.0));
  }

  return mix(b, c, smoothstep(0.0, 1.0, fac * 2.0 - 1.0));
}

void main() {

  vec2 texcoord = iTexCoord.st;
  texcoord      = texcoord * uActorScale + 0.5 - uActorScale * 0.5;

  float circle = length((texcoord - uCurrentPointerPos) / uActorScale * 2.0);
  float progress = uForOpening ? 1.0 - uProgress : uProgress;
  progress = clamp(mix(max(0.0, uProgress*2.0 - circle), 2.0 * uProgress, uProgress), 0.0, 1.0);
  // progress = smoothstep(0.0, 1.0, pow(2.0 * progress - circle, 0.5));

  vec2 warpA = (texcoord - uControlPointA) * uProgress * progress / (1.0 - uProgress);
  vec2 warpB = (texcoord - uControlPointB) * uProgress * progress / (1.0 - uProgress);
  vec2 warpC = (texcoord - uCurrentPointerPos) * uProgress * progress / (1.0 - uProgress);

  vec2 warp = threeWayMix(progress, warpA, warpB, warpC);
  // vec2 warp = (warpA + warpB + warpC) / (progressA + progressB + progressC);

  vec4 oColor = getInputColor(texcoord + warp);

  //  oColor = vec4(tritone(progress, vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), vec3(0.0, 0.0, 1.0)), 1.0);

  // if (length(texcoord - uInitialPointerPos) < 0.02) {
  //   oColor = vec4(1.0);
  // }

  // if (length(texcoord - uCurrentPointerPos) < 0.02) {
  //   oColor = vec4(1.0, 0.0, 0.0, 1.0);
  // }

  // if (length(texcoord - uControlPointA) < 0.02) {
  //   oColor = vec4(0.0, 1.0, 0.0, 1.0);
  // }

  // if (length(texcoord - uControlPointB) < 0.02) {
  //   oColor = vec4(0.0, 0.0, 1.0, 1.0);
  // }

  setOutputColor(oColor);
}