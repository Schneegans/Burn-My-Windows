// Inject some common shader snippets. It is only possible to include glsl files from the
// "common" directory. Also, the files in the "common" directory are not allowed to
// include any further files.
#include "common/uniforms.glsl"
#include "common/noise.glsl"
#include "common/compositing.glsl"

// See assets/README.md for how this texture was created.
uniform sampler2D uClawTexture;
uniform vec4 uFlashColor;
uniform vec2 uSeed;
uniform float uClawSize;
uniform float uNumClaws;
uniform float uWarpIntensity;

const float FLASH_INTENSITY = 0.1;
const float MAX_SPAWN_TIME =
  0.6;  // Scratches will only start in the first half of the animation.
const float FF_TIME = 0.6;  // Relative time for the final fade to transparency.

// This method generates a grid of randomly rotated, slightly shifted and scaled
// UV squares. It returns the texture coords of the UV square at the given actor
// coordinates. If these do not fall into one of the UV grids, the coordinates of
// the closest UV grid will be clamped and returned.
vec2 getClawUV(vec2 texCoords, float gridScale, vec2 seed) {

  // Shift coordinates by a random offset and make sure the have a 1:1 aspect ratio.
  vec2 coords = texCoords + hash22(seed);
  coords *= uSize.x < uSize.y ? vec2(1.0, 1.0 * uSize.y / uSize.x)
                              : vec2(1.0 * uSize.x / uSize.y, 1.0);

  // Apply global scale.
  coords *= gridScale;

  // Get grid cell coordinates in [0..1].
  vec2 cellUV = mod(coords, vec2(1));

  // This is unique for each cell.
  vec2 cellID = coords - cellUV + vec2(362.456);

  // Add random rotation, scale and offset to each grid cell.
  float scale    = mix(0.8, 1.0, hash12(cellID * seed * 134.451));
  float offsetX  = mix(0.0, 1.0 - scale, hash12(cellID * seed * 54.4129));
  float offsetY  = mix(0.0, 1.0 - scale, hash12(cellID * seed * 25.3089));
  float rotation = mix(0.0, 2.0 * 3.141, hash12(cellID * seed * 2.99837));

  cellUV -= vec2(offsetX, offsetY);
  cellUV /= scale;

  cellUV -= 0.5;
  cellUV = vec2(cellUV.x * cos(rotation) - cellUV.y * sin(rotation),
                cellUV.x * sin(rotation) + cellUV.y * cos(rotation));
  cellUV += 0.5;

  // Clamp resulting coordinates.
  return clamp(cellUV, vec2(0), vec2(1));
}