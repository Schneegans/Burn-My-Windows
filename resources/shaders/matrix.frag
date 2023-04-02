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

uniform sampler2D uFontTexture;
uniform vec3 uTrailColor;
uniform vec3 uTipColor;
uniform float uLetterSize;
uniform float uRandomness;
uniform float uOverShoot;

// These may be configurable in the future.
const float EDGE_FADE             = 30.0;
const float FADE_WIDTH            = 150.0;
const float TRAIL_LENGTH          = 0.2;
const float FINAL_FADE_START_TIME = 0.8;
const float LETTER_TILES          = 16.0;
const float LETTER_FLICKER_SPEED  = 2.0;

// This returns a flickering grid of random letters.
float getText(vec2 fragCoord) {
  vec2 pixelCoords = fragCoord * uSize;
  vec2 uv          = mod(pixelCoords.xy, uLetterSize) / uLetterSize;
  vec2 block       = pixelCoords / uLetterSize - uv;

  // Choose random letter.
  uv += floor(hash22(floor(hash22(block) * vec2(12.9898, 78.233) +
                           LETTER_FLICKER_SPEED * uProgress * uDuration + 42.254)) *
              LETTER_TILES);

  return texture2D(uFontTexture, uv / LETTER_TILES).r;
}

// This returns two values: The first are gradients for the "raindrops" which move
// from top to bottom. This is used for fading the letters. The second value is set
// to one below each drop and to zero above it. This second value is used for fading
// the window texture.
vec2 getRain(vec2 fragCoord) {
  float column = iTexCoord.x * uSize.x;
  column -= mod(column, uLetterSize);

  float delay = fract(sin(column) * 78.233) * mix(0.0, 1.0, uRandomness);
  float speed = fract(cos(column) * 12.989) * mix(0.0, 0.3, uRandomness) + 1.5;

  float distToDrop = (uProgress * 2.0 - delay) * speed - iTexCoord.y;

  float rainAlpha   = distToDrop >= 0.0 ? exp(-distToDrop / TRAIL_LENGTH) : 0.0;
  float windowAlpha = 1.0 - clamp(uSize.y * distToDrop, 0.0, FADE_WIDTH) / FADE_WIDTH;

  // Fade at window borders.
  rainAlpha *= getAbsoluteEdgeMask(EDGE_FADE, 0.5);

  // Add some variation to the drop start and end position.
  float shorten =
    fract(sin(column + 42.0) * 33.423) * mix(0.0, uOverShoot * 0.25, uRandomness);
  rainAlpha *= smoothstep(0.0, 1.0, clamp(iTexCoord.y / shorten, 0.0, 1.0));
  rainAlpha *= smoothstep(0.0, 1.0, clamp((1.0 - iTexCoord.y) / shorten, 0.0, 1.0));

  if (uForOpening) {
    windowAlpha = 1.0 - windowAlpha;
  }

  return vec2(rainAlpha, windowAlpha);
}

void main() {
  vec2 coords = iTexCoord.st;
  coords.y    = coords.y * (uOverShoot + 1.0) - uOverShoot * 0.5;

  // Get a cool matrix effect. See comments for those methods above.
  vec2 rainMask  = getRain(coords);
  float textMask = getText(coords);

  // Get the window texture.
  vec4 oColor = getInputColor(coords);

  // Fade the window according to the effect mask.
  oColor.a *= rainMask.y;

  // This is used to fade out the remaining trails in the end.
  float finalFade =
    1.0 -
    clamp((uProgress - FINAL_FADE_START_TIME) / (1.0 - FINAL_FADE_START_TIME), 0.0, 1.0);
  float rainAlpha = finalFade * rainMask.x;

  // Add the matrix effect to the window.
  vec4 text = vec4(mix(uTrailColor, uTipColor, min(1.0, pow(rainAlpha + 0.1, 4.0))),
                   rainAlpha * textMask);
  oColor    = alphaOver(oColor, text);

  // These are pretty useful for understanding how this works.
  // oColor = vec4(vec3(textMask), 1);
  // oColor = vec4(vec3(rainMask.x), 1);
  // oColor = vec4(vec3(rainMask.y), 1);

  setOutputColor(oColor);
}
