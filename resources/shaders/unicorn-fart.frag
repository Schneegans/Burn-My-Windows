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

//variables
uniform float uSparkCount; //number of sparkles
uniform vec2  uSparkStartEnd; // the start and end of the sparkles
uniform float uSparkOffset; //how much the sparkles can be offset 
uniform float uStarCount; //number of Stars
uniform float uStarRot; // how much the stars rotate
uniform float uStarSize; // the size of the stars
uniform vec2  uStarStartEnd; //start and end of the star's movement
uniform float uBlurQuality; // blurquality for the window
uniform float uSeed; // a random number


//particle colors
uniform vec4 uSparkColor0; 
uniform vec4 uSparkColor1; 
uniform vec4 uSparkColor2; 
uniform vec4 uSparkColor3; 
uniform vec4 uSparkColor4; 
uniform vec4 uSparkColor5; 

//star colors
uniform vec4 uStarColor0; 
uniform vec4 uStarColor1; 
uniform vec4 uStarColor2; 
uniform vec4 uStarColor3; 
uniform vec4 uStarColor4; 
uniform vec4 uStarColor5; 


// Define a constant for 2 * PI (tau), which represents a full circle in radians.
const float PI = 3.14159265359;
const float tau = 6.28318530718;

//helps to find the angle
vec3 getPosByAngle(float angle)
{
    return vec3(cos(angle), sin(angle), 0);
}

