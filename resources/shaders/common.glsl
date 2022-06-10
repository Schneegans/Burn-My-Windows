//////////////////////////////////////////////////////////////////////////////////////////
//          )                                                   (                       //
//       ( /(   (  (               )    (       (  (  (         )\ )    (  (            //
//       )\()) ))\ )(   (         (     )\ )    )\))( )\  (    (()/( (  )\))(  (        //
//      ((_)\ /((_|()\  )\ )      )\  '(()/(   ((_)()((_) )\ )  ((_)))\((_)()\ )\       //
//      | |(_|_))( ((_)_(_/(    _((_))  )(_))  _(()((_|_)_(_/(  _| |((_)(()((_|(_)      //
//      | '_ \ || | '_| ' \))  | '  \()| || |  \ V  V / | ' \)) _` / _ \ V  V (_-<      //
//      |_.__/\_,_|_| |_||_|   |_|_|_|  \_, |   \_/\_/|_|_||_|\__,_\___/\_/\_//__/      //
//                                 |__/                                                 //
//                       Copyright (c) 2021 Simon Schneegans                            //
//          Released under the GPLv3 or later. See LICENSE file for details.            //
//////////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////////
// This file is automatically included in each shader.                                  //
//////////////////////////////////////////////////////////////////////////////////////////

// --------------------------------------------------------------------- standard uniforms

// Each shader can access these standard input values:

// vec2  iTexCoord:   Texture coordinates for retrieving the window input color.
// bool  uForOpening: True if a window-open animation is ongoing, false otherwise.
// float uProgress:   A value which transitions from 0 to 1 during the animation.
// float uDuration:   The duration of the current animation in seconds.
// vec2  uSize:       The size of uTexture in pixels.
// float uPadding:    The empty area around the actual window (e.g. where the shadow
//                    is drawn). For now, this will only be set on GNOME.

// Furthermore, there are two global methods for reading the window input color and
// setting the shader output color. Both methods assume straight alpha:

// vec4 getInputColor(vec2 coords)
// void setOutputColor(vec4 outColor)

#if defined(KWIN)  // --------------------------------------------------------------------

uniform float forOpening;
uniform sampler2D sampler;
uniform float uDuration;
uniform float textureWidth;
uniform float textureHeight;
uniform float animationProgress;

vec2 uSize       = vec2(textureWidth, textureHeight);
bool uForOpening = forOpening == 1.0;

in vec2 texcoord0;
out vec4 fragColor;

#define uProgress animationProgress
#define uPadding 0.0
#define iTexCoord texcoord0

vec4 getInputColor(vec2 coords) {
  vec4 color = texture2D(sampler, coords);

  if (color.a > 0.0) {
    color.rgb /= color.a;
  }

  return color;
}

void setOutputColor(vec4 outColor) {
  fragColor = vec4(outColor.rgb * outColor.a, outColor.a);
}

#elif defined(KWIN_LEGACY)  // -----------------------------------------------------------

uniform float forOpening;
uniform sampler2D sampler;
uniform float uDuration;
uniform float textureWidth;
uniform float textureHeight;
uniform float animationProgress;

vec2 uSize       = vec2(textureWidth, textureHeight);
bool uForOpening = forOpening == 1.0;

varying vec2 texcoord0;

#define uProgress animationProgress
#define uPadding 0.0
#define iTexCoord texcoord0

vec4 getInputColor(vec2 coords) {
  vec4 color = texture2D(sampler, coords);

  if (color.a > 0.0) {
    color.rgb /= color.a;
  }

  return color;
}

void setOutputColor(vec4 outColor) {
  gl_FragColor = vec4(outColor.rgb * outColor.a, outColor.a);
}

#else  // GNOME --------------------------------------------------------------------------

// On GNOME, the uniforms are just normal uniforms.
uniform bool uForOpening;
uniform sampler2D uTexture;
uniform float uProgress;
uniform float uDuration;
uniform vec2 uSize;
uniform float uPadding;

// On GNOME, we set iTexCoord to be an alias for the cogl variables.
#define iTexCoord cogl_tex_coord_in[0]

// Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
vec4 getInputColor(vec2 coords) {
  vec4 color = texture2D(uTexture, coords);

  if (color.a > 0.0) {
    color.rgb /= color.a;
  }

  return color;
}

void setOutputColor(vec4 outColor) { cogl_color_out = outColor; }

#endif  // -------------------------------------------------------------------------------

