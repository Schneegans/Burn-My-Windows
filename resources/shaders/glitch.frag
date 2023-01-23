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

// Somewhat inspired by https://www.shadertoy.com/view/XtK3W3
void main() {
  float progress = easeInQuad(uForOpening ? 1.0 - uProgress : uProgress);
  float time     = progress * uDuration * uSpeed;
  float strength = uStrength * progress;
  float displace = 1000.0 * strength / uSize.x;
  float yPos     = uScale * uSize.y * (iTexCoord.y + uSeed * 10.0);

  // Create large noise waves and add some smaller noise waves.
  float noise = clamp(simplex2D(vec2(time, yPos * 0.002)) - 0.5, 0.0, 1.0);
  noise += (simplex2D(vec2(time * 10.0, yPos * 0.05)) - 0.5) * 0.15;

  // Apply the noise as x displacement for every line.
  float xPos  = clamp(iTexCoord.x - displace * noise * noise, 0.0, 1.0);
  vec4 oColor = getInputColor(vec2(xPos, iTexCoord.y));

  // Mix in some random interference lines.
  vec3 interference          = uColor.rgb * hash12(vec2(yPos * time));
  float interferenceStrength = noise * min(strength, 1.0);
  oColor.rgb = mix(oColor.rgb, interference, uColor.a * interferenceStrength);

  // Mix in some grainy noise.
  vec3 grain          = uColor.rgb * simplex2D(uSize * iTexCoord + vec2(time * 100.0));
  float grainStrength = 0.2 * min(strength, 1.0);
  oColor.rgb          = mix(oColor.rgb, grain, uColor.a * grainStrength);

  // Add a subtle line pattern every 4 pixels.
  if (floor(mod(yPos * 0.25, 2.0)) == 0.0) {
    oColor.rgb = mix(oColor.rgb, uColor.rgb, uColor.a * (0.15 * noise));
  }

  // Shift green/blue channels.
  float offset = 0.1 * noise * displace;
  oColor.g     = mix(oColor.g, getInputColor(vec2(xPos + offset, iTexCoord.y)).g, 0.25);
  oColor.b     = mix(oColor.b, getInputColor(vec2(xPos - offset, iTexCoord.y)).b, 0.25);

  // Dissolve the window.
  float fadeDelay = 1.5;
  float alpha = clamp(noise + 1.0 + fadeDelay - (3.0 + fadeDelay) * progress, 0.0, 1.0);
  oColor.a *= alpha;

  setOutputColor(oColor);
}