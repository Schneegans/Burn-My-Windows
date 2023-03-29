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

uniform vec2 uActorScale;
uniform vec2 uPointerPos;
uniform vec2 uControlPointA;
uniform vec2 uControlPointB;

void main() {
  float progress = uForOpening ? 1.0 - uProgress : uProgress;

  vec2 texcoord = iTexCoord.st;
  texcoord      = texcoord * uActorScale + 0.5 - uActorScale * 0.5;

  vec4 oColor = getInputColor(texcoord);
  oColor.rgb *= vec3(1.0, 0.5, 0.5);

  if (length(texcoord - uPointerPos) < 0.02) {
    oColor = vec4(1.0);
  }

  if (length(texcoord - uControlPointA) < 0.02) {
    oColor = vec4(1.0, 0.0, 0.0, 1.0);
  }

  if (length(texcoord - uControlPointB) < 0.02) {
    oColor = vec4(0.0, 1.0, 0.0, 1.0);
  }

  setOutputColor(oColor);
}