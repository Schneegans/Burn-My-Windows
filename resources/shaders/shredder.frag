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

uniform float uStrips;      // The number of vertical strips.
uniform float uRandomness;  // How much the strips differ in when they start to fall.
uniform float uActorScale;  // The vertical scale of the actor, see Shredder.js.
uniform bool uRoughEdges;   // Whether the edges of the strips are jagged.

const float SWAY   = 0.08;  // How far a strip moves sideways, in strip widths.
const float GAP    = 0.2;   // How much narrower than its slot a falling strip gets.
const float DARKEN = 0.3;   // How dark a strip gets while it falls.
const float SOFT   = 0.04;  // Softness of the strip edges in strip widths.
const float ROUGH  = 0.16;  // How deep the rough edges cut into a strip, in strip widths.

void main() {
  // This is 0 when the window is fully visible and 1 when all strips are gone.
  float prog = uForOpening ? 1.0 - uProgress : uProgress;

  // The actor is enlarged vertically so that the strips can fall below the window. This
  // converts the texture coordinates of the enlarged actor to coordinates relative to the
  // window, where the window itself covers [0..1]. The strips fall by at most as much as
  // the actor has been enlarged below the window.
  vec2 coords   = vec2(iTexCoord.s, (iTexCoord.t - 0.5) * uActorScale + 0.5);
  float maxFall = 0.5 * (uActorScale - 1.0);

  // Each strip is a vertical band of the window. This is the index of the strip which
  // contains the current pixel.
  float index = floor(coords.x * uStrips);

  // Every strip gets a pseudo-random number in [0..1] from its index. It delays the start
  // of the strip, but all strips take the same time to fall.
  float random = fract(sin(index * 91.7 + 13.1) * 4375.5);
  float spread = min(0.5 * uRandomness, 0.95);
  float t      = clamp((prog - random * spread) / (1.0 - spread), 0.0, 1.0);

  // The strips accelerate while they fall and sway a little to the side. The sway is
  // smaller than the gap between the strips, so a strip never shows its neighbor.
  float fall = t * t * maxFall;
  float sway = sin(t * 6.0 + index) * SWAY * t / uStrips;

  // This is the position of the pixel inside its strip in [-0.5..0.5] from left to right.
  // The strip moves sideways with the sway, and so does its outline.
  float local = fract((coords.x - sway) * uStrips) - 0.5;

  // The strips become narrower while they fall, which opens gaps between them. At the
  // very beginning the gaps are not drawn, as this would show lines in the untouched
  // window.
  float width = mix(1.0, 1.0 - GAP, smoothstep(0.0, 0.25, t));
  float limit = 0.5 * width;

  // With rough edges, the strips look torn from paper. The noise is read at the position
  // on the window which the pixel shows, so the jagged edges move down with the strip.
  // The left and the right edge of a strip get different noise.
  if (uRoughEdges) {
    vec2 seed = vec2((coords.y - fall) * 55.0, index * 7.3 + step(0.0, local) * 3.1);
    limit -= (simplex2D(seed) - 0.5) * ROUGH * smoothstep(0.0, 0.25, t);
  }

  float edge = 1.0 - smoothstep(limit - SOFT, limit, abs(local));
  float cover = mix(1.0, edge, smoothstep(0.0, 0.03, t));

  // Read the window color at the position the strip has moved away from.
  vec2 source = vec2(coords.x - sway, coords.y - fall);
  vec4 oColor = getInputColor(source);

  // Hide anything which was moved in from outside the window.
  if (source.x < 0.0 || source.x > 1.0 || source.y < 0.0 || source.y > 1.0) {
    oColor.a = 0.0;
  }

  // Falling strips become darker and finally fade out.
  oColor.rgb *= 1.0 - DARKEN * t;
  oColor.a *= cover * (1.0 - smoothstep(0.4, 1.0, t));

  setOutputColor(oColor);
}
