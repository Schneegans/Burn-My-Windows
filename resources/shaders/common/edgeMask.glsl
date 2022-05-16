// This method returns a mask which smoothly transitions towards zero when approaching
// the window's borders. There is a variant which takes the transition area width in
// pixels and one which takes this as a percentage.
float getEdgeMask(vec2 uv, vec2 maxUV, float fadeWidth) {
  float mask = 1.0;
  mask *= smoothstep(0, 1, clamp(uv.x / fadeWidth, 0, 1));
  mask *= smoothstep(0, 1, clamp(uv.y / fadeWidth, 0, 1));
  mask *= smoothstep(0, 1, clamp((maxUV.x - uv.x) / fadeWidth, 0, 1));
  mask *= smoothstep(0, 1, clamp((maxUV.y - uv.y) / fadeWidth, 0, 1));

  return mask;
}

// Returns an edge mask which fades to zero at the boundaries of the actor. The width of
// the fade zone is given in pixels. This uses the standard uniforms uSize and uPadding.
// This means that the fading zone is not actually at the actors boundaries but at the
// position of the window border in the texture.
// The offset paramter controls whether the fading is placed inside the window borders
// (offset = 0), ontop the window borders (offset = 0.5) or outside the window borders
// (offset = 1).
float getAbsoluteEdgeMask(float fadePixels, float offset) {
  float padding = max(0, uPadding - fadePixels * offset);
  vec2 uv       = cogl_tex_coord_in[0].st * uSize - padding;
  return getEdgeMask(uv, uSize - 2.0 * padding, fadePixels);
}

// Returns an edge mask which fades to zero at the boundaries of the actor. The width of
// the fade zone is given relative to the actor size. This neither uses uSize and
// uPadding.
float getRelativeEdgeMask(float fadeAmount) {
  vec2 uv = cogl_tex_coord_in[0].st;
  return getEdgeMask(uv, vec2(1.0), fadeAmount);
}