// ----------------------------------------------------------------- compositing operators

// The Shell.GLSLEffect uses straight alpha blending. This helper method allows
// compositing color values in the shader in the same way.
vec4 alphaOver(vec4 under, vec4 over) {
  float alpha = over.a + under.a * (1.0 - over.a);
  return vec4((over.rgb * over.a + under.rgb * under.a * (1.0 - over.a)) / alpha, alpha);
}

// ---------------------------------------------------------------------- easing functions

// Here are some basic easing function. More can be added if required!
// Taken from here:
// https://gitlab.gnome.org/GNOME/mutter/-/blob/main/clutter/clutter/clutter-easing.c

float easeOutQuad(float x) { return -1.0 * x * (x - 2.0); }

// --------------------------------------------------------------------- edge mask helpers

// This method returns a mask which smoothly transitions towards zero when approaching
// the window's borders. There is a variant which takes the transition area width in
// pixels and one which takes this as a percentage.
float getEdgeMask(vec2 uv, vec2 maxUV, float fadeWidth) {
  float mask = 1.0;
  mask *= smoothstep(0.0, 1.0, clamp(uv.x / fadeWidth, 0.0, 1.0));
  mask *= smoothstep(0.0, 1.0, clamp(uv.y / fadeWidth, 0.0, 1.0));
  mask *= smoothstep(0.0, 1.0, clamp((maxUV.x - uv.x) / fadeWidth, 0.0, 1.0));
  mask *= smoothstep(0.0, 1.0, clamp((maxUV.y - uv.y) / fadeWidth, 0.0, 1.0));

  return mask;
}

// Returns an edge mask which fades to zero at the boundaries of the actor. The width of
// the fade zone is given in pixels. This uses the standard uniforms uSize and uPadding.
// This means that the fading zone is not actually at the actors boundaries but at the
// position of the window border in the texture.
// The offset paramter controls whether the fading is placed inside the window borders
// (offset = 0), ontop the window borders (offset = 0.5) or outside the window borders
// (offset = 1).
float getAbsoluteEdgeMask(float fadePixels, float offset) {
  float padding = max(0.0, uPadding - fadePixels * offset);
  vec2 uv       = iTexCoord.st * uSize - padding;
  return getEdgeMask(uv, uSize - 2.0 * padding, fadePixels);
}

// Returns an edge mask which fades to zero at the boundaries of the actor. The width of
// the fade zone is given relative to the actor size. This neither uses uSize and
// uPadding.
float getRelativeEdgeMask(float fadeAmount) {
  vec2 uv = iTexCoord.st;
  return getEdgeMask(uv, vec2(1.0), fadeAmount);
}

// ------------------------------------------------------------------------------- 2D math

float distToLine(vec2 origin, vec2 direction, vec2 point) {
  vec2 perpendicular = vec2(direction.y, -direction.x);
  return abs(dot(normalize(perpendicular), origin - point));
}

float getWinding(vec2 a, vec2 b) { return cross(vec3(a, 0.0), vec3(b, 0.0)).z; }

vec2 rotate(vec2 a, float angle) {
  return vec2(a.x * cos(angle) - a.y * sin(angle), a.x * sin(angle) + a.y * cos(angle));
}

// --------------------------------------------------------------------------------- noise

// These noise algorithms are based on implementations by various authors from
// shadertoy.com, which are all available under the MIT License. See the respective links
// in the comments below.

// Hash functions
// MIT License, https://www.shadertoy.com/view/4djSRW
// Copyright (c) 2014 David Hoskins.

