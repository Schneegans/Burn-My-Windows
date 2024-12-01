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

uniform bool u8BitStyle;

uniform bool uEnable4PStars;
uniform float u4PStars;
uniform vec4 u4PSColor;
uniform float u4PSRotation;

uniform bool uEnableRays;
uniform vec4 uRaysColor;

uniform bool uEnable5pStars;
uniform float uRings;
uniform float uRingRotation;
uniform float uStarPerRing;

uniform vec4 uStarColor0;
uniform vec4 uStarColor1;
uniform vec4 uStarColor2;
uniform vec4 uStarColor3;
uniform vec4 uStarColor4;
uniform vec4 uStarColor5;

vec3 getPosByAngle(float angle)
{
    return vec3(cos(angle), sin(angle), 0);
}


float getStar(vec2 uv, vec2 center, float npoints, float radiusRatio, float size, float rotation)
{

    float radiusMax = 1.0;
    float radiusMin = radiusMax * radiusRatio;

    float PI = 3.1415926;
    float starangle = 2.0 * PI / npoints; // Angle between points on the star

    // Offset rotation to ensure one point is always up when rotation = 0
    rotation += PI / 2.0 - starangle / 1.0;

    // Define the positions for the outer and inner points of the star's initial angle, rotated by `rotation`
    vec3 p0 = (radiusMax * size) * getPosByAngle(rotation);             // Outer point, rotated by `rotation`
    vec3 p1 = (radiusMin * size) * getPosByAngle(starangle + rotation);  // Inner point, also rotated

    // Calculate the position of the current fragment relative to the star's center
    vec2 curPosuv = (uv - center);      // Center UV coordinates, then scale to fit the star size
    float curRadius = length(curPosuv);         // Radius from center, no need to scale further
    float curPosAngle = atan(curPosuv.y, curPosuv.x) - rotation; // Calculate angle and adjust by `rotation`

    // Determine the fractional position within the current star segment
    float a = fract(curPosAngle / starangle); // Fractional angle position within one segment
    if (a >= 0.5)
        a = 1.0 - a; // Ensure we are within the first half of the segment (symmetry)

    // Calculate the current point on the star segment, applying rotation
    a = a * starangle;                          // Actual angle for this position on the segment
    vec3 curPos = curRadius * getPosByAngle(a + rotation); // Final position, rotated

    // Calculate directions for edge detection using cross product
    vec3 dir0 = p1 - p0;  // Vector from outer to inner point
    vec3 dir1 = curPos - p0; // Vector from outer point to current position

    // Use cross product to determine if `curPos` is inside the star's edge
    return step(0.0, cross(dir0, dir1).z); // Returns 1.0 if inside, 0.0 if outside (solid edge)
}


float getStarWithFade(vec2 uv, vec2 center, float npoints, float radiusRatio, float size, float rotation)
{
    float radiusMax = 1.0;
    float radiusMin = radiusMax * radiusRatio;
    
    float PI = 3.1415926;
    float starangle = 2.0 * PI / npoints; // Angle between points on the star

    // Offset rotation to ensure one point is always up when rotation = 0
    rotation += PI / 2.0 - starangle / 1.0;

    // Define the positions for the outer and inner points of the star's initial angle, rotated by `rotation`
    vec3 p0 = (radiusMax * size) * getPosByAngle(rotation);             // Outer point, rotated by `rotation`
    vec3 p1 = (radiusMin * size) * getPosByAngle(starangle + rotation);  // Inner point, also rotated

    // Calculate the position of the current fragment relative to the star's center
    vec2 curPosuv = (uv - center);      // Center UV coordinates, then scale to fit the star size
    float curRadius = length(curPosuv);         // Radius from center, no need to scale further
    float curPosAngle = atan(curPosuv.y, curPosuv.x) - rotation; // Calculate angle and adjust by `rotation`

    // Determine the fractional position within the current star segment
    float a = fract(curPosAngle / starangle); // Fractional angle position within one segment
    if (a >= 0.5)
        a = 1.0 - a; // Ensure we are within the first half of the segment (symmetry)

    // Calculate the current point on the star segment, applying rotation
    a = a * starangle;                          // Actual angle for this position on the segment
    vec3 curPos = curRadius * getPosByAngle(a + rotation); // Final position, rotated

    // Calculate directions for edge detection using cross product
    vec3 dir0 = p1 - p0;  // Vector from outer to inner point
    vec3 dir1 = curPos - p0; // Vector from outer point to current position
    
    float crossZ = dir0.x * dir1.y - dir0.y * dir1.x;
    
    float result = remap(
        crossZ,
        0.0,0.03,//0.0275,
        0.0,1.0 //hardness [1.0,100]
    );
    
    //brightness 
    result = result * 7.0;
    result = clamp(result,0.0,1.0);
    result = easeInSine(result);
    
    return result;
}


