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

uniform float uPixelSize;
uniform float uSpokeCount;

void main() {
  // We simply inverse the progress for opening windows.
  float progress = smoothstep(0.0, 1.0, uForOpening ? 1.0 - uProgress : uProgress);

  // The current level of pixelation increases with the progress.
  float pixelSize = ceil(uPixelSize * progress + 1.0);
  vec2 pixelGrid  = vec2(pixelSize) / uSize;
  vec2 texcoord   = iTexCoord.st - mod(iTexCoord.st, pixelGrid) + pixelGrid * 0.5;
  vec4 oColor     = getInputColor(texcoord);

  // Now hide the spoke sections.
  vec2 down    = vec2(0.0, 1.0);
  vec2 fragDir = normalize(texcoord - 0.5);

  // Compute angle to down direction.
  float angle = 0.5 * acos(dot(down, fragDir)) / 3.14159265359;
  if (fragDir.x < 0.0) {
    angle = 1.0 - angle;
  }

  // Progressively hide the spokes.
  float threshold = mod(angle * uSpokeCount, 1.0);
  if (progress > threshold) {
    oColor.a = 0.0;
  }

  setOutputColor(oColor);
}