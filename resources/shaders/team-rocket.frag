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

uniform float uWT;
uniform float uXpos;
uniform float uYpos;
uniform float uSparkleRot;
uniform float uSparkleSize;
uniform bool uWinRot;
uniform vec2 uSeed;

//use to scale the window
vec2 scaleUV(vec2 uv, vec2 scale, vec2 centerOffset)
{
  // Put texture coordinate origin to center of window.
  uv -= centerOffset;
  uv = uv * 2.0 - 1.0;

  //scale
  uv /= mix(vec2(1.0,1.0), vec2(0.0,0.0), scale);

  // scale from center
  uv = uv * 0.5 + 0.5;
  

  return uv;
}


//this returns the Spark
float getSpark(vec2 uv, vec2 center, float brightness, float size, float rotation)
{
  //the brightness of the spark
  brightness = clamp(brightness,0.001,1.0);
  //the size 
  size = clamp(size,0.001,1.0);

  float bn = mix(0.0,0.07,brightness); //recalculate size
  
  uv = (uv + vec2(0.5)) ; //set center 
  uv = (uv - center) ;//Center UV coordinates, then scale to fit the star size
  uv = scaleUV(uv, vec2(1.0 - size), vec2(0.0));
  uv = rotate(uv, rotation, vec2(0.5)); //rotate the UV

  //this is basically the brightness
  float p = mix(-1.0,1000.0,easeInExpo(bn));

  float m = mix(
      0.0,
      1.0,
      clamp(
          pow(abs(uv.x-0.5)*2.0,p) + pow(abs(uv.y-0.5)*2.0,p),0.0,1.0
      )
      );

  //calcuate and return this mask
  float mask = easeInSine(1.0 - (m - bn)) - 0.004 ;
  mask = clamp(mask,0.0,1.0);
  return mask;
  
}


//fades out at 0 and 1 ...based on the power 
// 1|    __________
//  |   /          \
//  |  /            \
//  | /              \ 
//  |/                \
// 0|0.................1
/*
graph above ... where t is close to 0, or 1 the result will fade to zero
i.e. this is just the function of power(x,p) shifted
where x is time, and p is 2.0,4.0,8.0,10.0 ... or any positive even number
*/
float FadeInOut(float t, float power)
{
  float s = -1.0 * pow((t-0.5)/(0.5),power)+1.0;
  s = clamp(s,0.0,1.0);
  return s;
}

//2x pi ... don't think too much about it
float TAU = 6.28;

void main() {
  // Calculate the progression value based on the animation direction.
  // If opening, use uProgress as-is; if closing, invert the progression.
  float progress = uForOpening ? 1.0 - uProgress : uProgress ;

  // scale progress ... the first half of the animation
  float scalep = remap(
    progress,
    //0.0,clamp(uWT + 0.1,0.0,1.0),
    // 0.0,0.6,
    0.0,uWT+0.1,
    0.0,1.0
    );

  // scalep = easeInOutSine(scalep);
  scalep = easeOutQuad(scalep);

 // sparkle progress ... the second half of the animation
  float sparkp = remap(
    progress,
    // clamp((1.0 - uWT) - 0.1,0.0,1.0),1.0,
    // 0.4,1.0,
    uWT-0.1,1.0,
    0.0,1.0
    );
  sparkp = easeInOutSine(sparkp);

  /*
  the window will scale between 0.0 and 0.6 (of the progress)
  the sparkle will bet between 0.4 and 1.0 (of the progress)
  ... so there is a tab bit of over lap
  */

  // // this is the offset of the window... don't let them go too far each way
  vec2 offset = vec2(uXpos,uYpos*-1.0) * 0.20;
  vec2 scaleOffset = mix(
    vec2(0.0),
    vec2(uXpos,uYpos*-1.0) * 0.50,
    scalep
    );

  //the UV for this function
  float aspect = uSize.x / uSize.y;
  vec2 uv = iTexCoord.st * vec2(aspect,1.0);
  
  //get and adjust 
  vec2 uv2 = iTexCoord.st;
  uv2 = uv2 * 2.0 - 1.0;

  //offset 
  uv2 -= ( scaleOffset/ vec2(aspect,1.0) ) *scalep;

  //scale
  uv2 /= mix(1.0, 0.0, scalep);

  //rotation and if we are gonna rotate or not
  vec3 rot = vec3(0.0);
  if (uWinRot)
  {
    rot = hash32(uSeed);
    rot *= 2.0;
    rot -= 1.0;
    rot *= 0.1;
  }

  //rotate around x, y , and z
  uv2.x /= mix(1.0, rot.x * TAU * uv2.y, scalep);
  uv2.y /= mix(1.0, rot.y * TAU * uv2.x, scalep);
  uv2 = rotate(uv2,rot.z*TAU*scalep);
  
  //re-center
  uv2 = uv2 * 0.5 + 0.5;

  //gets the window
  vec4 oColor = getInputColor( uv2) ;

  //the sparksize will bet between 25.0 and 50.0
  float size = mix(25.0,50.0,uSparkleSize);

  //get the sparkle
  float sparkle = getSpark(
      uv,
      offset + vec2(0.5 * aspect,0.5),
      FadeInOut(sparkp,2) * uSparkleSize,
      FadeInOut(sparkp,2) * size,
      sparkp * TAU * float(uSparkleRot)
      );
  //fade out at the edges
  sparkle *= FadeInOut(iTexCoord.t,8);
  sparkle *= FadeInOut(iTexCoord.s,8);
  
  //set it to the results
  oColor = alphaOver(
    oColor,
    vec4(1.0,1.0,1.0,sparkle)
    );

  //output the color
  setOutputColor(oColor);
}