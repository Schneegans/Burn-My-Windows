// The Shell.GLSLEffect uses straight alpha blending. This helper method allows
// compositing color values in the shader in the same way.
vec4 alphaOver(vec4 under, vec4 over) {
  float alpha = over.a + under.a * (1.0 - over.a);
  return vec4((over.rgb * over.a + under.rgb * under.a * (1.0 - over.a)) / alpha, alpha);
}