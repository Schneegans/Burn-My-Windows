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

float getAbsoluteEdgeMask(float fadePixels) {
  vec2 uv = cogl_tex_coord_in[0].st * uSize;
  return getEdgeMask(uv, uSize, fadePixels);
}

float getRelativeEdgeMask(float fadeAmount) {
  vec2 uv = cogl_tex_coord_in[0].st;
  return getEdgeMask(uv, vec2(1.0), fadeAmount);
}