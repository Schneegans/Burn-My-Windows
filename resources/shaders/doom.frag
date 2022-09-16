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

uniform float uActorScale;
uniform float uHorizontalScale;
uniform float uVerticalScale;
uniform float uPixelSize;

// This method returns a mask which smoothly transitions towards zero when approaching
// the window's top or bottom border.
float getEdgeMask(vec2 uv, float fadeWidth) {
  float mask = 1.0;
  mask *= smoothstep(0.0, 1.0, clamp(uv.y / fadeWidth, 0.0, 1.0));
  mask *= smoothstep(0.0, 1.0, clamp((1.0 - uv.y) / fadeWidth, 0.0, 1.0));
  return mask;
}

void main() {
  // We simply inverse the pixelation progress for opening windows.
  float pixelateProgress = uForOpening ? 0.9 - uProgress : uProgress;
  float pixelSize        = max(1.0, ceil(uPixelSize * pixelateProgress + 1.0));
  vec2 pixelGrid         = vec2(pixelSize) / uSize;

  // Snap texcoords to pixel grid.
  vec2 texcoord = iTexCoord.st;
  texcoord.y    = texcoord.y * uActorScale + 0.5 - uActorScale * 0.5;
  texcoord -= mod(iTexCoord.st, pixelGrid);
  texcoord += pixelGrid * 0.5;

  // The pixel columns move vertically. The offset is generated with a random noise
  // function.
  float hScale = uHorizontalScale * uSize.x * 0.001;
  float noise  = simplex2DFractal(texcoord.xx * hScale) * 2.0 - 0.5;

  // Shift the pixel columns vertically over time.
  float vScale        = uVerticalScale * uSize.y * 0.00002 * uActorScale;
  float shiftProgress = uForOpening ? mix(-vScale - 1.0, 0.0, uProgress)
                                    : mix(-vScale, 1.0 + vScale, uProgress);
  float shift         = noise * vScale + shiftProgress;

  if (uForOpening) {
    texcoord.y -= 0.5 * uActorScale * min(shift, 0.0);
  } else {
    texcoord.y -= 0.5 * uActorScale * max(shift, 0.0);
  }

  vec4 oColor = getInputColor(texcoord);

  // Fade window texture at the top and bottom.
  oColor.a *= getEdgeMask(iTexCoord.st, 0.1);

  setOutputColor(oColor);
}