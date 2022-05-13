// Inject some common shader snippets. It is only possible to include glsl files from the
// "common" directory. Also, the files in the "common" directory are not allowed to
// include any further files.
#include "common/uniforms.glsl"
#include "common/noise.glsl"

uniform bool uAdditiveBlending;
uniform vec2 uSeed;
uniform float uScale;
uniform float uLineWidth;
uniform vec4 uGlowColor;
uniform vec4 uLineColor;

// This methods generates a procedural hexagonal pattern. It returns four values:
// result.xy: This contains cell-relative coordinates for the given point.
//            [0, 0] is in the center of a cell, [0, 1] at the upper edge,
//            [sqrt(4.0 / 3.0), 0] at the right tip and so on.
// result.z:  This is the distance to the closest edge. This is used for shrinking
//            of the tiles and the sharp overlay lines.
// result.w:  This is the distance to the closest cell center. This is used for
//            the glow effect.
vec4 getHexagons(vec2 p) {

  // Length of a cell's edge.
  const float edgeLength = sqrt(4.0 / 3.0);

  // The hexgrid repeats after this distance.
  const vec2 scale = vec2(3.0 * edgeLength, 2.0);

  // This is a repeating grid of scale-sized cells. Y-values are in the
  // interval [-1...1], X-value in [-1.5*edgeLength...1.5*edgeLength].
  vec2 a    = mod(p, scale) - scale * 0.5;
  vec2 aAbs = abs(a);

  // This is the same as above, but offset by half scale.
  vec2 b    = mod(p + scale * 0.5, scale) - scale * 0.5;
  vec2 bAbs = abs(b);

  // Distance to closer edge, diagonally or horizontally.
  // Once for cell set A and once for cell set B.
  float distA = max(aAbs.x / edgeLength + aAbs.y * 0.5, aAbs.y);
  float distB = max(bAbs.x / edgeLength + bAbs.y * 0.5, bAbs.y);

  // Minimum of both is distance to closest edge.
  float dist = 1.0 - min(distA, distB);

  // We use the radial distance to the center for glow.
  float glow = min(dot(a, a), dot(b, b)) / 1.5;

  // Take cell-relative coordinates from the closer cell.
  vec2 cellCoords = distA < distB ? a : b;

  return vec4(cellCoords, dist, glow);
}