// 1 out, 1 in...
float hash11(float p) {
  p = fract(p * .1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

// 1 out, 2 in...
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 1 out, 3 in...
float hash13(vec3 p3) {
  p3 = fract(p3 * .1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

// 2 out, 1 in...
vec2 hash21(float p) {
  vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// 2 out, 2 in...
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// 2 out, 3 in...
vec2 hash23(vec3 p3) {
  p3 = fract(p3 * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// 3 out, 1 in...
vec3 hash31(float p) {
  vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

// 3 out, 2 in...
vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

// 3 out, 3 in...
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

// 4 out, 1 in...
vec4 hash41(float p) {
  vec4 p4 = fract(vec4(p) * vec4(.1031, .1030, .0973, .1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

// 4 out, 2 in...
vec4 hash42(vec2 p) {
  vec4 p4 = fract(vec4(p.xyxy) * vec4(.1031, .1030, .0973, .1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

// 4 out, 3 in...
vec4 hash43(vec3 p) {
  vec4 p4 = fract(vec4(p.xyzx) * vec4(.1031, .1030, .0973, .1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

// 4 out, 4 in...
vec4 hash44(vec4 p4) {
  p4 = fract(p4 * vec4(.1031, .1030, .0973, .1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

// 2D Simplex Noise
// MIT License, https://www.shadertoy.com/view/Msf3WH
// Copyright © 2013 Inigo Quilez
float simplex2D(vec2 p) {
  const float K1 = 0.366025404;  // (sqrt(3)-1)/2;
  const float K2 = 0.211324865;  // (3-sqrt(3))/6;

  vec2 i  = floor(p + (p.x + p.y) * K1);
  vec2 a  = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o  = vec2(m, 1.0 - m);
  vec2 b  = a - o + K2;
  vec2 c  = a - 1.0 + 2.0 * K2;
  vec3 h  = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n  = h * h * h * h *
           vec3(dot(a, -1.0 + 2.0 * hash22(i + 0.0)), dot(b, -1.0 + 2.0 * hash22(i + o)),
                dot(c, -1.0 + 2.0 * hash22(i + 1.0)));
  return 0.5 + 0.5 * dot(n, vec3(70.0));
}

float simplex2DFractal(vec2 p) {
  mat2 m  = mat2(1.6, 1.2, -1.2, 1.6);
  float f = 0.5000 * simplex2D(p);
  p       = m * p;
  f += 0.2500 * simplex2D(p);
  p = m * p;
  f += 0.1250 * simplex2D(p);
  p = m * p;
  f += 0.0625 * simplex2D(p);
  p = m * p;

  return f;
}

// 3D Simplex Noise
// MIT License, https://www.shadertoy.com/view/XsX3zB
// Copyright © 2013 Nikita Miropolskiy
float simplex3D(vec3 p) {

  // skew constants for 3D simplex functions
  const float F3 = 0.3333333;
  const float G3 = 0.1666667;

  // 1. find current tetrahedron T and it's four vertices
  // s, s+i1, s+i2, s+1.0 - absolute skewed (integer) coordinates of T vertices
  // x, x1, x2, x3 - unskewed coordinates of p relative to each of T vertice

  // calculate s and x
  vec3 s = floor(p + dot(p, vec3(F3)));
  vec3 x = p - s + dot(s, vec3(G3));

  // calculate i1 and i2
  vec3 e  = step(vec3(0.0), x - x.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);

  // x1, x2, x3
  vec3 x1 = x - i1 + G3;
  vec3 x2 = x - i2 + 2.0 * G3;
  vec3 x3 = x - 1.0 + 3.0 * G3;

  // 2. find four surflets and store them in d
  vec4 w, d;

  // calculate surflet weights
  w.x = dot(x, x);
  w.y = dot(x1, x1);
  w.z = dot(x2, x2);
  w.w = dot(x3, x3);

  // w fades from 0.6 at the center of the surflet to 0.0 at the margin
  w = max(0.6 - w, 0.0);

  // calculate surflet components
  d.x = dot(-0.5 + hash33(s), x);
  d.y = dot(-0.5 + hash33(s + i1), x1);
  d.z = dot(-0.5 + hash33(s + i2), x2);
  d.w = dot(-0.5 + hash33(s + 1.0), x3);

  // multiply d by w^4
  w *= w;
  w *= w;
  d *= w;

  // 3. return the sum of the four surflets
  return dot(d, vec4(52.0)) * 0.5 + 0.5;
}

// Directional artifacts can be reduced by rotating each octave
float simplex3DFractal(vec3 m) {

  // const matrices for 3D rotation
  const mat3 rot1 = mat3(-0.37, 0.36, 0.85, -0.14, -0.93, 0.34, 0.92, 0.01, 0.4);
  const mat3 rot2 = mat3(-0.55, -0.39, 0.74, 0.33, -0.91, -0.24, 0.77, 0.12, 0.63);
  const mat3 rot3 = mat3(-0.71, 0.52, -0.47, -0.08, -0.72, -0.68, -0.7, -0.45, 0.56);

  return 0.5333333 * simplex3D(m * rot1) + 0.2666667 * simplex3D(2.0 * m * rot2) +
         0.1333333 * simplex3D(4.0 * m * rot3) + 0.0666667 * simplex3D(8.0 * m);
}
