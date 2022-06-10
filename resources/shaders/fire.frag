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

uniform bool u3DNoise;
uniform float uScale;
uniform float uMovementSpeed;
uniform vec4 uGradient1;
uniform vec4 uGradient2;
uniform vec4 uGradient3;
uniform vec4 uGradient4;
uniform vec4 uGradient5;

// These may be configurable in the future.
const float EDGE_FADE  = 70.0;
const float FADE_WIDTH = 0.1;
const float HIDE_TIME  = 0.4;

// This maps the input value from [0..1] to a color from the gradient.
vec4 getFireColor(float v) {
  const float steps[5] = float[](0.0, 0.2, 0.35, 0.5, 0.8);
  vec4 colors[5] = vec4[](uGradient1, uGradient2, uGradient3, uGradient4, uGradient5);

  if (v < steps[0]) {
    return colors[0];
  }

  for (int i = 0; i < 4; ++i) {
    if (v <= steps[i + 1]) {
      return mix(colors[i], colors[i + 1],
                 vec4(v - steps[i]) / (steps[i + 1] - steps[i]));
    }
  }

  return colors[4];
}

// This method requires the uniforms from standardUniforms() to be available.
// It returns two values: The first is an alpha value which can be used for the window
// texture. This gradually dissolves the window from top to bottom. The second can be used
// to mask any effect, it will be most opaque where the window is currently fading and
// gradually dissolve to zero over time.
// hideTime:      A value in [0..1]. It determines the percentage of the animation which
//                is spent for hiding the window. 1-hideTime will be spent thereafter for
//                dissolving the effect mask.
// fadeWidth:     The relative size of the window-hiding gradient in [0..1].
// edgeFadeWidth: The pixel width of the effect fading range at the edges of the window.
vec2 effectMask(float hideTime, float fadeWidth, float edgeFadeWidth) {
  float progress = easeOutQuad(uProgress);

  float burnProgress      = clamp(progress / hideTime, 0.0, 1.0);
  float afterBurnProgress = clamp((progress - hideTime) / (1.0 - hideTime), 0.0, 1.0);

  // Gradient from top to bottom.
  float t = iTexCoord.t * (1.0 - fadeWidth);

  // Visible part of the window. Gradually dissolves towards the bottom.
  float windowMask = 1.0 - clamp((burnProgress - t) / fadeWidth, 0.0, 1.0);

  // Gradient from top burning window.
  float effectMask = clamp(t * (1.0 - windowMask) / burnProgress, 0.0, 1.0);

  // Fade-out when the window burned down.
  if (progress > hideTime) {
    float fade = sqrt(1.0 - afterBurnProgress * afterBurnProgress);
    effectMask *= mix(1.0, 1.0 - t, afterBurnProgress) * fade;
  }

  // Fade at window borders.
  effectMask *= getAbsoluteEdgeMask(edgeFadeWidth, 0.5);

  if (uForOpening) {
    windowMask = 1.0 - windowMask;
  }

  return vec2(windowMask, effectMask);
}

void main() {
  // Get a noise value which moves vertically in time.
  vec2 uv = iTexCoord.st * uSize / vec2(400, 600) / uScale;
  uv.y += uProgress * uDuration * uMovementSpeed;

  float noise =
    u3DNoise
      ? simplex3DFractal(vec3(uv * 4.0, uProgress * uDuration * uMovementSpeed * 1.5))
      : simplex2DFractal(uv * 4.0);

  // Modulate noise by effect mask.
  vec2 effectMask = effectMask(HIDE_TIME, FADE_WIDTH, EDGE_FADE);
  noise *= effectMask.y;

  // Map noise value to color.
  vec4 fire = getFireColor(noise);

  // Get the window texture.
  vec4 oColor = getInputColor(iTexCoord.st);

  // Fade the window according to the effect mask.
  oColor.a *= effectMask.x;

  // Add the fire to the window.
  oColor = alphaOver(oColor, fire);

  // These are pretty useful for understanding how this works.
  // oColor = vec4(vec3(noise), 1);
  // oColor = vec4(vec3(effectMask.x), 1);
  // oColor = vec4(vec3(effectMask.y), 1);

  setOutputColor(oColor);
}