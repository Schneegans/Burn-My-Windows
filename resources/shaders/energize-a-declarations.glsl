// Inject some common shader snippets. It is only possible to include glsl files from the
// "common" directory. Also, the files in the "common" directory are not allowed to
// include any further files.
#include "common/uniforms.glsl"
#include "common/noise.glsl"
#include "common/edgeMask.glsl"
#include "common/easing.glsl"

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
  float edgeFade = getAbsoluteEdgeMask(EDGE_FADE_WIDTH);
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