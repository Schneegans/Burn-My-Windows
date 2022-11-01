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

uniform float uScale;
uniform float uSquish;
uniform float uTilt;

void main() {
  float progress = easeOutQuad(uProgress);
  progress       = uForOpening ? 1.0 - progress : progress;

  vec2 coords = iTexCoord.st * 2.0 - 1.0;

  coords /= mix(1.0, uScale, progress);

  coords.y /= mix(1.0, (1.0 - uSquish), progress);

  coords.x /= mix(1.0, 1.0 - uTilt * coords.y, progress);

  coords = coords * 0.5 + 0.5;

  vec4 oColor = getInputColor(coords);

  // Dissolve window to effect color / transparency.
  oColor.a = oColor.a * (1.0 - progress);

  // These are pretty useful for understanding how this works.
  // oColor = vec4(masks, 0.0, 1.0);
  // oColor = vec4(vec3(masks.x), 1.0);
  // oColor = vec4(vec3(masks.y), 1.0);
  // oColor = vec4(vec3(particles), 1.0);

  setOutputColor(oColor);
}