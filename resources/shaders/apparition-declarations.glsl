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