//this returns the Spark
float getSpark(vec2 uv,vec2 center, float brightness, float size, float rotation)
{

  //the size 
  size = clamp(size,0.001,1.0);

  uv = (uv + vec2(0.5)) ; //set center 
  uv = (uv - center) ;//Center UV coordinates, then scale to fit the star size
  
  //scale 
  uv = uv * 2.0 -1.0;
  uv /= mix(vec2(1.0,1.0), vec2(0.0,0.0), vec2(1.0 - size));
  uv = uv * 0.5 + 0.5;
  
  uv = rotate(uv, rotation, vec2(0.5));


  //the brightness of the spark
  brightness = clamp(brightness,0.001,1.0);
  float bn = mix(0.0,0.07,brightness); //recalculate size
  

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


//this was lifted from aura-glow
float getMask(float t)
{

    // Calculate the aspect ratio of the render area
    float aspect = uSize.x / uSize.y;
    
    //standard uv
    vec2 uv = iTexCoord.st;

    // tuv is for when progress is near 0
    vec2 tuv = uv;
    tuv -= 0.5; // Shift UV coordinates to center (from [-0.5 to 0.5])
    tuv.x *= aspect; // Scale x-coordinate to match aspect ratio
    tuv += 0.5; // Shift UV coordinates back (from [0 to 1])
    
    //mixing the UVs
    uv = mix(tuv,uv,t);

    // this controls the shape 
    // -1.0 would be a diamond-ish
    // 0.0 would be a rounded diamond
    // 1.0 would be a circle
    // 2.0  will be sqircle
    // 1000.0 will be very square
    float p = mix(1.0,1000.0,
        easeInExpo(t)
        );

    //this will be used later to make a mask
    float m = mix(
        0.0,
        1.0,
        clamp(
            pow(abs(uv.x-0.5)*2.0,p) + pow(abs(uv.y-0.5)*2.0,p),0.0,1.0
        )
        );

    //this is the mask
    //float mask = (m > t) ? 0.0 : 1.0 ;
    float mask = (m > t) ? (1.0 - (m - t)) : 1.0 ;
    mask = clamp(mask,0.0,1.0);

    return mask;
}


// A simple blur function
vec4 blur(vec2 uv, float radius, float samples) {
  // Initialize the color accumulator to zero.
  vec4 color = vec4(0.0);

  

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


//returns the Spark's color
vec4 getSparkColors(float v, float alpha) {
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
    colors[0] = uSparkColor0 ;
    colors[1] = uSparkColor1 ;
    colors[2] = uSparkColor2 ;
    colors[3] = uSparkColor3 ;
    colors[4] = uSparkColor4 ;
    colors[5] = uSparkColor5 ;

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



vec4 getSparks(float t)
{


  //the UV for this function
  float aspect = uSize.x / uSize.y;
  vec2 uv = iTexCoord.st * vec2(aspect,1.0);

  vec4 result = vec4(0.0);

  //for each spark
  for (float i = 0.0; i < uSparkCount ; ++i)
  {
    //random values
    vec4 v4 = hash41( i * uSeed);

    //the X and Y position ... at the end
    vec3 pos = getPosByAngle( (i/uSparkCount) * tau + (v4.x * 0.3) );

    //the distance the spark will travel
    float d = mix(0.33,0.34,v4.z) ;
    d = mix(
      uSparkStartEnd.x + (v4.z * uSparkOffset),
      uSparkStartEnd.y - (v4.y * uSparkOffset),
      (1.0  - t)
      );

    float s = getSpark(
      uv,
      vec2(0.5 * aspect,0.5) + ( pos.xy * d  ), //position (x, y)
      FadeInOut(t,8.0) * 0.9 ,//Brightness
      FadeInOut(t,8.0) * (v4.w * 0.5) ,//Size  
      0.0  //rotation
      );

    
    //set the color
    vec4 c = getSparkColors( hash11(v4.w) ,1.0);
    s = clamp(s*2.0,0.0,1.0);
    c.rgb *= s;
    c.a *= s;

    result += c ;

  }

  //make it bright
  result.a =  pow(result.a,2.0);

  //fade at endges
  result.a *= FadeInOut(iTexCoord.s,4.0);
  result.a *= FadeInOut(iTexCoord.t,4.0);

  return clamp(result,vec4(0.0),vec4(1.0));
  // return result;

}





vec4 getStarColors(float v, float alpha) {
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
    colors[0] = uStarColor0 ;
    colors[1] = uStarColor1 ;
    colors[2] = uStarColor2 ;
    colors[3] = uStarColor3 ;
    colors[4] = uStarColor4 ;
    colors[5] = uStarColor5 ;

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




//gets the mask of a Star
float getStar(vec2 uv, vec2 center, float npoints, float radiusRatio, float size, float rotation)
{

    float radiusMax = 1.0;
    float radiusMin = radiusMax * radiusRatio;

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


//convert the XY to angle
float XYtoAngle(vec2 XY)
{
  return atan(XY.y, XY.x);  
}


vec4 getStars(float t)
{

  //the UV for this function
  float aspect = uSize.x / uSize.y;
  vec2 uv = iTexCoord.st * vec2(aspect,1.0);

  // float result = 0.0;
  vec4 result = vec4(0.0);

  //loop for each star
  for (float i = 0.0; i < uStarCount ; ++i)
  {
    //random values for this star
    vec4 v4 = hash41( i * uSeed);

    //the X and Y position ... at the end
    vec3 pos = getPosByAngle( (i/uStarCount) * tau + (uStarRot * tau * t) );

    //the distance the spark will travel
    float d = mix(0.33,0.34,v4.z) ;
    d = mix(
      uStarStartEnd.x ,
      uStarStartEnd.y ,
      (1.0  - t)
      );

    
    float s = getStar(
      uv,
      vec2(0.5 * aspect,0.5) + ( pos.xy * d  ), //position (x, y)
      5.0, //npoints
      0.5, //Ratio
      FadeInOut(t,4.0) * uStarSize,//Size  
      PI  //rotation
      );


    s *= FadeInOut(iTexCoord.s,4.0);
    s *= FadeInOut(iTexCoord.t,4.0);
    s = clamp(s,0.0,1.0);
    
    //the color is based on it's starting location
    vec4 color = getStarColors( i/uStarCount ,1.0);
    result += vec4(color.rgb * s,s * color.a);

  }


  return result;
  
}



void main() {
  // Calculate the progression value based on the animation direction.
  // If opening, use uProgress as-is; if closing, invert the progression.
  float progress = uForOpening ? 1.0 - uProgress : uProgress ;

  //zero to one... mostly one
  float ztomo = remap(
    progress,
    0.0,0.1,
    0.0,1.0
  );
  ztomo = easeInOutSine(ztomo);

  //progress variants
  // float oExpo = easeOutExpo(progress);
  // float iExpo = easeInExpo(progress);
  // float oQuad = easeOutQuad(progress);
  float ioCubic = easeInOutCubic(progress);
  float ioSine = easeInOutSine(progress);
  
  vec2 uv = iTexCoord.st;
  //center
  uv = uv * 2.0 - 1.0;
  //scale
  uv /= mix(vec2(0.5,0.5), vec2(0.0,0.0), ioCubic);
  // scale from center
  uv = uv * 0.5 + 0.5;

  //get blured version of the window
  vec4 oColor =  blur(uv, ioCubic * 200.0,uBlurQuality);

  oColor.a *= (1.0 - ioSine);

  //get and apply sparks
  if (uSparkCount > 0)
  {
    vec4 sparks = getSparks(ioSine);
    oColor = alphaOver(oColor, sparks);
  }

  //get and apply stars
  if (uStarCount > 0 )
  {
    oColor = alphaOver(oColor, getStars(mix(0.0001,0.999,ioSine)));
  }

  //output
  setOutputColor(oColor);
}