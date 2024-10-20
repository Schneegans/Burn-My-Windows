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


// GLSL remap function to map a value from one range to another
float remap(float value, float inputMin, float inputMax, float outputMin, float outputMax) {
    return outputMin + (outputMax - outputMin) * ((value - inputMin) / (inputMax - inputMin));
}

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

// 1. easeInSine
float easeInSine(float x) {
    return 1.0 - cos((x * 3.14159265) / 2.0);
}

// 2. easeOutSine
float easeOutSine(float x) {
    return sin((x * 3.14159265) / 2.0);
}

// 3. easeInOutSine
float easeInOutSine(float x) {
    return -(cos(3.14159265 * x) - 1.0) / 2.0;
}

// 6. easeInOutQuad
float easeInOutQuad(float x) {
    return (x < 0.5) ? 2.0 * x * x : 1.0 - pow(-2.0 * x + 2.0, 2.0) / 2.0;
}

// The width of the fading effect is loaded from the settings.
uniform float uFadeWidth;

void main() {


    // float prog_linear = uForOpening ? 1.0 - uProgress : uProgress;
    // vec2 uv = iTexCoord.st * uSize / vec2(400, 600) / 1.0;
    // setOutputColor(vec4(uv.x,uv.y,0.0,prog_linear));


    //todo: make these uniform values later
    bool RAINBOW = true;
    float COLOR_SPEED = 1.0;
    vec4 COLOR = vec4(0.0, 1.0, 0.0,1.0);

    //this will be used a lot
    float aspectRatio = uSize.x / uSize.y;
    // float usx = uSize.x * 0.5 * aspectRatio;
    // float usy = uSize.y * 0.5 * aspectRatio;
    float usx = uSize.x * 0.85 * aspectRatio;
    float usy = uSize.y * 0.85 * aspectRatio;
    vec2 uv = iTexCoord.st * uSize / vec2(usx,usy);
    // vec2 uv = iTexCoord.st * uSize;


    // float prog = uForOpening ? 1.0 - easeOutQuad(uProgress) : easeOutQuad(uProgress);
    float prog_linear = uForOpening ? uProgress : 1.0 - uProgress;
    // float prog_linear = uForOpening ? 1.0 - uProgress : uProgress;
    // float prog_linear = uProgress;

    // float prog_eioc = easeInOutCubic(prog_linear);
    float prog_eios = easeInOutSine(prog_linear);

    float uprog = prog_linear;

    //negative progress
    float nprog = remap(
        uprog,
        0.0,1.0, 
        1.0,0.0
        );

    //remap 10 to zero
    float rttz = remap(
        uprog,
        0.0,1.0, 
        10.0,0.0
        );
    
    
    //remap 0 to 100
    float rztoh = remap(
        uprog,
        0.0,1.0, 
        0.0,50.0
        );
    
    vec4 thisCOLOR = COLOR;

    // setOutputColor(vec4(thisCOLOR.r,thisCOLOR.g,thisCOLOR.b,prog_eios));

    //only if rainbow is true 
    if (RAINBOW)
    {
        vec3 xuv = vec3(uv.x,uv.y,1.0);
        vec3 hsl = rgbToHsl(xuv);  // Convert RGB to HSL

        // Offset the hue by a certain amount
        float hueOffset = uprog * COLOR_SPEED;  // Example: Offset by 0.1 (corresponds to 36 degrees)
        hsl.x = mod(hsl.x + hueOffset, 1.0);  // Add the hue offset and wrap around

        vec3 nRGB = hslToRgb(hsl.rgb);
        thisCOLOR = vec4(nRGB,1.0);
    }


    float half_uxx = (uSize.x / usx) / 2.0;
    float half_uxy = (uSize.y / usy) / 2.0;

    float tempx = pow(distance(uv.x, half_uxx ),4.0);
    float tempy = pow(distance(uv.y, half_uxy ),4.0);
    float shape00 = tempx+tempy;

    //
    float shape01 = remap(
        shape00,
        0.0,1.0, 
        0.0,rztoh
        );
    float shape02 = pow(shape01,rttz);

    //setOutputColor( vec4(shape02,shape02,shape02,1.0) );



    //this is the shape with color, and a bit of noise
    vec3 swc = shape02 * thisCOLOR.rgb * 2.0 * noise(uv * 0.5);

    //setOutputColor(vec4(swc.r,swc.g,swc.b,prog_eios));


    //get the window color, and add the swc
    vec4 oColor = getInputColor(iTexCoord.st);
    oColor.r += swc.r;
    oColor.g += swc.g;
    oColor.b += swc.b;
    // oColor.a = 1.0;

    //setOutputColor(oColor);


    //this is the fade out shape
    // float shape03 = remap(
    //     1.0 - shape00,
    //     0.0,1.0, 
    //     0.0,3.0
    //     );

    // shape03 = 1.0 - shape00;
    // oColor.a *= clamp(shape03, 0.0, 1.0);


    //latestart_rush

    // float x = 0.0;
    // if (uForOpening)
    // {
    //     float lsr = remap(
    //         clamp(prog_linear,0.0,0.25),
    //         0.0,0.25, 
    //         0.0,1.0
    //         );
    //     x = easeOutQuad( clamp(lsr,0.0,1.0) );
    // }
    // else
    // {
    //     float lsr = remap(
    //         clamp(prog_linear,0.85,1.0),
    //         0.85,1.0, 
    //         0.0,1.0
    //         );
    //     x = easeOutQuad( clamp(lsr,0.0,1.0) );
    // }

    // float lsr = remap(
    //     clamp(prog_linear,0.0,0.25),
    //     0.0,0.25, 
    //     0.0,1.0
    //     );
    // oColor.a *= easeOutQuad( clamp(lsr,0.0,1.0) );

    // oColor.a *= uprog;
    // oColor.a *= easeInOutQuad(prog_linear);
    // oColor.a *= x;

    float lsr = remap(
        clamp(prog_linear,0.0,0.25),
        0.0,0.25, 
        0.0,1.0
        );
    oColor.a *= easeInOutQuad( clamp(lsr,0.0,1.0) );

    setOutputColor(oColor);


  // // Get the color from the window texture.
  // vec4 oColor = getInputColor(iTexCoord.st);

  // // Radial distance from window edge to the window's center.
  // float dist = length(iTexCoord.st - 0.5) * 2.0 / sqrt(2.0);

  // // This gradually dissolves from [1..0] from the outside to the center. We
  // // switch the direction for opening and closing.
  // float progress = uForOpening ? 1.0 - uProgress : uProgress;
  // float mask = (1.0 - progress * (1.0 + uFadeWidth) - dist + uFadeWidth) / uFadeWidth;

  // // Make the mask smoother.
  // mask = smoothstep(0, 1, mask);

  // // Apply the mask to the output.
  // oColor.a *= mask;

  // setOutputColor(oColor);
}