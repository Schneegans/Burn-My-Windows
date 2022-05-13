// Get a noise value which moves vertically in time.
vec2 uv = cogl_tex_coord_in[0].st * uSize / vec2(400, 600) / uScale;
uv.y += uTime * uMovementSpeed;

float noise = u3DNoise ? simplex3DFractal(vec3(uv * 4.0, uTime* uMovementSpeed * 1.5))
                       : simplex2DFractal(uv * 4.0);

// Modulate noise by effect mask.
vec2 effectMask = effectMask(HIDE_TIME, FADE_WIDTH, EDGE_FADE);
noise *= effectMask.y;

// Map noise value to color.
vec4 fire = getFireColor(noise);

// Get the window texture.
cogl_color_out = texture2D(uTexture, cogl_tex_coord_in[0].st);

// Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
if (cogl_color_out.a > 0) {
  cogl_color_out.rgb /= cogl_color_out.a;
}

// Fade the window according to the effect mask.
cogl_color_out.a *= effectMask.x;

// Add the fire to the window.
cogl_color_out = alphaOver(cogl_color_out, fire);

// These are pretty useful for understanding how this works.
// cogl_color_out = vec4(vec3(noise), 1);
// cogl_color_out = vec4(vec3(effectMask.x), 1);
// cogl_color_out = vec4(vec3(effectMask.y), 1);