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

uniform sampler2D uDustTexture;
uniform vec4 uDustColor;
uniform vec2 uSeed;
uniform float uDustScale;

const float DUST_LAYERS      = 4.0;
const float GROW_INTENSITY   = 0.05;
const float SHRINK_INTENSITY = 0.05;
const float WIND_INTENSITY   = 0.05;
const float ACTOR_SCALE      = 1.2;
const float PADDING          = ACTOR_SCALE / 2.0 - 0.5;

void main() {
  // We simply inverse the progress for opening windows.
  float progress = uForOpening ? uProgress : 1.0 - uProgress;

  float gradient = iTexCoord.t * ACTOR_SCALE - PADDING;
  progress       = 2.0 - gradient - 2.0 * progress;
  progress       = progress + 0.25 - 0.5 * simplex2D((iTexCoord.st + uSeed) * 2.0);
  progress       = pow(max(0.0, progress), 2.0);

  vec4 oColor = vec4(0.0);

  for (float i = 0.0; i < DUST_LAYERS; ++i) {

    // Create a random direction.
    float factor   = DUST_LAYERS == 1.0 ? 0.0 : i / (DUST_LAYERS - 1.0);
    float angle    = 123.123 * (uSeed.x + factor);
    vec2 direction = vec2(1.0, 0.0);
    direction      = rotate(direction, angle);

    // Flip direction for one side of the window.
    vec2 coords = iTexCoord.st * ACTOR_SCALE - PADDING - 0.5;
    if (getWinding(direction, coords) > 0.0) {
      direction *= -1.0;
    }

    // Flip direction for half the layers.
    if (factor > 0.5) {
      direction *= -1.0;
    }

    // We grow the layer along the random direction, shrink it orthogonally to it
    // and scale it up slightly.
    float dist = distToLine(vec2(0.0), direction, coords);
    vec2 grow  = direction * dist * mix(0.0, GROW_INTENSITY, progress);
    vec2 shrink =
      vec2(direction.y, -direction.x) * dist * mix(0.0, SHRINK_INTENSITY, progress);
    float scale = mix(1.0, 1.05, factor * progress);
    coords      = (coords + grow + shrink) / scale;

    // Add some wind.
    coords.x += WIND_INTENSITY * progress * (uForOpening ? 1.0 : -1.0);

    // Now check wether there is actually something in the current dust layer at
    // the coords position.
    vec2 dustCoords = (coords + uSeed) * uSize / uDustScale / 100.0;
    vec2 dustMap    = texture2D(uDustTexture, dustCoords).rg;
    float dustGroup = floor(dustMap.g * DUST_LAYERS * 0.999);

    if (dustGroup == i) {

      // Get the window color.
      vec4 windowColor = getInputColor(coords + 0.5);

      // Fade the window color to uDustColor.
      vec3 dustColor  = mix(windowColor.rgb, uDustColor.rgb, uDustColor.a);
      windowColor.rgb = mix(windowColor.rgb, dustColor, progress);

      // Dissolve and blend the layers.
      if (dustMap.x - progress > 0.0) {
        oColor = windowColor;
      }
    }
  }

  // This may help you to understand how this effect works.
  // oColor = vec4(progress, 0, 0, 0);

  setOutputColor(oColor);
}
