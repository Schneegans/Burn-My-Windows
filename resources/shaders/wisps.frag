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

uniform vec2 uSeed;
uniform vec3 uColor;
uniform float uScale;

const float WISPS_RADIUS    = 20.0;
const float WISPS_SPEED     = 10.0;
const float WISPS_SPACING   = 40 + WISPS_RADIUS;
const int WISPS_LAYERS      = 8;
const float WISPS_IN_TIME   = 0.5;
const float WINDOW_OUT_TIME = 1.0;
const float SCALING         = 0.9;

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

void main() {
  float progress = uForOpening ? 1.0 - easeOutQuad(uProgress) : easeOutQuad(uProgress);

  // Scale down the window slightly.
  float scale = 1.0 / mix(1.0, SCALING, progress) - 1.0;
  vec2 coords = cogl_tex_coord_in[0].st * (scale + 1.0) - scale * 0.5;

  // Get the color of the window.
  cogl_color_out = texture2D(uTexture, coords);

  // Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
  if (cogl_color_out.a > 0) {
    cogl_color_out.rgb /= cogl_color_out.a;
  }

  // Compute several layers of moving wisps.
  vec2 uv = (cogl_tex_coord_in[0].st - 0.5) / mix(1.0, 0.5, progress) + 0.5;
  uv /= uScale;
  float wisps = 0;
  for (int i = 0; i < WISPS_LAYERS; ++i) {
    wisps += getWisps(uv * 0.3, WISPS_SPACING, uSeed * (i + 1));
  }

  // Compute shrinking edge mask.
  float mask = getRelativeEdgeMask(mix(0.01, 0.5, progress));

  // Compute three different progress values.
  float wispsIn = smoothstep(0, 1, clamp(progress / WISPS_IN_TIME, 0, 1));
  float wispsOut =
    smoothstep(0, 1, clamp((progress - WISPS_IN_TIME) / (1.0 - WISPS_IN_TIME), 0, 1));
  float windowOut = smoothstep(0, 1, clamp(progress / WINDOW_OUT_TIME, 0, 1));

  // Use a noise function to dissolve the window.
  float noise = smoothstep(1.0, 0.0, abs(2.0 * simplex2DFractal(uv * uSize / 250) - 1.0));
  float windowMask = 1.0 - (windowOut < 0.5 ? mix(0.0, noise, windowOut * 2.0)
                                            : mix(noise, 1.0, windowOut * 2.0 - 1.0));
  cogl_color_out.a *= windowMask * mask;

  // Add the wisps.
  vec4 wispColor = wisps * vec4(uColor, min(wispsIn, 1.0 - wispsOut) * mask);
  cogl_color_out = alphaOver(cogl_color_out, wispColor);

  // These are pretty useful for understanding how this works.
  // cogl_color_out = vec4(vec3(windowMask), 1.0);
  // cogl_color_out = vec4(vec3(wisps), 1.0);
  // cogl_color_out = vec4(vec3(noise), 1.0);
  // cogl_color_out = vec4(vec3(mask*min(wispsIn, 1.0 - wispsOut)), 1.0);
}