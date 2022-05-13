// Inject some common shader snippets. It is only possible to include glsl files from the
// "common" directory. Also, the files in the "common" directory are not allowed to
// include any further files.
#include "common/uniforms.glsl"

uniform sampler2D uShardTexture;
uniform vec2 uSeed;
uniform vec2 uEpicenter;
uniform float uShardScale;
uniform float uBlowForce;
uniform float uGravity;

const float SHARD_LAYERS = 5;
const float ACTOR_SCALE  = 2.0;
const float PADDING      = ACTOR_SCALE / 2.0 - 0.5;