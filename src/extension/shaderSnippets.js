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

// This method requires the uniforms from standardUniforms() to be available.
// It returns two values: The first is an alpha value which can be used for the window
// texture. This gradually dissolves the window from top to bottom. The second can be used
// to mask any effect, it will be most opaque where the window is currently fading and
// gradually dissolve to zero over time.
// hideTime:      A value in [0..1]. It determines the percentage of the animation which
//                is spent for hiding the window. 1-hideTime will be spent thereafter for
//                dissolving the effect mask.
// fadeWidth:     The relative size of the window-hiding gradient in [0..1].
// edgeFadeWidth: The pixel width of the effect fading range at the edges of the window.
function effectMask() {
  return `
  vec2 effectMask(float hideTime, float fadeWidth, float edgeFadeWidth) {
    float burnProgress      = clamp(uProgress/hideTime, 0, 1);
    float afterBurnProgress = clamp((uProgress-hideTime)/(1-hideTime), 0, 1);

    // Gradient from top to bottom.
    float t = cogl_tex_coord_in[0].t * (1 - fadeWidth);

    // Visible part of the window. Gradually dissolves towards the bottom.
    float windowMask = 1 - clamp((burnProgress - t) / fadeWidth, 0, 1);

    // Gradient from top burning window.
    float effectMask = clamp(t*(1-windowMask)/burnProgress, 0, 1);

    // Fade-out when the window burned down.
    if (uProgress > hideTime) {
      effectMask *= mix(1, 1-t, afterBurnProgress) * pow(1-afterBurnProgress, 2);
    }

    // Fade at window borders.
    vec2 pos = cogl_tex_coord_in[0].st * vec2(uSizeX, uSizeY);
    effectMask *= clamp(pos.x / edgeFadeWidth, 0, 1);
    effectMask *= clamp(pos.y / edgeFadeWidth, 0, 1);
    effectMask *= clamp((uSizeX - pos.x) / edgeFadeWidth, 0, 1);
    effectMask *= clamp((uSizeY - pos.y) / edgeFadeWidth, 0, 1);

    return vec2(windowMask, effectMask);
  }
  `;
}