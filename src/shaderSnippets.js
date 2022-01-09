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

// These noise algorithms are based on implementations by Inigo Quilez which are
// available under the MIT License.
// https://www.shadertoy.com/view/lsf3WH
// https://www.shadertoy.com/view/4sfGzS
// https://www.shadertoy.com/view/Xsl3Dl
// https://www.shadertoy.com/view/Msf3WH
function noise() {
  return `

  vec2 hash2D(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
  }

  vec3 hash3D(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7,  74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));

    return fract(sin(p) * 43758.5453123);
  }

  float hash(vec2 p) {
    p = floor(p);
    p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
    return fract(p.x * p.y * (p.x + p.y));
  }

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1) * 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
  
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(mix(hash(i + vec2(0.0, 0.0)),
                   hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)),
                   hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);

    f = f * f * (3.0 - 2.0 * f);
	
    return mix(mix(mix(hash(i+vec3(0, 0 ,0)),
                       hash(i+vec3(1, 0 ,0)), f.x),
                   mix(hash(i+vec3(0, 1 ,0)),
                       hash(i+vec3(1, 1 ,0)), f.x), f.y),
               mix(mix(hash(i+vec3(0, 0 ,1)),
                       hash(i+vec3(1, 0 ,1)), f.x),
                   mix(hash(i+vec3(0, 1 ,1)),
                       hash(i+vec3(1, 1 ,1)), f.x),f.y), f.z);
  }

  float noise2D(vec2 p, int octaves) {
    mat2 m = mat2( 1.6, 1.2,
                  -1.2, 1.6);

    float f  = 0;
    
    for (int i=1; i<=octaves; ++i) {
      f += noise2D(p) / pow(2, i);
      p = m * p;
    }
  
    return f;
  }

  float noise3D(vec3 p, int octaves) {
    const mat3 m = mat3( 0.00,  0.80,  0.60,
                        -0.80,  0.36, -0.48,
                        -0.60, -0.48,  0.64);
    float f  = 0;
    
    for (int i=1; i<=octaves; ++i) {
      f += noise3D(p) / pow(2, i);
      p = m * p * 2.01;
    }
  
    return f;
  }
  `;
}
