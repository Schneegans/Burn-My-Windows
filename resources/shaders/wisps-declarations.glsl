// Inject some common shader snippets. It is only possible to include glsl files from the
// "common" directory. Also, the files in the "common" directory are not allowed to
// include any further files.
#include "common/uniforms.glsl"
#include "common/noise.glsl"
#include "common/edgeMask.glsl"
#include "common/compositing.glsl"

uniform vec2 uSeed;
uniform vec3 uColor;
uniform float uScale;

const float WISPS_RADIUS    = 20.0;
const float WISPS_SPEED     = 10.0;
const float WISPS_SPACING   = 40 + WISPS_RADIUS;
const int WISPS_LAYERS      = 8;
const float WISPS_IN_TIME   = 0.5;
const float WINDOW_OUT_TIME = 1.0;

// Returns a grid of randomly moving points. Each grid cell contains one point which
// moves on an ellipse.
float getWisps(vec2 texCoords, float gridSize, vec2 seed) {

  // Shift coordinates by a random offset and make sure the have a 1:1 aspect ratio.
  vec2 coords = (texCoords + hash22(seed)) * uSize;

  // Apply global scale.
  coords /= gridSize;

  // Get grid cell coordinates in [0..1].
  vec2 cellUV = mod(coords, vec2(1));

  // This is unique for each cell.
  vec2 cellID = coords - cellUV + vec2(362.456);

  // Add random rotation, scale and offset to each grid cell.
  float speed = mix(10.0, 15.0, hash12(cellID * seed * 134.451)) / gridSize * WISPS_SPEED;
  float rotation  = mix(0.0, 6.283, hash12(cellID * seed * 54.4129));
  float radius    = mix(0.5, 1.0, hash12(cellID * seed * 19.1249)) * WISPS_RADIUS;
  float roundness = mix(-1.0, 1.0, hash12(cellID * seed * 7.51949));

  vec2 offset = vec2(sin(speed * (uTime + 1)) * roundness, cos(speed * (uTime + 1)));
  offset *= 0.5 - 0.5 * radius / gridSize;
  offset = vec2(offset.x * cos(rotation) - offset.y * sin(rotation),
                offset.x * sin(rotation) + offset.y * cos(rotation));

  cellUV += offset;

  // Use distance to center of shifted / rotated UV coordinates to draw a glaring point.
  float dist = length(cellUV - 0.5) * gridSize / radius;
  if (dist < 1.0) {
    return min(5, 0.01 / pow(dist, 2.0));
  }

  return 0.0;
}