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

// The content from common.glsl is automatically prepended to each shader effect.

uniform sampler2D uAshTexture;
uniform vec2 uSeed;
// uniform vec3 uColor;
uniform float uScale;
// uniform float uWidth;
uniform float uTurbulence;

const float BURN_TIME  = 0.5;
const float FIRE_WIDTH = 0.03;
const float ASH_WIDTH  = 0.5;
const float ASH_LAYERS = 4;

vec4 getFireColor(float v) {
  const float steps[4] = float[](0.0, 0.33, 0.66, 1.0);
  vec4 colors[4] =
    vec4[](vec4(1, 0, 0, 0), vec4(1, 0, 0, 0.5), vec4(1, 1, 0, 1), vec4(1, 0, 0, 0));

  if (v < steps[0]) {
    return colors[0];
  }

  for (int i = 0; i < 3; ++i) {
    if (v <= steps[i + 1]) {
      float blend = smoothstep(0, 1, (v - steps[i]) / (steps[i + 1] - steps[i]));
      return mix(colors[i], colors[i + 1], vec4(blend));
    }
  }

  return colors[3];
}

void main() {
  // Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
  vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);
  if (windowColor.a > 0) {
    windowColor.rgb /= windowColor.a;
  }

  cogl_color_out = windowColor;

  vec2 uv = cogl_tex_coord_in[0].st * uSize / uScale;

  float lfNoise = simplex2D(uv / max(uSize.x, uSize.y) + uSeed);
  float hfNoise = simplex2DFractal(uv * 0.01 + uSeed);

  float noise = (lfNoise + hfNoise * uTurbulence * 0.5) / (1.0 + uTurbulence * 0.5);

  float burnProgress =
    (uForOpening ? 1.0 - uProgress / BURN_TIME : uProgress / BURN_TIME);

  vec2 fireRange = vec2(burnProgress - FIRE_WIDTH, burnProgress + FIRE_WIDTH);

  if (uForOpening) {

    // Hide window.
    if (noise < fireRange.x) {
      cogl_color_out.a = 0.0;
    }

  } else {

    // Draw ash particles if the window is closed.
    vec2 ashRange = vec2(burnProgress - ASH_WIDTH, burnProgress);

    float ash = clamp(1.0 - (noise - ashRange.x) / (ashRange.y - ashRange.x), 0, 1);
    // vec4 ashColor  = vec4(0, 0, 0, 0);
    // cogl_color_out = mix(cogl_color_out, ashColor, ash);

    // for (float i = 0; i < ASH_LAYERS; ++i) {

    //   float factor = ASH_LAYERS == 1 ? 0 : i / (ASH_LAYERS - 1);

    // Now check wether there is actually something in the current ash layer at
    // the coords position.
    vec2 ashMap = texture2D(uAshTexture, uv * 0.005).rg;
    // float ashGroup = floor(ashMap.g * ASH_LAYERS * 0.999);

    // if (ashGroup == i) {

    // Get the window color.
    // vec4 windowColor = texture2D(uTexture, coords + 0.5);

    // // Shell.GLSLEffect uses straight alpha. So we have to convert from
    // premultiplied. if (windowColor.a > 0) {
    //   windowColor.rgb /= windowColor.a;
    // }

    // Dissolve and blend the layers.
    if (ashMap.x - ash < 0) {
      cogl_color_out.a = 0;
    }
    // }
    // }
  }

  // Add fire.
  if (fireRange.x < noise && noise < fireRange.y) {
    float fire = 1.0 - (noise - fireRange.x) / (fireRange.y - fireRange.x);
    fire *= cogl_color_out.a;
    cogl_color_out = alphaOver(cogl_color_out, getFireColor(fire));
  }

  // Add smoke.
  vec2 smokeRange = uForOpening ? vec2(fireRange.y, 1.0) : vec2(0.0, fireRange.x);
  if (smokeRange.x < noise && noise < smokeRange.y) {
    float smoke = (noise - smokeRange.x) / (smokeRange.y - smokeRange.x);

    if (!uForOpening) {
      smoke = 1 - smoke;
    }

    vec2 smokeShift = vec2(0, smoke * noise * uTime);
    smoke *= simplex2DFractal(uv * 0.01 + uSeed + smokeShift);
    smoke *= getRelativeEdgeMask(0.3);

    float fadeOutProgress = clamp((uProgress - BURN_TIME) / (1.0 - BURN_TIME), 0, 1);
    smoke *= 1 - fadeOutProgress;

    cogl_color_out = alphaOver(cogl_color_out, vec4(vec3(0.2), smoke));
  }
}