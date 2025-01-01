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

// The width of the fading effect is loaded from the settings.
// uniform float uFadeWidth;

float uBlurQuality = 5.0;
vec4 uSeed = vec4(0.4,0.2,0.4,0.6);

// A simple blur function
vec4 blur(vec2 uv, float radius, float samples) {
  // Initialize the color accumulator to zero.
  vec4 color = vec4(0.0);

  // Define a constant for 2 * PI (tau), which represents a full circle in radians.
  const float tau = 6.28318530718;

  // Number of directions for sampling around the circle.
  const float directions = 15.0;

  // Outer loop iterates over multiple directions evenly spaced around a circle.
  for (float d = 0.0; d < tau; d += tau / directions) {
    // Inner loop samples along each direction, with decreasing intensity.
    for (float s = 0.0; s < 1.0; s += 1.0 / samples) {
      // Calculate the offset for this sample based on direction, radius, and step.
      // The (1.0 - s) term ensures more sampling occurs closer to the center.
      vec2 offset = vec2(cos(d), sin(d)) * radius * (1.0 - s) / uSize;

      // Add the sampled color at the offset position to the accumulator.
      color += getInputColor(uv + offset);
    }
  }

  // Normalize the accumulated color by dividing by the total number of samples
  // and directions to ensure the result is averaged.
  return color / samples / directions;
}



void main() {
  // Calculate the progression value based on the animation direction.
  // If opening, use uProgress as-is; if closing, invert the progression.
  float progress = uForOpening ? 1.0 - uProgress : uProgress ;

  //r is for random ..  4 random numbers between -1.0 and 1.0
  vec4 r = hash42(iTexCoord.st * progress * 0.1) * 2.0 - vec4(0.5);

  //zero to one... mostly one
  float ztomo = remap(
    progress,
    0.0,0.1,
    0.0,1.0
  );
  ztomo = easeInOutSine(ztomo);


  //out Expo
  float oExpo = easeOutExpo(progress);
  float iExpo = easeInExpo(progress);
  float ioSine = easeInOutSine(progress);
  float ioSine_r = 1.0 - ioSine;

  vec2 uv = iTexCoord.st;

  // change the center 
  uv = uv * 2.0 - 1.0;

  //scale
  uv /= ioSine_r;

  //re-center
  uv = uv * 0.5 + 0.5;

  // uv.x -= simplex3D(r.xyz * 50.0) * 0.1;
  // uv.y -= simplex3D(r.xyz * 50.0) * 0.1;

  // uv.x -= sin(progress)

//get color
  vec4 oColor =  blur(uv, ztomo * 100.0,uBlurQuality);
  oColor.a *= ioSine_r;



  setOutputColor(oColor);
}