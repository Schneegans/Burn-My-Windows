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
uniform float uStretchR;
uniform float uStretchG;
uniform float uStretchB;


float FadeInOut(float t, float power)
{
  float s = -1.0 * pow((t-0.5)/(0.5),power)+1.0;
  s = clamp(s,0.0,1.0);
  return s;
}



void main() {

  // Calculate the progression value based on the animation direction.
  // If opening, use uProgress as-is; if closing, invert the progression.
  float progress = uForOpening ? uProgress : 1.0 - uProgress;

  //progress will now go from 0.5 to 1.0
  progress = mix(0.5,1.0,progress);

  // the UV
  vec2 uv = iTexCoord.st;
  //flipped the uv
  vec2 f = vec2(uv.x,1.0 - uv.y);

  // w is the wave
  float w = 0.0;


  //w will be used to calculate the the size of the wave
  float p = mix(0.0, 1.0 + 1.0, progress);
  w = 1.0 - abs(p -  f.y);
  w = clamp(w,0.0,1.0);
  w = pow(w, mix(100.0,1.0,1.0) );

  //starting output color
  vec4 oColor = vec4(0.0);

  // outputs for RGB is based on the color of the window, times uStreatch(RG and B), and another multipler for the brightness

  oColor.r = getInputColor(uv + vec2(0.0,w * uStretchR ) ).r * mix(1.0, uBrightness, FadeInOut(progress,4));
  oColor.g = getInputColor(uv + vec2(0.0,w * uStretchG ) ).g * mix(1.0, uBrightness, FadeInOut(progress,4));
  oColor.b = getInputColor(uv + vec2(0.0,w * uStretchB ) ).b * mix(1.0, uBrightness, FadeInOut(progress,4));

  //if you can think of a better way to handle the alpha ... try that

  if (oColor.r + oColor.g + oColor.b > 0.0)
  {
    oColor.a = getInputColor(uv).a ;
  }
  else
  {
    oColor.a = 0.0;
  }



  setOutputColor(oColor);
}
