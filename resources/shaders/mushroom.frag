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

// use 8BitStyle or not (sliding scale)
uniform float uScaleStyle;

// these are for the sparks
uniform float uSparkCount;
uniform vec4 uSparkColor;
uniform float uSparkRotation;

// these are for the Rays
uniform vec4 uRaysColor;

// these are for the stars
uniform float uRingCount;
uniform float uRingRotation;
uniform float uStarCount;

// and the colors they change over time
uniform vec4 uStarColor0;
uniform vec4 uStarColor1;
uniform vec4 uStarColor2;
uniform vec4 uStarColor3;
uniform vec4 uStarColor4;
uniform vec4 uStarColor5;

// seed
uniform vec2 uSeed;

// helps to find the angle
vec3 getPosByAngle(float angle) { return vec3(cos(angle), sin(angle), 0); }

// gets the mask of a Star
float getStar(vec2 uv, vec2 center, float npoints, float radiusRatio, float size,
              float rotation) {

  float radiusMax = 1.0;
  float radiusMin = radiusMax * radiusRatio;

  float PI        = 3.1415926;
  float starangle = 2.0 * PI / npoints;  // Angle between points on the star

  // Offset rotation to ensure one point is always up when rotation = 0
  rotation += PI / 2.0 - starangle / 1.0;

  // Define the positions for the outer and inner points of the star's initial angle,
  // rotated by `rotation`
  vec3 p0 =
    (radiusMax * size) * getPosByAngle(rotation);  // Outer point, rotated by `rotation`
  vec3 p1 = (radiusMin * size) *
            getPosByAngle(starangle + rotation);  // Inner point, also rotated

  // Calculate the position of the current fragment relative to the star's center
  vec2 curPosuv =
    (uv - center);  // Center UV coordinates, then scale to fit the star size
  float curRadius = length(curPosuv);  // Radius from center, no need to scale further
  float curPosAngle =
    atan(curPosuv.y, curPosuv.x) - rotation;  // Calculate angle and adjust by `rotation`

  // Determine the fractional position within the current star segment
  float a =
    fract(curPosAngle / starangle);  // Fractional angle position within one segment
  if (a >= 0.5)
    a = 1.0 - a;  // Ensure we are within the first half of the segment (symmetry)

  // Calculate the current point on the star segment, applying rotation
  a           = a * starangle;  // Actual angle for this position on the segment
  vec3 curPos = curRadius * getPosByAngle(a + rotation);  // Final position, rotated

  // Calculate directions for edge detection using cross product
  vec3 dir0 = p1 - p0;      // Vector from outer to inner point
  vec3 dir1 = curPos - p0;  // Vector from outer point to current position

  // Use cross product to determine if `curPos` is inside the star's edge
  return step(0.0,
              cross(dir0, dir1).z);  // Returns 1.0 if inside, 0.0 if outside (solid edge)
}

// use to scale the window
vec2 scaleUV(vec2 uv, vec2 scale) {
  // Put texture coordinate origin to center of window.
  uv = uv * 2.0 - 1.0;

  // scale
  uv /= mix(vec2(1.0, 1.0), vec2(0.0, 0.0), scale);

  // scale from center
  uv = uv * 0.5 + 0.5;

  return uv;
}

// this returns the Spark
float getSpark(vec2 uv, vec2 center, float brightness, float size, float rotation) {
  brightness = clamp(brightness, 0.001, 1.0);
  size       = clamp(size, 0.001, 1.0);
  float bn   = mix(0.0, 0.07, brightness);  // recalculate size

  uv = (uv + vec2(0.5));
  uv = (uv - center);  // Center UV coordinates, then scale to fit the star size
  uv = scaleUV(uv, vec2(1.0 - size));
  uv = rotate(uv, rotation, vec2(0.5));  // rotate the UV

  // this is basically the brightness
  float p = mix(-1.0, 1000.0, easeInExpo(bn));

  float m =
    mix(0.0, 1.0,
        clamp(pow(abs(uv.x - 0.5) * 2.0, p) + pow(abs(uv.y - 0.5) * 2.0, p), 0.0, 1.0));

  float mask = easeInSine(1.0 - (m - bn)) - 0.004;
  mask       = clamp(mask, 0.0, 1.0);

  return mask;
}

// returns the star's color
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
float zeroStartEnd(float t, float max_size, float power) {
  float s = -1.0 * pow((t - 0.5) / (0.5), power) + 1.0;
  s       = clamp(s, 0.0, 1.0) * max_size;
  return s;
}

// this gives us the jerky 8bit growth effect.
float eightBitScale(float progress) {
  float scale = 1.0;
  if (progress <= 0.1) {
    scale = 0.25;
  } else if (progress <= 0.2) {
    scale = 0.5;
  } else if (progress <= 0.3) {
    scale = 0.25;
  } else if (progress <= 0.4) {
    scale = 0.5;
  } else if (progress <= 0.5) {
    scale = 0.25;
  } else if (progress <= 0.6) {
    scale = 0.5;
  } else if (progress <= 0.7) {
    scale = 1.0;
  } else if (progress <= 0.8) {
    scale = 0.25;
  } else if (progress <= 0.9) {
    scale = 0.5;
  }
  return scale;
}

