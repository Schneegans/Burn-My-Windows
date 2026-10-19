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
uniform bool uPullUp;       // Whether the blind is pulled up instead of turning shut.

const float HALF_PI     = 1.5707963;
const float SHADE       = 0.55;  // How dark a slat gets when it is almost closed.
const float RIM         = 0.25;  // How bright the edges of an almost closed slat are.
const float SOFT        = 0.03;  // Softness of the slat edges in slat heights.
const float PERSPECTIVE = 0.2;   // How much narrower the far edge of an edge-on slat is.
const float FOLDED      = 0.22;  // How high a folded slat is when the blind is pulled up.
const float FOLD_END    = 0.88;  // When all slats are folded at the top. Then they fade.
const int MAX_SLATS     = 15;    // The maximum of the Number of Slats slider.

// Returns the progress of the slat with the given index in [0..1]. The slats start one
// after another from the top to the bottom. The last slat starts uDelay later than the
// first one, but all slats take the same time.
float getSlatProgress(float index, float prog) {
  float total = min(uDelay, 0.95);
  float delay = index / max(uSlats - 1.0, 1.0) * total;
  return clamp((prog - delay) / (1.0 - total), 0.0, 1.0);
}

// Returns the color of the slat with the given index at the current pixel. local is the
// position of the pixel relative to the center of the slat, in slat heights. height is
// how high the turned slat looks compared to an open one, and t is its progress.
vec4 getSlatColor(float index, float local, float height, float t) {
  float limit = 0.5 * height;

  // Everything outside of the turned slat is transparent.
  if (abs(local) >= limit) {
    return vec4(0.0);
  }

  // This is how far the slat is turned in [0..1], and the position of the pixel inside
  // the visible part of the slat in [-1..1] from its upper to its lower edge. As the
  // height is the cosine of the angle by which the slat is turned, this is its sine.
  float turn = sqrt(1.0 - height * height);
  float rel  = local / max(limit, 0.01);

  // With perspective, the lower edge of a turning slat is further away, so the slat gets
  // narrower towards it. Everything outside of the narrowed slat is transparent.
  float x = iTexCoord.s;
  if (uPerspective) {
    float shrink = PERSPECTIVE * turn * (0.5 * rel + 0.5);
    x            = 0.5 + (x - 0.5) / (1.0 - shrink);
    if (x < 0.0 || x > 1.0) {
      return vec4(0.0);
    }
  }

  // Stretch the visible part of the slat back to the full height of the window texture.
  float y = (index + 0.5 + local / max(height, 0.02)) / uSlats;

  vec4 color = getInputColor(vec2(x, y));

  // A turned slat gets darker, especially at its lower edge, and it catches some light
  // along its edges.
  color.rgb *= 1.0 - turn * SHADE - turn * 0.25 * rel;
  color.rgb += smoothstep(0.8, 1.0, abs(rel)) * turn * RIM;

  // Soften the edges of the slats while they turn, but not at the very beginning as this
  // would show thin lines between the slats of the untouched window.
  float edge = 1.0 - smoothstep(limit - SOFT, limit, abs(local));
  color.a *= mix(1.0, edge, smoothstep(0.0, 0.05, t));

  return color;
}

void main() {
  // This is 0 when the window is fully visible and 1 when all slats are closed.
  float prog = uForOpening ? 1.0 - uProgress : uProgress;

  // The position of the pixel from the top to the bottom of the window, in slat heights.
  float pos = iTexCoord.t * uSlats;

  if (!uPullUp) {
    // Each slat stays in its place and turns until it is edge-on. This is the index of
    // the slat which contains the current pixel.
    float index = floor(pos);
    float t     = getSlatProgress(index, prog);

    // A slat which is turned by an angle looks like it is only cos(angle) times as high.
    float height = cos(easeInOutCubic(t) * HALF_PI);

    vec4 oColor = getSlatColor(index, fract(pos) - 0.5, height, t);

    // Fade out the last bit, when the slats are only thin lines.
    oColor.a *= 1.0 - smoothstep(0.92, 1.0, t);

    setOutputColor(oColor);
    return;
  }

  // When the blind is pulled up, each slat rises to the top of the window and folds on
  // the way, so that all slats end up folded on top of each other. For opening windows,
  // this runs backwards: the bottom slat leaves the stack first and unfolds while it
  // slides down into place. As the slats move, the current pixel may show any of them.
  // The upper slats are in front, so the first slat which covers the pixel is drawn.
  float fold   = clamp(prog / FOLD_END, 0.0, 1.0);
  vec4  oColor = vec4(0.0);

  for (int i = 0; i < MAX_SLATS; ++i) {
    float index = float(i);
    if (index >= uSlats) {
      break;
    }

    float t      = getSlatProgress(index, fold);
    float e      = easeInOutCubic(t);
    float height = mix(1.0, FOLDED, e);
    float center = mix(index + 0.5, 0.5 * FOLDED, e);
    float local  = pos - center;

    if (abs(local) < 0.5 * height) {
      oColor = getSlatColor(index, local, height, t);
      break;
    }
  }

  // Fade out the folded slats at the top.
  oColor.a *= 1.0 - smoothstep(FOLD_END, 1.0, prog);

  setOutputColor(oColor);
}
