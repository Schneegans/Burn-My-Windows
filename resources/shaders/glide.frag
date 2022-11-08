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
uniform float uShift;

void main() {
  // We reverse the progress for window opening.
  float progress = easeOutQuad(uProgress);
  progress       = uForOpening ? 1.0 - progress : progress;

  // Put texture coordinate origin to center of window.
  vec2 coords = iTexCoord.st * 2.0 - 1.0;

  // Scale image texture with progress.
  coords /= mix(1.0, uScale, progress);

  // Squish image texture vertically.
  coords.y /= mix(1.0, (1.0 - 0.2 * uSquish), progress);

  // 'Tilt' image texture around x-axis.
  coords.x /= mix(1.0, 1.0 - 0.1 * uTilt * coords.y, progress);

  // Move image texture vertically.
  coords.y += uShift * progress;

  // Move texture coordinate center to corner again.
  coords = coords * 0.5 + 0.5;

  vec4 oColor = getInputColor(coords);

  // Dissolve window.
  oColor.a = oColor.a * (uForOpening ? uProgress : pow(1.0 - uProgress, 2.0));

  setOutputColor(oColor);
}