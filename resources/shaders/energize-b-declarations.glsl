// Inject some common shader snippets. It is only possible to include glsl files from the
// "common" directory. Also, the files in the "common" directory are not allowed to
// include any further files.
#include "common/uniforms.glsl"
#include "common/noise.glsl"
#include "common/edgeMask.glsl"
#include "common/easing.glsl"

uniform vec3 uColor;
uniform float uScale;

const float SHOWER_TIME  = 0.3;
const float SHOWER_WIDTH = 0.3;
const float STREAK_TIME  = 0.6;
const float EDGE_FADE    = 50;

// This method returns four values:
//  result.x: A mask for the particles which lead the shower.
//  result.y: A mask for the streaks which follow the shower particles.
//  result.z: A mask for the final "atom" particles.
//  result.w: The opacity of the fading window.
vec4 getMasks(float progress) {
  float showerProgress = progress / SHOWER_TIME;
  float streakProgress = clamp((progress - SHOWER_TIME) / STREAK_TIME, 0, 1);
  float fadeProgress   = clamp((progress - SHOWER_TIME) / (1.0 - SHOWER_TIME), 0, 1);

  // Gradient from top to bottom.
  float t = cogl_tex_coord_in[0].t;

  // A smooth gradient which moves to the bottom within the showerProgress.
  float showerMask =
    smoothstep(1, 0, abs(showerProgress - t - SHOWER_WIDTH) / SHOWER_WIDTH);

  // This is 1 above the streak mask.
  float streakMask = (showerProgress - t - SHOWER_WIDTH) > 0 ? 1 : 0;

  // Compute mask for the "atom" particles.
  float atomMask = getRelativeEdgeMask(0.2);
  atomMask       = max(0, atomMask - showerMask);
  atomMask *= streakMask;
  atomMask *= sqrt(1 - fadeProgress * fadeProgress);

  // Make some particles visible in the streaks.
  showerMask += 0.05 * streakMask;

  // Add shower mask to streak mask.
  streakMask = max(streakMask, showerMask);

  // Fade-out the masks at the window edges.
  float edgeFade = getAbsoluteEdgeMask(EDGE_FADE);
  streakMask *= edgeFade;
  showerMask *= edgeFade;

  // Fade-out the masks from top to bottom.
  float fade = smoothstep(0.0, 1.0, 1.0 + t - 2.0 * streakProgress);
  streakMask *= fade;
  showerMask *= fade;

  // Compute fading window opacity.
  float windowMask = pow(1.0 - fadeProgress, 2.0);

  if (uForOpening) {
    windowMask = 1.0 - windowMask;
  }

  return vec4(showerMask, streakMask, atomMask, windowMask);
}