vec4 getStarColor(float v, float alpha) {
    // Clamp v to ensure it's in [0.0, 1.0]
    v = clamp(v, 0.0, 1.0);

    // Define steps for color interpolation
    float steps[6];
    steps[0] = 0.0;
    steps[1] = 0.1666;
    steps[2] = 0.3332;
    steps[3] = 0.4998;
    steps[4] = 0.6664;
    steps[5] = 0.8330;

    // Define color values
    vec4 colors[6];
    colors[0] = uStarColor0;
    colors[1] = uStarColor1;
    colors[2] = uStarColor2;
    colors[3] = uStarColor3;
    colors[4] = uStarColor4;
    colors[5] = uStarColor5;

    // Assign alpha values
    for (int i = 0; i < 6; ++i) {
        colors[i].a = alpha * colors[i].a;
    }

    // Handle edge cases
    if (v <= steps[0]) {
        return colors[0];
    }
    if (v >= steps[5]) {
        return colors[5];
    }

    // Find the correct interpolation segment
    for (int i = 0; i < 5; ++i) {
        if (v <= steps[i + 1]) {
            float t = (v - steps[i]) / (steps[i + 1] - steps[i]);
            return mix(colors[i], colors[i + 1], t);
        }
    }

    // Fallback (should never be reached)
    return vec4(0.0, 0.0, 0.0, 1.0);
}

float zeroStartEnd(float t, float max_size, float power)
{
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

  float s = -1.0 * pow((t-0.5)/(0.5),power)+1.0;
  s = clamp(s,0.0,1.0) * max_size;
  return s;

}

float eightBitScale(float progress)
{
    float scale = 1.0;
    if (progress <= 0.1)
    {
      scale = 0.25;
    }
    else if (progress <= 0.2)
    {
      scale = 0.5;
    }
    else if (progress <= 0.3)
    {
      scale = 0.25;
    }
    else if (progress <= 0.4)
    {
      scale = 0.5;
    }
    else if (progress <= 0.5)
    {
      scale = 0.25;
    }
    else if (progress <= 0.6)
    {
      scale = 0.5;
    }
    else if (progress <= 0.7)
    {
      scale = 1.0;
    }
    else if (progress <= 0.8)
    {
      scale = 0.25;
    }
    else if (progress <= 0.9)
    {
      scale = 0.5;
    }
    return scale;
}


vec2 scaleUV(vec2 uv, vec2 scale)
{
  // Put texture coordinate origin to center of window.
  uv = uv * 2.0 - 1.0;

  //scale
  uv /= mix(vec2(1.0,1.0), vec2(0.0,0.0), scale);

  // scale from center
  uv = uv * 0.5 + 0.5;

  return uv;
}