// gets all the sparks
vec4 getSparks(float progress) {
  // the UV for this function
  float aspect = uSize.x / uSize.y;
  vec2 uv      = iTexCoord.st * vec2(aspect, 1.0);

  // this will be the result to return
  vec4 result = vec4(0.0);

  // 0 at the edges
  float xEdge = -1.0 * pow((uv.x - (aspect * 0.5)) / (aspect * 0.5), 8.0) + 1.0;
  xEdge       = clamp(xEdge, 0.0, 1.0);

  // declare some variables before the loop
  vec2 h  = vec2(0.0);
  float y = 0.0;
  float x = 0.0;

  // loop for each spart
  for (float xusp = 0.0; xusp < uSparkCount; ++xusp) {
    // calculate some variables
    h = hash21(xusp + uSeed.x);
    y = mix(0.0 - h.y, 1.0 + (1.0 - h.y), progress);
    y = clamp(y, 0.0, 1.0);

    x = 0.66 * sin(h.x * 6.28);
    x += 0.5 * aspect;

    // here we get the mask for the spark
    float a4ps = getSpark(uv, vec2(x, y),                          // position (x, y)
                          zeroStartEnd(y, 1.0, 4.0) * xEdge,       // Brightness
                          zeroStartEnd(y, 0.5, 4.0) * xEdge,       // Size
                          progress * 6.28 * float(uSparkRotation)  // rotation
    );

    // set it to the results
    result = alphaOver(
      result, vec4(uSparkColor.r, uSparkColor.g, uSparkColor.b, uSparkColor.a * a4ps));
  }

  // and we are returning the result
  return result;
}

// gets the Rays
vec4 getRays(float progress) {
  // create the UV for it
  vec2 rayUV = iTexCoord.st;
  rayUV *= vec2(10.0, 0.5);
  rayUV.y += progress * -1.0;
  rayUV.x += uSeed.y;

  // gets the ray
  float ray = simplex2D(rayUV);
  // 0 around the edges
  ray *= zeroStartEnd(iTexCoord.t, 1.0, 8.0);
  ray *= zeroStartEnd(iTexCoord.s, 1.0, 8.0);
  // 0 at the begining and end of the animation
  ray *= zeroStartEnd(progress, 1.0, 8.0);

  // adjust the numbers and clamp
  ray = remap(ray * 1.10, 0.0, 1.0, -5.0, 1.0);

  float alpha = clamp(uRaysColor.a * ray, 0.0, 1.0);

  // return
  return vec4(uRaysColor.r, uRaysColor.g, uRaysColor.b, alpha);
}

// returns the stars
vec4 getStars(vec2 starUV, float aspect, float progress, float oColorAlpha) {
  // this will be the result to return
  vec4 result = vec4(0.0);

  vec2 h  = vec2(0.0);
  float y = 0.0;

  // for each ring
  for (float r = 0.0; r < uRingCount; ++r) {

    float spread = r * (1.0 / uRingCount);
    y            = mix(0.0 - spread, 1.0 + (1.0 - spread), 1.0 - progress);
    y            = clamp(y, 0.00001, 0.99999);

    // each star in each ring
    for (float s = 0.0; s < uStarCount; ++s) {

      // this returns a Star

      float a5ps =
        getStar(starUV,
                vec2(sin(progress * uRingRotation * 6.28 + (s * (6.28 / uStarCount))) *
                       aspect * 0.33,
                     y),                    // position (x, y)
                5.0,                        // nPoints
                0.5,                        // radiusRatio
                zeroStartEnd(y, 0.1, 2.0),  // Size
                0.0                         // rotation
        );
      a5ps = clamp(a5ps, 0.0, 1.0);

      // //put the star in back or the front of the window
      float depth = cos(progress * uRingRotation * 6.28 + (s * (6.28 / uStarCount)));

      // if we want the star behind or infront of the window

      if (depth < 0.0) {
        result = alphaOver(result, getStarColor(y, a5ps));
      } else {
        result = alphaOver(getStarColor(y, a5ps) * (1.0 - oColorAlpha), result);
      }
    }
  }

  // and we are returning the result
  return result;
}

void main() {

  // Calculate the animation progress, flipping direction if opening
  // 'uProgress' varies from 0 to 1, depending on the animation phase
  float progress = uForOpening ? 1.0 - uProgress : uProgress;

  // Initialize the output color to fully transparent black
  vec4 oColor = vec4(0.0, 0.0, 0.0, 0.0);

  // get scales
  float scale8bit = eightBitScale(progress);
  vec2 scaleV2    = vec2(easeInOutSine(progress), easeInQuad(progress));

  vec2 fscale = mix(vec2(scale8bit), scaleV2, uScaleStyle);

  // Fetch the color based on the scaled texture coordinates
  oColor = getInputColor(scaleUV(iTexCoord.st, fscale));

  // Store the alpha value of the fetched color for later use
  float oColorAlpha = oColor.a;

  // Calculate the aspect ratio of the render area
  float aspect = uSize.x / uSize.y;

  // Transform UV coordinates for star effects
  // starUV.x [-0.5 , 0.5]
  // starUV.y [1.0 , 0.0]
  vec2 starUV = vec2(iTexCoord.s - 0.5, 1.0 - iTexCoord.t) * vec2(aspect, 1.0);

  // If four-point stars are enabled, overlay them on the current color
  if (uSparkCount > 0.0) {
    oColor = alphaOver(oColor, getSparks(progress));
  }

  // If rays are enabled, overlay them on the current color
  if (uRaysColor.a > 0.0) {
    oColor = alphaOver(oColor, getRays(progress));
  }

  // If five-point stars are enabled, overlay them using stored alpha
  if (uRingCount > 0.0 && uStarCount > 0.0) {
    oColor = alphaOver(oColor, getStars(starUV, aspect, progress, oColorAlpha));
  }

  // Set the final output color to the computed value
  setOutputColor(oColor);
}
