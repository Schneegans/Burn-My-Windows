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

uniform vec3 uColor;
uniform float uScale;
uniform float uStrength;
uniform float uSpeed;

// Somewhat inspired by https://www.shadertoy.com/view/XtK3W3
void main() {
  float progress = (uForOpening ? 1.0 - uProgress : uProgress);
  float time     = 7.5 * progress * uDuration * uSpeed;
  float strength = uStrength * progress;
  float displace = 750.0 * strength / uSize.x;
  float yPos     = uScale * uSize.y * iTexCoord.y;

  // Create large, incidental noise waves.
  float noise = clamp(simplex2D(vec2(time, yPos * 0.002)) - 0.3, 0.0, 1.0);

  // Offset by smaller, constant noise waves.
  noise = noise + (simplex2D(vec2(time * 10.0, yPos * 0.05)) - 0.5) * 0.15;

  // Apply the noise as x displacement for every line.
  float xPos  = clamp(iTexCoord.x - displace * noise * noise, 0.0, 1.0);
  vec4 oColor = getInputColor(vec2(xPos, iTexCoord.y));

  // Mix in some random interference lines.
  vec3 interference          = uColor * hash12(vec2(yPos * time));
  float interferenceStrength = noise * min(strength, 1.0);
  oColor.rgb                 = mix(oColor.rgb, interference, interferenceStrength);

  // Apply a line pattern every 4 pixels.
  if (floor(mod(yPos * 0.25, 2.0)) == 0.0) {
    oColor.rgb = mix(uColor, oColor.rgb, 1.0 - (0.15 * noise));
  }

  // Shift green/blue channels.
  oColor.g = mix(oColor.g,
                 getInputColor(vec2(xPos + noise * 0.1 * displace, iTexCoord.y)).g, 0.25);
  oColor.b = mix(oColor.b,
                 getInputColor(vec2(xPos - noise * 0.1 * displace, iTexCoord.y)).b, 0.25);

  // Dissolve the window.
  if (progress > mix(1.0 - noise, max(max(oColor.r, oColor.g), oColor.b), 0.5)) {
    oColor.a = 0.0;
  }

  setOutputColor(oColor);
}