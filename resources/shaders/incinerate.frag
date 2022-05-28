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

uniform vec2 uSeed;
uniform vec3 uColor;
uniform float uScale;
uniform float uWidth;
uniform float uTurbulence;

vec4 getFireColor(float v) {
  const float steps[3] = float[](0.0, 0.5, 1.0);
  vec4 colors[3]       = vec4[](vec4(1, 0, 0, 0), vec4(1, 0, 0, 0.5), vec4(1, 1, 0, 1));

  if (v < steps[0]) {
    return colors[0];
  }

  for (int i = 0; i < 2; ++i) {
    if (v <= steps[i + 1]) {
      return mix(colors[i], colors[i + 1],
                 vec4(v - steps[i]) / (steps[i + 1] - steps[i]));
    }
  }

  return colors[2];
}

void main() {
  float progress = uProgress / 0.8;

  progress = uForOpening ? 1.0 - progress : progress;

  vec2 uv = 0.01 * cogl_tex_coord_in[0].st * uSize / uScale;

  float lfNoise = simplex2D(cogl_tex_coord_in[0].st + uSeed);
  lfNoise       = mix(lfNoise - 1.0, lfNoise + 1.0, progress);

  float hfNoise = simplex2DFractal(uv + uSeed);
  hfNoise       = mix(hfNoise - 1.0, hfNoise + 1.0, progress);

  float noise = mix(lfNoise, hfNoise, uTurbulence);
  float fire  = noise / (0.03 * uWidth) - progress / (0.03 * uWidth) + progress;

  vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);

  // Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
  if (windowColor.a > 0) {
    windowColor.rgb /= windowColor.a;
  }

  cogl_color_out = windowColor;

  if (fire >= 1) {
    cogl_color_out.a = 0;
  } else if (fire > 0) {
    vec4 fire = getFireColor(fire);
    fire.a *= cogl_color_out.a;
    cogl_color_out = alphaOver(cogl_color_out, fire);
  }

  if ((uForOpening && fire < 0) || (!uForOpening && fire > 1)) {
    float smoke = (uForOpening ? -fire : fire - 1) * uWidth;

    vec2 uv         = 0.01 * cogl_tex_coord_in[0].st * uSize / uScale;
    vec2 smokeShift = vec2(0, smoke * 0.1);
    smoke           = clamp(smoke, 0, 1) * simplex2DFractal(uv + uSeed + smokeShift);

    smoke *= getRelativeEdgeMask(0.3);

    float fadeOutProgress = clamp((uProgress - 0.7) / 0.3, 0, 1);
    smoke *= 1 - fadeOutProgress;

    cogl_color_out = alphaOver(cogl_color_out, vec4(vec3(0.2), smoke));
  }

  //   if (cogl_tex_coord_in[0].s > 0.5) {
  //     cogl_color_out = vec4(vec3(noise), 1.0);
  //   }
}