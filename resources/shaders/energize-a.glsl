vec2 masks       = getMasks();
vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);

// Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
if (windowColor.a > 0) {
  windowColor.rgb /= windowColor.a;
}

// Dissolve window to effect color / transparency.
cogl_color_out.rgb = mix(uColor, windowColor.rgb, 0.2 * masks.y + 0.8);
cogl_color_out.a   = windowColor.a * masks.y;

vec2 scaledUV = (cogl_tex_coord_in[0].st - 0.5) * (1.0 + 0.1 * uProgress);
scaledUV /= uScale;

// Add molecule particles.
vec2 uv = scaledUV + vec2(0, 0.1 * uTime);
uv *= 0.010598 * vec2(0.5 * uSize.x, uSize.y);
float particles = 0.2 * pow((simplex3D(vec3(uv, 0.0 * uTime))), 3.0);

// Add more molecule particles.
for (int i = 1; i <= 3; ++i) {
  vec2 uv     = scaledUV * 0.12154 / pow(1.5, i) * uSize;
  float atoms = simplex3D(vec3(uv, 2.0 * uTime / i));
  particles += 0.5 * pow(0.2 * (1.0 / (1.0 - atoms) - 1.0), 2);
}

cogl_color_out.rgb += uColor * particles * masks.x;
cogl_color_out.a += particles * masks.x;

// These are pretty useful for understanding how this works.
// cogl_color_out = vec4(masks, 0.0, 1.0);
// cogl_color_out = vec4(vec3(masks.x), 1.0);
// cogl_color_out = vec4(vec3(masks.y), 1.0);
// cogl_color_out = vec4(vec3(particles), 1.0);