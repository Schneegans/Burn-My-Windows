//////////////////////////////////////////////////////////////////////////////////////////
//          )                                                   (                       //
//       ( /(   (  (               )    (       (  (  (         )\ )    (  (            //
//       )\()) ))\ )(   (         (     )\ )    )\))( )\  (    (()/( (  )\))(  (        //
//      ((_)\ /((_|()\  )\ )      )\  '(()/(   ((_)()((_) )\ )  ((_)))\((_)()\ )\       //
//      | |(_|_))( ((_)_(_/(    _((_))  )(_))  _(()((_|_)_(_/(  _| |((_)(()((_|(_)      //
//      | '_ \ || | '_| ' \))  | '  \()| || |  \ V  V / | ' \)) _` / _ \ V  V (_-<      //
//      |_.__/\_,_|_| |_||_|   |_|_|_|  \_, |   \_/\_/|_|_||_|\__,_\___/\_/\_//__/      //
//                                 |__/                                                 //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

// The content from common.glsl is automatically prepended to each shader effect.

// See assets/README.md for how this texture was created.
uniform sampler2D uClawTexture;
uniform vec4 uFlashColor;
uniform vec2 uSeed;
uniform float uClawSize;
uniform float uNumClaws;
uniform float uWarpIntensity;

const float FLASH_INTENSITY = 0.1;

// Scratches will only start in the first half of the animation.
const float MAX_SPAWN_TIME = 0.6;

// Relative time for the final fade to transparency.
const float FF_TIME = 0.6;

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
  vec2 cellUV = mod(coords, vec2(1.0));

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
  return clamp(cellUV, vec2(0.0), vec2(1.0));
}

void main() {
  float progress = uForOpening ? 1.0 - easeOutQuad(uProgress) : easeOutQuad(uProgress);

  // Warp the texture coordinates to create a blow-up effect.
  vec2 coords = iTexCoord.st * 2.0 - 1.0;
  float dist  = length(coords);
  coords      = (coords / dist * pow(dist, 1.0 + uWarpIntensity)) * 0.5 + 0.5;
  coords      = mix(iTexCoord.st, coords, progress);

  // Scale down the window according to the warp.
  float scale = 0.5 * uWarpIntensity * (1.0 - progress);
  coords      = coords * (scale + 1.0) - scale * 0.5;

  // Accumulate several random scratches. The color in the scratch map refers to the
  // relative time when the respective part will become invisible. Therefore we can
  // add a value to make the scratch appear later.
  float scratchMap = 1.0;
  for (float i = 0.0; i < uNumClaws; ++i) {
    vec2 uv     = getClawUV(coords, 1.0 / uClawSize, uSeed * (i + 1.0));
    float delay = i / uNumClaws * MAX_SPAWN_TIME;
    scratchMap  = min(scratchMap, clamp(texture2D(uClawTexture, uv).r + delay, 0.0, 1.0));
  }

  // Get the window texture. We shift the texture lookup by the local derivative of
  // the claw texture in order to mimic some folding distortion. This is only possible if
  // not using GLES.
  vec2 offset = vec2(0.0);

#ifndef GL_ES
  offset = vec2(dFdx(scratchMap), dFdy(scratchMap)) * progress * 0.5;
#endif

  vec4 oColor = getInputColor(coords + offset);

  // Add colorful flashes.
  float flashIntensity = 1.0 / FLASH_INTENSITY * (scratchMap - progress) + 1.0;
  if (flashIntensity < 0.0 || flashIntensity >= 1.0) {
    flashIntensity = 0.0;
  }

  // Hide flashes where there is now window.
  vec4 flash = uFlashColor;
  flash.a *= flashIntensity * oColor.a * (1.0 - progress);

  // Hide scratched out parts.
  oColor.a *= (scratchMap > progress ? 1.0 : 0.0);

  // Add flash color.
  oColor = alphaOver(oColor, flash);

  // Fade out the remaining shards.
  float fadeProgress = smoothstep(0.0, 1.0, (progress - 1.0 + FF_TIME) / FF_TIME);
  oColor.a *= sqrt(1.0 - fadeProgress * fadeProgress);

  // These are pretty useful for understanding how this works.
  // oColor = vec4(vec3(flashIntensity), 1);
  // oColor = vec4(vec3(scratchMap), 1);

  setOutputColor(oColor);
}
