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

// SPDX-FileCopyrightText: Ido Greenfeld <15867904+idogrf@users.noreply.github.com>
// SPDX-License-Identifier: GPL-3.0-or-later

// The content from common.glsl is automatically prepended to each shader effect.

uniform float uSlats;       // The number of slats.
uniform float uDelay;       // How much later the last slat starts than the first one.
uniform bool uPerspective;  // Whether the slats are drawn with perspective.

const float HALF_PI     = 1.5707963;
const float SHADE       = 0.55;  // How dark a slat gets when it is almost closed.
const float RIM         = 0.25;  // How bright the edges of an almost closed slat are.
const float SOFT        = 0.03;  // Softness of the slat edges in slat heights.
const float PERSPECTIVE = 0.2;   // How much narrower the far edge of an edge-on slat is.

void main() {
  // This is 0 when the window is fully visible and 1 when all slats are closed.
  float prog = uForOpening ? 1.0 - uProgress : uProgress;

  // Each slat is a horizontal band of the window. This is the index of the slat which
  // contains the current pixel, and the position of the pixel inside this slat in
  // [-0.5..0.5] from the top to the bottom.
  float slat  = iTexCoord.t * uSlats;
  float index = floor(slat);
  float local = fract(slat) - 0.5;

  // The slats start turning one after another from the top to the bottom. The last slat
  // starts uDelay later than the first one, but all slats take the same time.
  float total = min(uDelay, 0.95);
  float delay = index / max(uSlats - 1.0, 1.0) * total;
  float t     = clamp((prog - delay) / (1.0 - total), 0.0, 1.0);

  // A slat which is turned by an angle looks like it is only cos(angle) times as high.
  float angle  = easeInOutCubic(t) * HALF_PI;
  float height = cos(angle);
  float limit  = 0.5 * height;

  // Everything outside of the turned slat is transparent.
  if (abs(local) >= limit) {
    setOutputColor(vec4(0.0));
    return;
  }

  // This is how far the slat is turned in [0..1], and the position of the pixel inside
  // the visible part of the slat in [-1..1] from its upper to its lower edge.
  float turn = sin(angle);
  float rel  = local / max(limit, 0.01);

  // With perspective, the lower edge of a turning slat is further away, so the slat gets
  // narrower towards it. Everything outside of the narrowed slat is transparent.
  float x = iTexCoord.s;
  if (uPerspective) {
    float shrink = PERSPECTIVE * turn * (0.5 * rel + 0.5);
    x            = 0.5 + (x - 0.5) / (1.0 - shrink);
    if (x < 0.0 || x > 1.0) {
      setOutputColor(vec4(0.0));
      return;
    }
  }

  // Stretch the visible part of the slat back to the full height of the window texture.
  float y = (index + 0.5 + local / max(height, 0.02)) / uSlats;

  vec4 oColor = getInputColor(vec2(x, y));

  // A turned slat gets darker, especially at its lower edge, and it catches some light
  // along its edges.
  oColor.rgb *= 1.0 - turn * SHADE - turn * 0.25 * rel;
  oColor.rgb += smoothstep(0.8, 1.0, abs(rel)) * turn * RIM;

  // Soften the edges of the slats while they turn, but not at the very beginning as this
  // would show thin lines between the slats of the untouched window.
  float edge = 1.0 - smoothstep(limit - SOFT, limit, abs(local));
  oColor.a *= mix(1.0, edge, smoothstep(0.0, 0.05, t));

  // Fade out the last bit, when the slats are only thin lines.
  oColor.a *= 1.0 - smoothstep(0.92, 1.0, t);

  setOutputColor(oColor);
}
