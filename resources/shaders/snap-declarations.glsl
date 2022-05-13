// Inject some common shader snippets. It is only possible to include glsl files from the
// "common" directory. Also, the files in the "common" directory are not allowed to
// include any further files.
#include "common/uniforms.glsl"
#include "common/noise.glsl"
#include "common/math2D.glsl"

uniform sampler2D uDustTexture;
uniform vec4 uDustColor;
uniform vec2 uSeed;
uniform float uDustScale;

const float DUST_LAYERS      = 4;
const float GROW_INTENSITY   = 0.05;
const float SHRINK_INTENSITY = 0.05;
const float WIND_INTENSITY   = 0.05;
const float ACTOR_SCALE      = 1.2;
const float PADDING          = ACTOR_SCALE / 2.0 - 0.5;