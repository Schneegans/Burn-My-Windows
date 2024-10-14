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

// SPDX-FileCopyrightText: Your Name <your@email.com>
// SPDX-License-Identifier: GPL-3.0-or-later

// The content from common.glsl is automatically prepended to each shader effect. This
// provides the standard input:

// Function to convert RGB to HSL
vec3 rgbToHsl(vec3 color) {
    float maxVal = max(max(color.r, color.g), color.b);
    float minVal = min(min(color.r, color.g), color.b);
    float delta = maxVal - minVal;

    float hue;
    if(delta == 0.0) {
        hue = 0.0;
    } else if(maxVal == color.r) {
        hue = mod((color.g - color.b) / delta, 6.0);
    } else if(maxVal == color.g) {
        hue = (color.b - color.r) / delta + 2.0;
    } else {
        hue = (color.r - color.g) / delta + 4.0;
    }
    hue /= 6.0;

    float lightness = (maxVal + minVal) / 2.0;

    float saturation;
    if(delta == 0.0) {
        saturation = 0.0;
    } else {
        saturation = delta / (1.0 - abs(2.0 * lightness - 1.0));
    }

    return vec3(hue, saturation, lightness);
}

// Function to convert HSL back to RGB
vec3 hslToRgb(vec3 hsl) {
    float c = (1.0 - abs(2.0 * hsl.z - 1.0)) * hsl.y;
    float x = c * (1.0 - abs(mod(hsl.x * 6.0, 2.0) - 1.0));
    float m = hsl.z - c / 2.0;

    vec3 rgb;
    if(hsl.x < 1.0 / 6.0) {
        rgb = vec3(c, x, 0.0);
    } else if(hsl.x < 2.0 / 6.0) {
        rgb = vec3(x, c, 0.0);
    } else if(hsl.x < 3.0 / 6.0) {
        rgb = vec3(0.0, c, x);
    } else if(hsl.x < 4.0 / 6.0) {
        rgb = vec3(0.0, x, c);
    } else if(hsl.x < 5.0 / 6.0) {
        rgb = vec3(x, 0.0, c);
    } else {
        rgb = vec3(c, 0.0, x);
    }

    return rgb + vec3(m);
}


// Pseudo-random number generator
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Smooth noise function
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D of the cell
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    // Smooth interpolation
    vec2 u = f * f * (3.0 - 2.0 * f);

    // Mix the results from the corners
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}


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

// The width of the fading effect is loaded from the settings.
uniform float uFadeWidth;

precision mediump float;

const bool RAINBOW = true; 
const float COLOR_SPEED = 0.5;
const vec4 COLOR = vec4(0.0,1.0,0.0,1.0);

void main() {

    float OldMin = 0.0;
    float OldMax = 0.0;
    float NewMin = 0.0;
    float NewMax = 0.0;
    float OldRange = 0.0;
    float NewRange = 0.0;
    float OldValue = 0.0;
    float NewValue = 0.0;

    float prog = uForOpening ? 1.0 - easeOutQuad(uProgress) : easeOutQuad(uProgress);

    float progsin = sin(prog * 1.55);

	//remap from 0.0,1.0 to 10.0,0.0
    OldMin = 0.0;
    OldMax = 1.0;
    NewMin = 10.0;
    NewMax = 0.0;
    OldRange = (OldMax - OldMin);
    NewRange = (NewMax - NewMin);
    OldValue = progsin;
    NewValue = (((OldValue - OldMin) * NewRange) / OldRange) + NewMin;

	//we'll use this later 
    float pow0 = NewValue;

	//remap from 0.0,1.0 to 0.0,100.0
    OldMin = 0.0;
    OldMax = 1.0;
    NewMin = 0.0;
    NewMax = 100.0;
    OldRange = (OldMax - OldMin);
    NewRange = (NewMax - NewMin);
    OldValue = progsin;
    NewValue = (((OldValue - OldMin) * NewRange) / OldRange) + NewMin;

	//wel'll use this later 
    float Yremap = NewValue;

    vec3 thisCOLOR = COLOR.rgb;

    // the uv
    vec4 uv = texture(iTexture, iTexCoord.st); // Sample texture color

    //if rainbow is enabled
    if (RAINBOW)
    {
        vec3 hsl = rgbToHsl(uv.rgb);  // Convert RGB to HSL

        // Offset the hue by a certain amount
        float hueOffset = progsin * COLOR_SPEED;  // Example: Offset by 0.1 (corresponds to 36 degrees)
        hsl.x = mod(hsl.x + hueOffset, 1.0);  // Add the hue offset and wrap around

        thisCOLOR = hslToRgb(hsl.rgb);  // Convert back to RGB
    }

    //
    float tempx = pow(distance(uv.x,0.5),4.0);
    float tempy = pow(distance(uv.y,0.5),4.0);
    float shape00 = tempx+tempy;

    // remapping 0.0,1.0 to 0.0,Yremap
    OldMin = 0.0;
    OldMax = 1.0;
    NewMin = 0.0;
    NewMax = Yremap;
    OldRange = (OldMax - OldMin);
    NewRange = (NewMax - NewMin);
    OldValue = shape00;
    NewValue = (((OldValue - OldMin) * NewRange) / OldRange) + NewMin;

    shape00 = NewValue;

    shape00 = power(shape00,pow0);

    vec3 shape01 = (shape00 * thisCOLOR.rgb) * 25.0;

    //adding some noise ... might remove this later
    float noise00 = noise(uv * 10.0);
    vec3 shape02 = shape01 * noise00;

    vec4 oColor = getInputColor(iTexCoord.st);
    oColor += shape02;

    float shape04 = 1.0-shape00;


    OldMin = 0.0;
    OldMax = 1.0;
    NewMin = 0.0;
    NewMax = 3.0;
    OldRange = (OldMax - OldMin);
    NewRange = (NewMax - NewMin);
    OldValue = shape04;
    NewValue = (((OldValue - OldMin) * NewRange) / OldRange) + NewMin;

    shape04 = clamp(NewValue,0.0,1.0);

    oColor.a *= shape04;


    setOutputColor(oColor);
}