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

'use strict';

//////////////////////////////////////////////////////////////////////////////////////////
// These functions return strings which can be injected to GLSL shader code.            //
//////////////////////////////////////////////////////////////////////////////////////////

// These should be included in every shader.
// uTexture:    Contains the texture of the window.
// uProgress:   A value which transitions from 0 to 1 during the entire animation.
// uTime:       A steadily increasing value in seconds.
// uSizeX:      The horizontal size of uTexture in pixels.
// uSizeY:      The vertical size of uTexture in pixels.
function standardUniforms() {
  return `
  uniform sampler2D uTexture;
  uniform float     uProgress;
  uniform float     uTime;
  uniform int       uSizeX;
  uniform int       uSizeY;
  `;
}

// This simplex noise algorithm is based on an implementation by Inigo Quilez which is
// available under the MIT License (Copyright © 2013 Inigo Quilez).
// https://www.shadertoy.com/view/Msf3WH.
function noise() {
  return `
  vec2 rand(vec2 p) { 
    p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
    return fract(sin(p)*43758.5453123);
  }

  float noiseImpl(vec2 p) {
    const float K1 = 0.366025404; // (sqrt(3)-1)/2;
    const float K2 = 0.211324865; // (3-sqrt(3))/6;
    
    vec2  i = floor(p + (p.x + p.y) * K1);
    vec2  a = p - i + (i.x + i.y) * K2;
    float m = step(a.y, a.x); 
    vec2  o = vec2(m, 1.0-m);
    vec2  b = a - o + K2;
    vec2  c = a - 1.0 + 2.0*K2;
    vec3  h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
    vec3  n = h * h * h * h * vec3(dot(a, -1.0 + 2.0 * rand(i + 0.0)),
                                   dot(b, -1.0 + 2.0 * rand(i + o)),
                                   dot(c, -1.0 + 2.0 * rand(i + 1.0)));
    return dot(n, vec3(70.0)) * 0.5 + 0.5;
  }

  float noise(vec2 p) {
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    float f = 0.5000 * noiseImpl(p); p = m*p;
    f      += 0.2500 * noiseImpl(p); p = m*p;
    f      += 0.1250 * noiseImpl(p); p = m*p;
    f      += 0.0625 * noiseImpl(p); p = m*p;

    return f;
  }
  `;
}
