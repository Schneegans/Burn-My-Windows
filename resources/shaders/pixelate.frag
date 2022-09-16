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

uniform float uNoise;
uniform float uPixelSize;

void main() {
  // We simply inverse the progress for opening windows.
  float progress = uForOpening ? 1.0 - uProgress : uProgress;

  // The current level of pixelation increases with the progress.
  float pixelSize = ceil(uPixelSize * progress + 1.0);
  vec2 pixelGrid  = vec2(pixelSize) / uSize;
  vec2 texcoord   = iTexCoord.st - mod(iTexCoord.st, pixelGrid) + pixelGrid * 0.5;
  vec4 oColor     = getInputColor(texcoord);

  // Hide selected pixels based on some random noise.
  float random = simplex2DFractal(texcoord * uNoise * uSize / 1000.0) * 1.5 - 0.25;
  if (progress > random) {
    oColor.a *= max(0.0, 1.0 - (progress - random) * 20.0);
  }

  setOutputColor(oColor);
}