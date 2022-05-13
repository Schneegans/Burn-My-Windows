vec2 coords = cogl_tex_coord_in[0].st;
coords.y    = coords.y * (uOverShoot + 1.0) - uOverShoot * 0.5;

// Get a cool matrix effect. See comments for those methods above.
vec2 rainMask  = getRain(coords);
float textMask = getText(coords);

// Get the window texture.
cogl_color_out = texture2D(uTexture, coords);

// Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
if (cogl_color_out.a > 0) {
  cogl_color_out.rgb /= cogl_color_out.a;
}

// Fade the window according to the effect mask.
cogl_color_out.a *= rainMask.y;

// This is used to fade out the remaining trails in the end.
float finalFade =
  1 - clamp((uProgress - FINAL_FADE_START_TIME) / (1 - FINAL_FADE_START_TIME), 0, 1);
float rainAlpha = finalFade * rainMask.x;

// Add the matrix effect to the window.
vec4 text =
  vec4(mix(uTrailColor, uTipColor, min(1, pow(rainAlpha + 0.1, 4))), rainAlpha* textMask);
cogl_color_out = alphaOver(cogl_color_out, text);

// These are pretty useful for understanding how this works.
// cogl_color_out = vec4(vec3(textMask), 1);
// cogl_color_out = vec4(vec3(rainMask.x), 1);
// cogl_color_out = vec4(vec3(rainMask.y), 1);