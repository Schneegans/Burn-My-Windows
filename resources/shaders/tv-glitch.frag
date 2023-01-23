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

uniform vec4 uColor;
uniform float uSeed;
uniform float uScale;
uniform float uStrength;
uniform float uSpeed;

const float BLUR_WIDTH = 0.01;  // Width of the gradients.
const float TB_TIME    = 0.7;   // Relative time for the top/bottom animation.
const float LR_TIME    = 0.4;   // Relative time for the left/right animation.
const float LR_DELAY   = 0.6;   // Delay after which the left/right animation starts.
const float FF_TIME    = 0.1;   // Relative time for the final fade to transparency.
const float SCALING    = 0.5;   // Additional vertical scaling of the window.

// This is a combination of the effects from tv.frag and glitch.frag. Credits go to Kurt
// Wilson (https://github.com/Kurtoid) for this idea!
void main() {

  // Add the tv effect sooner/later in the animation, compared to the original TV effect.
  float tOffset    = uForOpening ? 0.0 : 1.0;
  float tvProgress = clamp(uProgress * 2.0 - tOffset, 0.0, 1.0);
  tvProgress = uForOpening ? 1.0 - easeOutQuad(tvProgress) : easeOutQuad(tvProgress);

  // Scale down the window vertically.
  float scale = 1.0 / mix(1.0, SCALING, tvProgress) - 1.0;
  vec2 coords = iTexCoord.st;
  coords.y    = coords.y * (scale + 1.0) - scale * 0.5;

  // This is from the original Glitch effect.
  float progress = easeInQuad(uForOpening ? 1.0 - uProgress : uProgress);
  float time     = progress * uDuration * uSpeed;
  float strength = uStrength * progress;
  float displace = 1000.0 * strength / uSize.x;
  float yPos     = uScale * uSize.y * (coords.y + uSeed * 10.0);

  // Create large noise waves and add some smaller noise waves.
  float noise = clamp(simplex2D(vec2(time, yPos * 0.002)) - 0.5, 0.0, 1.0);
  noise += (simplex2D(vec2(time * 10.0, yPos * 0.05)) - 0.5) * 0.15;

  // Apply the noise as x displacement for every line.
  float xPos  = clamp(coords.x - displace * noise * noise, 0.0, 1.0);
  vec4 oColor = getInputColor(vec2(xPos, coords.y));

  // Mix in some random interference lines.
  vec3 interference          = uColor.rgb * hash12(vec2(yPos * time));
  float interferenceStrength = noise * min(strength, 1.0);
  oColor.rgb = mix(oColor.rgb, interference, uColor.a * interferenceStrength);

  // Mix in some grainy noise.
  vec3 grain          = uColor.rgb * simplex2D(uSize * coords + vec2(time * 100.0));
  float grainStrength = 0.2 * min(strength, 1.0);
  oColor.rgb          = mix(oColor.rgb, grain, uColor.a * grainStrength);

  // Add a subtle line pattern every 4 pixels.
  if (floor(mod(yPos * 0.25, 2.0)) == 0.0) {
    oColor.rgb = mix(oColor.rgb, uColor.rgb, uColor.a * (0.15 * noise));
  }

  // Shift green/blue channels.
  float offset = 0.1 * noise * displace;
  oColor.g     = mix(oColor.g, getInputColor(vec2(xPos + offset, coords.y)).g, 0.25);
  oColor.b     = mix(oColor.b, getInputColor(vec2(xPos - offset, coords.y)).b, 0.25);

  // Now hide the window according to the TV effect.

  // All of these are in [0..1] during the different stages of the animation.
  // tb refers to the top-bottom animation.
  // lr refers to the left-right animation.
  // ff refers to the final fade animation.
  float tbProg = smoothstep(0.0, 1.0, clamp(tvProgress / TB_TIME, 0.0, 1.0));
  float lrProg = smoothstep(0.0, 1.0, clamp((tvProgress - LR_DELAY) / LR_TIME, 0.0, 1.0));
  float ffProg =
    smoothstep(0.0, 1.0, clamp((tvProgress - 1.0 + FF_TIME) / FF_TIME, 0.0, 1.0));

  // This is a top-center-bottom gradient in [0..1..0]
  float tb = coords.y * 2.0;
  tb       = tb < 1.0 ? tb : 2.0 - tb;

  // This is a left-center-right gradient in [0..1..0]
  float lr = coords.x * 2.0;
  lr       = lr < 1.0 ? lr : 2.0 - lr;

  // Combine the progress values with the gradients to create the alpha masks.
  float tbMask = 1.0 - smoothstep(0.0, 1.0, clamp((tbProg - tb) / BLUR_WIDTH, 0.0, 1.0));
  float lrMask = 1.0 - smoothstep(0.0, 1.0, clamp((lrProg - lr) / BLUR_WIDTH, 0.0, 1.0));
  float ffMask = 1.0 - smoothstep(0.0, 1.0, ffProg);

  // Assemble the final color value.
  oColor.rgb =
    mix(oColor.rgb, uColor.rgb * oColor.a, uColor.a * smoothstep(0.0, 1.0, tvProgress));
  float mask = tbMask * lrMask * ffMask;

  oColor.a *= mask;

  setOutputColor(oColor);
}
