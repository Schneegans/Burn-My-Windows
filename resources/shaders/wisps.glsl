float progress = uForOpening ? 1.0 - uProgress : uProgress;

// Get the color of the window.
cogl_color_out = texture2D(uTexture, cogl_tex_coord_in[0].st);

// Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
if (cogl_color_out.a > 0) {
  cogl_color_out.rgb /= cogl_color_out.a;
}

// Compute several layers of moving wisps.
vec2 uv = (cogl_tex_coord_in[0].st - 0.5) / mix(1.0, 0.5, progress) + 0.5;
uv /= uScale;
float wisps = 0;
for (int i = 0; i < WISPS_LAYERS; ++i) {
  wisps += getWisps(uv * 0.3, WISPS_SPACING, uSeed * (i + 1));
}

// Compute shrinking edge mask.
float mask = getRelativeEdgeMask(mix(0.01, 0.5, progress));

// Compute three different progress values.
float wispsIn = smoothstep(0, 1, clamp(progress / WISPS_IN_TIME, 0, 1));
float wispsOut =
  smoothstep(0, 1, clamp((progress - WISPS_IN_TIME) / (1.0 - WISPS_IN_TIME), 0, 1));
float windowOut = smoothstep(0, 1, clamp(progress / WINDOW_OUT_TIME, 0, 1));

// Use a noise function to dissolve the window.
float noise = smoothstep(1.0, 0.0, abs(2.0 * simplex2DFractal(uv * uSize / 250) - 1.0));
float windowMask = 1.0 - (windowOut < 0.5 ? mix(0.0, noise, windowOut * 2.0)
                                          : mix(noise, 1.0, windowOut * 2.0 - 1.0));
cogl_color_out.a *= windowMask * mask;

// Add the wisps.
vec4 wispColor = wisps * vec4(uColor, min(wispsIn, 1.0 - wispsOut) * mask);
cogl_color_out = alphaOver(cogl_color_out, wispColor);

// These are pretty useful for understanding how this works.
// cogl_color_out = vec4(vec3(windowMask), 1.0);
// cogl_color_out = vec4(vec3(wisps), 1.0);
// cogl_color_out = vec4(vec3(noise), 1.0);
// cogl_color_out = vec4(vec3(mask*min(wispsIn, 1.0 - wispsOut)), 1.0);