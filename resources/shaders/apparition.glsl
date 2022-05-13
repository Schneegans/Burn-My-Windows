// Inject some common shader snippets. It is only possible to include glsl files from the
// "common" directory. Also, the files in the "common" directory are not allowed to
// include any further files.
#include "common/uniforms.glsl"

uniform vec2 uSeed;
uniform float uShake;
uniform float uTwirl;
uniform float uSuction;
uniform float uRandomness;

const float ACTOR_SCALE = 2.0;
const float PADDING     = ACTOR_SCALE / 2.0 - 0.5;

// The math for the whirling is inspired by this post:
// http://www.geeks3d.com/20110428/shader-library-swirl-post-processing-filter-in-glsl
void main() {
  // We simply inverse the progress for opening windows.
  float progress = uForOpening ? 1.0 - uProgress : uProgress;

  // Choose a random suction center.
  vec2 center = uSeed * uRandomness + 0.5 * (1.0 - uRandomness);
  vec2 coords = cogl_tex_coord_in[0].st * ACTOR_SCALE - PADDING - center;

  // Add some shaking.
  coords.x +=
    progress * 0.05 * uShake * sin((progress + uSeed.x) * (1.0 + uSeed.x) * uShake);
  coords.y +=
    progress * 0.05 * uShake * cos((progress + uSeed.y) * (1.0 + uSeed.y) * uShake);

  // "Suck" the texture into the center.
  float dist = length(coords) / sqrt(2);
  coords += progress * coords / dist * 0.5 * uSuction;

  // Apply some whirling.
  float angle = pow(1.0 - dist, 2.0) * uTwirl * progress;
  float s     = sin(angle);
  float c     = cos(angle);
  coords      = vec2(dot(coords, vec2(c, -s)), dot(coords, vec2(s, c)));

  // Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
  cogl_color_out = texture2D(uTexture, coords + center);
  if (cogl_color_out.a > 0) {
    cogl_color_out.rgb /= cogl_color_out.a;
  }

  // Fade out the window texture.
  cogl_color_out.a *= 1.0 - progress;
}