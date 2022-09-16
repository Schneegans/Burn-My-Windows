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
uniform vec2 uStartPos;

const float FADE_WIDTH = 1.0;  // Width of the transition.

void main() {

  // Now we compute a 2D gradient in [0..1] which covers the entire window. The dark
  // regions will be burned first, the bright regions in the end. We mix a radial gradient
  // with some noise. The center of the radial gradient is positioned at uStartPos.
  float circle = length(iTexCoord - uStartPos);

  float progress = easeOutQuad(uProgress);
  progress       = ((1.0 - progress) * (1.0 + FADE_WIDTH) - 1.0 + circle) / FADE_WIDTH;
  progress       = smoothstep(0.0, 1.0, progress);

  progress = uForOpening ? progress : 1.0 - progress;

  // The current level of pixelation increases with the progress.
  float pixelSize = ceil(uPixelSize * progress + 1.0);
  vec2 pixelGrid  = vec2(pixelSize) / uSize;
  vec2 texcoord   = iTexCoord.st - mod(iTexCoord.st, pixelGrid) + pixelGrid * 0.5;
  vec4 oColor     = getInputColor(texcoord);

  // Hide pixels in the transition zone.
  float random = simplex2DFractal(texcoord * uSize / 20.0) * 1.5 - 0.25;
  if (progress > random) {
    oColor.a *= max(0.0, 1.0 - (progress - random) * 10.0);
  }

  // These are pretty useful for understanding how this works.
  // oColor = vec4(progress, 0.0, 0.0, 1.0);
  // oColor = vec4(random, 0.0, 0.0, 1.0);

  setOutputColor(oColor);
}