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

// SPDX-FileCopyrightText: Justin Garza JGarza9788@gmail.com
// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

// The content from common.glsl is automatically prepended to each shader effect. This
// provides the standard input:

// vec2  iTexCoord:     Texture coordinates for retrieving the window input color.
// bool  uIsFullscreen: True if the window is maximized or in fullscreen mode.
// bool  uForOpening:   True if a window-open animation is ongoing, false otherwise.
// float uProgress:     A value which transitions from 0 to 1 during the animation.
// float uDuration:     The duration of the current animation in seconds.
// vec2  uSize:         The size of uTexture in pixels.
// float uPadding:      The empty area around the actual window (e.g. where the shadow
//                      is drawn). For now, this will only be set on GNOME.

// Furthermore, there are two global methods for reading the window input color and
// setting the shader output color. Both methods assume straight alpha:

// vec4 getInputColor(vec2 coords)
// void setOutputColor(vec4 outColor)

uniform float uBrightness;
uniform float uSpeedR;
uniform float uSpeedG;
uniform float uSpeedB;

float FadeInOut(float t, float power) {
  float s = -1.0 * pow((t - 0.5) / (0.5), power) + 1.0;
  s       = clamp(s, 0.0, 1.0);
  return s;
}

void main() {

  // Calculate the progression value based on the animation direction.
  float progress = uForOpening ? 1.0 - uProgress : uProgress;

  // Percentage of the progress time which is spent until all pixels start moving up.
  float minSpeed     = min(uSpeedR, min(uSpeedG, uSpeedB));
  float waveTime     = mix(0.1, 0.9, minSpeed);
  float waveProgress = progress / waveTime;

  // Gradient from top to bottom (0 at top, 1 at bottom).
  float t = iTexCoord.t;

  // Calculate the vertical wave offset.
  float offset = max(waveProgress - t, 0.0);
  offset /= (1.0 / waveTime) - 1.0;
  offset *= (1.0 - waveTime);

  vec4 colorR = getInputColor(iTexCoord + vec2(0.0, offset * (uSpeedR - minSpeed + 1.0)));
  vec4 colorG = getInputColor(iTexCoord + vec2(0.0, offset * (uSpeedG - minSpeed + 1.0)));
  vec4 colorB = getInputColor(iTexCoord + vec2(0.0, offset * (uSpeedB - minSpeed + 1.0)));

  vec4 oColor =
    vec4(colorR.r, colorG.g, colorB.b, (colorR.a + colorG.a + colorB.a) / 3.0);
  oColor.rgb *= mix(1.0, uBrightness, FadeInOut(progress, 4));

  oColor.a *= getAbsoluteEdgeMask(30.0, 1.0);

  setOutputColor(oColor);
}
