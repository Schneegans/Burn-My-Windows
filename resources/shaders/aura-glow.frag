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

// SPDX-FileCopyrightText: Justin Garza <JGarza9788@gmail.com>
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

// The width of the fading effect is loaded from the settings.
uniform float uColorSpeed;
uniform bool uRandomColorOffset;
uniform float uColorOffset;
uniform float uColorSaturation;
uniform float uFadeOut;
uniform float uBlur;
uniform vec2 uSeed;


/*
this controls the end shape
-5.0 large Star
-3.0 Star
1.0 Dimond
2.0 Circle
3.0 Squircle 
5.0 Square
*/
uniform float uEdgeShape;

//the size of the edge color
uniform float uEdgeSize;

//soft <--> hard
uniform float uEdgeHardness;


// A simple blur function
vec4 blur(vec2 uv, float radius, float samples) {
  vec4 color = vec4(0.0);

  const float tau        = 6.28318530718;
  const float directions = 15.0;

  for (float d = 0.0; d < tau; d += tau / directions) {
    for (float s = 0.0; s < 1.0; s += 1.0 / samples) {
      vec2 offset = vec2(cos(d), sin(d)) * radius * (1.0 - s) / uSize;
      color += getInputColor(uv + offset);
    }
  }

  return color / samples / directions;
}

void main() {

    // This gradually dissolves from [1..0] from the outside to the center. We
    // switch the direction for opening and closing.
    float progress = uForOpening ? uProgress : 1.0 - uProgress ;

    //adjusting for Gnome
    if (uPadding > 0.0)
    {
        progress = remap(
            progress, 0.0, ((uSize.x - (uPadding*2.0)) / uSize.x) 
            ,0.0, 1.0 
            );
    }
    

    // Get the color from the window texture.
    vec4 oColor = getInputColor(iTexCoord.st);
    
    // Calculate the aspect ratio of the render area
    float aspect = uSize.x / uSize.y;

    //standard uv
    vec2 uv = iTexCoord.st;

    // tuv is for when progress is near 0
    vec2 tuv = uv;
    tuv -= 0.5; // Shift UV coordinates to center (from [-0.5 to 0.5])
    tuv.x *= aspect; // Scale x-coordinate to match aspect ratio
    tuv += 0.5; // Shift UV coordinates back (from [0 to 1])
    
    //mixing the UVs
    uv = mix(tuv,uv,easeOutExpo(progress));

    // this controls the shape 
    // -1.0 would be a diamond-ish
    // 0.0 would be a rounded diamond
    // 1.0 would be a circle
    // 2.0  will be sqircle
    // 1000.0 will be very square
    float p = mix(uEdgeShape,1000.0,
        easeInExpo(progress)
        );

    //this will be used later to make a mask
    float m = mix(
        0.0,
        1.0,
        clamp(
            pow(abs(uv.x-0.5)*2.0,p) + pow(abs(uv.y-0.5)*2.0,p),0.0,1.0
        )
        );


    //this calculates the edge of the effect
    float edge = abs(m-progress) ;
    float e = mix(0.0,uEdgeSize,1.0 - progress);
    edge = remap(edge,0.0,e,0.0,1.0);
    edge = clamp(edge,0.0,1.0);
    edge = 1.0 - edge;

    //this is the mask
    float mask = (m > progress) ? 0.0 : 1.0 ;

    //we need two of these
    float mask0 = mix(mask,mask+edge,1.0 - uEdgeHardness);
    float mask1 = mix(edge,edge*mask,uEdgeHardness);

    //calculate color
    vec3 color = cos(progress*uColorSpeed+uv.xyx+vec3(0,2,4)).xyz;
    //coloroffset 
    float colorOffset = (uRandomColorOffset) ? hash12(uSeed) : uColorOffset ;
    color = offsetHue(color, colorOffset + 0.10);
    //clamp and saturate
    color = clamp(color * uColorSaturation,vec3(0.0),vec3(1.0));
     
    //save this for later
    float oColorAlpha = oColor.a;

    //blur-ify
    if (uBlur > 0.0)
    {
        //used for blur later ... 
        //calculate this before saturating it
        float b = (color.r + color.g + color.b)/3.0;

        
        oColor = blur( iTexCoord.st, b * uBlur * mask1, 7.0);
    }

    //apply masks and colors
    oColor.a *= mask0;

    //i was doing this to try to adjust for light mode
    // i don;t like the way these make the effect look
    //      ...maybe a toggle for it later
    /*
    float oColorPercent = (oColor.r + oColor.g + oColor.b)/3.0;
    oColor.r = mix(oColor.r , 1.0 - oColor.r, mask1 * oColorPercent);
    oColor.g = mix(oColor.g , 1.0 - oColor.g, mask1 * oColorPercent);
    oColor.b = mix(oColor.b , 1.0 - oColor.b, mask1 * oColorPercent);
    // --or
    oColor.r = mix(oColor.r , 0.0, mask1 * oColorPercent);
    oColor.g = mix(oColor.g , 0.0, mask1 * oColorPercent);
    oColor.b = mix(oColor.b , 0.0, mask1 * oColorPercent);
    */
    
    oColor += mask1 * vec4(color.rgb,1.0);
    oColor.a *= oColorAlpha;

    //i want to fade out the last ~10% of the animation
    float lastfade = remap(progress,0.0,uFadeOut,0.0,1.0);
    lastfade = clamp(lastfade,0.0,1.0);
    lastfade = easeInSine(lastfade);
    
    //apply the lastfade
    oColor.a *= lastfade;

    setOutputColor(oColor);

}