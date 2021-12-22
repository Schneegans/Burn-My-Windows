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

// The noise implementation is from https://www.shadertoy.com/view/3tcBzH (CC-BY-NC-SA).
function noise() {
  return `
  float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }

  vec2 rand2(vec2 co) {
    return vec2(rand(co), rand(co + vec2(12.9898,78.233)));
  }

  float hermite(float t) {
    return t * t * (3.0 - 2.0 * t);
  }

  float noiseImpl(vec2 co, float frequency) {
    vec2 v = vec2(co.x * frequency, co.y * frequency);

    float ix1 = floor(v.x);
    float iy1 = floor(v.y);
    float ix2 = floor(v.x + 1.0);
    float iy2 = floor(v.y + 1.0);

    float fx = hermite(fract(v.x));
    float fy = hermite(fract(v.y));

    float fade1 = mix(rand(vec2(ix1, iy1)), rand(vec2(ix2, iy1)), fx);
    float fade2 = mix(rand(vec2(ix1, iy2)), rand(vec2(ix2, iy2)), fx);

    return mix(fade1, fade2, fy);
  }

  float perlinNoise(vec2 co, float freq, int steps, float persistence) {
    float value = 0.0;
    float ampl = 1.0;
    float sum = 0.0;

    for(int i=0 ; i<steps ; i++) {
      sum += ampl;
      value += noiseImpl(co, freq) * ampl;
      freq *= 2.0;
      ampl *= persistence;
    }

    return value / sum;
  }
  `;
}
