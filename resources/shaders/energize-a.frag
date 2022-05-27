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

uniform vec3 uColor;
uniform float uScale;

const float FADE_IN_TIME    = 0.3;
const float FADE_OUT_TIME   = 0.6;
const float HEART_FADE_TIME = 0.3;
const float EDGE_FADE_WIDTH = 50;

// This method returns two values:
//  result.x: A mask for the particles.
//  result.y: The opacity of the fading window.
vec2 getMasks(float progress) {
  float fadeInProgress  = clamp(progress / FADE_IN_TIME, 0, 1);
  float fadeOutProgress = clamp((progress - FADE_IN_TIME) / FADE_OUT_TIME, 0, 1);
  float heartProgress =
    clamp((progress - (1.0 - HEART_FADE_TIME)) / HEART_FADE_TIME, 0, 1);

  // Compute mask for the "atom" particles.
  float dist     = length(cogl_tex_coord_in[0].st - 0.5) * 4.0;
  float atomMask = smoothstep(0.0, 1.0, (fadeInProgress * 2.0 - dist + 1.0));
  atomMask *= fadeInProgress;
  atomMask *= smoothstep(1.0, 0.0, fadeOutProgress);

  // Fade-out the masks at the window edges.
  float edgeFade = getAbsoluteEdgeMask(EDGE_FADE_WIDTH, 0.5);
  atomMask *= edgeFade;

  float heartMask = getRelativeEdgeMask(0.5);
  heartMask       = 3.0 * pow(heartMask, 5);
  heartMask *= fadeOutProgress;
  heartMask *= 1.0 - heartProgress;
  atomMask = clamp(heartMask + atomMask, 0, 1);

  // Compute fading window opacity.
  float windowMask = pow(1.0 - fadeOutProgress, 2.0);

  if (uForOpening) {
    windowMask = 1.0 - windowMask;
  }

  return vec2(atomMask, windowMask);
}

void main() {
  float progress = easeOutQuad(uProgress);

  vec2 masks       = getMasks(progress);
  vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);

  // Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
  if (windowColor.a > 0) {
    windowColor.rgb /= windowColor.a;
  }

  // Dissolve window to effect color / transparency.
  cogl_color_out.rgb = mix(uColor, windowColor.rgb, 0.2 * masks.y + 0.8);
  cogl_color_out.a   = windowColor.a * masks.y;

  vec2 scaledUV = (cogl_tex_coord_in[0].st - 0.5) * (1.0 + 0.1 * progress);
  scaledUV /= uScale;

  // Add molecule particles.
  vec2 uv = scaledUV + vec2(0, 0.1 * uTime);
  uv *= 0.010598 * vec2(0.5 * uSize.x, uSize.y);
  float particles = 0.2 * pow((simplex3D(vec3(uv, 0.0 * uTime))), 3.0);

  // Add more molecule particles.
  for (int i = 1; i <= 3; ++i) {
    vec2 uv     = scaledUV * 0.12154 / pow(1.5, i) * uSize;
    float atoms = simplex3D(vec3(uv, 2.0 * uTime / i));
    particles += 0.5 * pow(0.2 * (1.0 / (1.0 - atoms) - 1.0), 2);
  }

  cogl_color_out.rgb += uColor * particles * masks.x;
  cogl_color_out.a += particles * masks.x;

  // These are pretty useful for understanding how this works.
  // cogl_color_out = vec4(masks, 0.0, 1.0);
  // cogl_color_out = vec4(vec3(masks.x), 1.0);
  // cogl_color_out = vec4(vec3(masks.y), 1.0);
  // cogl_color_out = vec4(vec3(particles), 1.0);
}