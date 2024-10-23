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

// SPDX-FileCopyrightText: Justin Garza JGarza9788@gmail.com
// SPDX-License-Identifier: GPL-3.0-or-later

// The content from common.glsl is automatically prepended to each shader effect. This
// provides the standard input:

// vec2  iTexCoord:     Texture coordinates for retrieving the window input color.
// bool  uIsFullscreen: True if the window is maximized or in fullscreen mode.
// bool  uForOpening:   True if a window-open animation is ongoing, false otherwise.
// float uProgress:     A value which transitions from 0 to 1 during the animation.
// float uDuration:     The duration of the current animation in seconds.
// vec2  uSize:         The size of uTexture in pixels.
// float uPadding:      The empty area around the actual window (e.g. where the shadow
//                      is drawn). For now, this will only be set on GNOME.

// Furthermore, there are two global methods for reading the window input color and
// setting the shader output color. Both methods assume straight alpha:

// vec4 getInputColor(vec2 coords)
// void setOutputColor(vec4 outColor)


// Ease-in-out cubic for alpha
float easeInOutCubic(float x) {
    return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
}

// Ease-in-out sine for blur
float easeInOutSine(float x) {
    return -(cos(3.14159265 * x) - 1.0) / 2.0;
}

// A simple blur function
vec4 blur( vec2 uv, float radius) {
    vec4 color = vec4(0.0);
    float totalWeight = 0.0;

    // Sample in a small area around the pixel
    for (float x = -radius; x <= radius; x++) {
        for (float y = -radius; y <= radius; y++) {
            vec2 offset = vec2(x, y) / uSize;
            color += getInputColor(uv + offset);
            totalWeight += 1.0;
        }
    }
    return color / totalWeight;
}
// The width of the fading effect is loaded from the settings.
uniform float uBlurAmount;

void main() {

    float progl = uForOpening ? uProgress : 1.0 - uProgress;

    float easedProgressBlur = easeInOutSine(progl);  // Blur easing
    float easedProgressAlpha = easeInOutCubic(progl);  // Alpha easing

    // Control blur amount using easedProgressBlur
    float blurAmount = mix(uBlurAmount, 0.0, easedProgressBlur);

    // Apply blur
    vec4 texColor = blur( iTexCoord.st, blurAmount);

    // Control alpha using easedProgressAlpha
    float alpha = easedProgressAlpha;

    // Set final color with alpha transition
    texColor.a *= alpha;

    setOutputColor(texColor);
}