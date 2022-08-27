//////////////////////////////////////////////////////////////////////////////////////////
//          )                                                   (                       //
//       ( /(   (  (               )    (       (  (  (         )\ )    (  (            //
//       )\()) ))\ )(   (         (     )\ )    )\))( )\  (    (()/( (  )\))(  (        //
//      ((_)\ /((_|()\  )\ )      )\  '(()/(   ((_)()((_) )\ )  ((_)))\((_)()\ )\       //
//      | |(_|_))( ((_)_(_/(    _((_))  )(_))  _(()((_|_)_(_/(  _| |((_)(()((_|(_)      //
//      | '_ \ || | '_| ' \))  | '  \()| || |  \ V  V / | ' \)) _` / _ \ V  V (_-<      //
//      |_.__/\_,_|_| |_||_|   |_|_|_|  \_, |   \_/\_/|_|_||_|\__,_\___/\_/\_//__/      //
//                                 |__/                                                 //
//                       Copyright (c) 2021 Simon Schneegans                            //
//          Released under the GPLv3 or later. See LICENSE file for details.            //
//////////////////////////////////////////////////////////////////////////////////////////

// The content from common.glsl is automatically prepended to each shader effect.

uniform float uActorScale;
uniform float uHorizontalScale;
uniform float uVerticalScale;
uniform float uPixelSize;

void main() {

  float pixelSize = ceil(uPixelSize * uProgress + 1.0);
  vec2 pixelGrid  = vec2(pixelSize) / uSize;

  vec2 texcoord = iTexCoord.st;
  texcoord.y    = texcoord.y * uActorScale + 0.5 - uActorScale * 0.5;
  texcoord -= mod(iTexCoord.st, pixelGrid);
  texcoord += pixelGrid * 0.5;

  float hScale = uHorizontalScale * uSize.x * 0.001;
  float vScale = uVerticalScale * uSize.y * 0.0001;
  float shift  = max(simplex2DFractal(texcoord.xx * hScale) * vScale +
                      (1.0 + vScale * 0.8) * uProgress - 0.8 * vScale,
                    0.0);

  texcoord.y -= uActorScale * shift;

  vec4 oColor = getInputColor(texcoord);

  setOutputColor(oColor);
}