vec4 get4pStars(vec2 starUV, float progress)
{
  //this will be the result to return 
  vec4 result = vec4(0.0);

  vec2 h = vec2(0.0);
  float y = 0.0;

  for (float x = 0.0; x < u4PStars; ++x) 
  {
      h = hash21(x);
      y = mix( 0.0 - h.y , 1.0+(1.0-h.y) , (1.0 - progress));

      float a4ps = getStarWithFade(
        starUV, 
        vec2( sin(h.x * 6.28 ) * 0.66, y),      //position (x, y)
        4.0,                                    //nPoints
        0.33,                                   //radiusRatio
        zeroStartEnd(y,0.1 ,4.0),               //Size  
        progress * 6.28 * float(u4PSRotation)   //rotation
        );

      result = alphaOver(
        result,
        vec4(u4PSColor.r,u4PSColor.g,u4PSColor.b,u4PSColor.a * a4ps)
        );
  }

  // and we are returning the result
  return result;
}

vec4 getRays(float progress)
{
  vec2 rayUV = iTexCoord.st;
  rayUV *= vec2(10.0,0.5);
  rayUV.y += progress * -1.0;
  
  float ray = simplex2D(rayUV);
  ray *= zeroStartEnd(iTexCoord.t,1.0,8.0);
  ray *= zeroStartEnd(progress,1.0,8.0);


  ray = remap(
    ray * 1.10,
    0.0,1.0,
    -5.0,1.0
  );
  ray = clamp(ray,0.0,1.0);

  return vec4(uRaysColor.r,uRaysColor.g,uRaysColor.b,uRaysColor.a * ray);

}

vec4 get5PStars(vec2 starUV, float aspect, float progress, float oColorAlpha)
{
  //this will be the result to return 
  vec4 result = vec4(0.0);

  vec2 h = vec2(0.0);
  float y = 0.0;

  //for each ring
  for (float r = 0.0; r < uRings; ++r) 
  {
    
    float spread = r*(1.0/uRings);
    y = mix( 0.0 - spread , 1.0+(1.0-spread) , 1.0 - progress);
    y = clamp(y,0.00001,0.99999);

    //each star in each ring
    for (float s = 0.0; s < uStarPerRing; ++s) 
    {
      float a5ps = getStar(
        starUV, 
        vec2( sin(progress * uRingRotation * 6.28 + (s*(6.28/uStarPerRing))) * aspect * 0.33 , y),  //position (x, y)
        5.0,                                                                                            //nPoints
        0.5,                                                                                            //radiusRatio
        zeroStartEnd(y,0.1,2.0),                                                                        //Size   
        0.0                                                                                             //rotation
        );
      a5ps = clamp(a5ps,0.0,1.0);

      // //put the star in back or the front of the window 
      float depth = cos(progress * uRingRotation * 6.28 + (s*(6.28/uStarPerRing)) );
      if (depth < 0.0)
      {
        result = alphaOver(result,getStarColor(y,a5ps));
      }
      else
      {
        result = alphaOver(getStarColor(y,a5ps) * (1.0 - oColorAlpha),result);
      }
    }


  }

  // and we are returning the result
  return result;
}




void main() {


  float progress = uForOpening ? 1.0 - uProgress : uProgress;

  vec4 oColor = vec4(0.0,0.0,0.0,0.0);

  if (u8BitStyle)
  {
    float scale8bit = eightBitScale(progress);

    oColor = getInputColor(
      scaleUV(iTexCoord.st,vec2(scale8bit,scale8bit))
    );

  }
  else
  {

    //Scale 
    vec2 scaleV2 = vec2(easeInOutSine(progress),easeInQuad( progress ));

    oColor = getInputColor(
      scaleUV(iTexCoord.st,scaleV2)
    );
    float oColorAlpha = oColor.a; //saving this for later 


    float aspect = uSize.x / uSize.y;
    vec2 starUV = vec2(iTexCoord.s - 0.5,1.0 - iTexCoord.t) * vec2(aspect, 1.0);


    if (uEnable4PStars)
    {
      oColor = alphaOver(oColor,get4pStars(starUV,progress));
    }

    if (uEnableRays)
    {
      oColor = alphaOver(oColor,getRays(progress));
    }


    if (uEnable5pStars)
    {
      oColor = alphaOver(oColor,get5PStars(starUV,aspect,progress,oColorAlpha));
    }

  }



  
  setOutputColor(oColor);

  

}