float progress = easeOutQuad(uProgress);

vec4 masks       = getMasks(progress);
vec4 windowColor = texture2D(uTexture, cogl_tex_coord_in[0].st);

// Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
if (windowColor.a > 0) {
  windowColor.rgb /= windowColor.a;
}

// Dissolve window to effect color / transparency.
cogl_color_out.rgb = mix(uColor, windowColor.rgb, 0.5 * masks.w + 0.5);
cogl_color_out.a   = windowColor.a * masks.w;

// Add leading shower particles.
vec2 showerUV = cogl_tex_coord_in[0].st + vec2(0, -0.7 * progress / SHOWER_TIME);
showerUV *= 0.02 * uSize / uScale;
float shower = pow(simplex2D(showerUV), 10.0);
cogl_color_out.rgb += uColor * shower * masks.x;
cogl_color_out.a += shower * masks.x;

// Add trailing streak lines.
vec2 streakUV = cogl_tex_coord_in[0].st + vec2(0, -progress / SHOWER_TIME);
streakUV *= vec2(0.05 * uSize.x, 0.001 * uSize.y) / uScale;
float streaks = simplex2DFractal(streakUV) * 0.5;
cogl_color_out.rgb += uColor * streaks * masks.y;
cogl_color_out.a += streaks * masks.y;

// Add glimmering atoms.
vec2 atomUV = cogl_tex_coord_in[0].st + vec2(0, -0.025 * progress / SHOWER_TIME);
atomUV *= 0.2 * uSize / uScale;
float atoms = pow((simplex3D(vec3(atomUV, uTime))), 5.0);
cogl_color_out.rgb += uColor * atoms * masks.z;
cogl_color_out.a += atoms * masks.z;

// These are pretty useful for understanding how this works.
// cogl_color_out = vec4(masks.rgb, 1.0);
// cogl_color_out = vec4(vec3(masks.x), 1.0);
// cogl_color_out = vec4(vec3(masks.y), 1.0);
// cogl_color_out = vec4(vec3(masks.z), 1.0);
// cogl_color_out = vec4(vec3(masks.w), 1.0);
// cogl_color_out = vec4(vec3(shower), 1.0);
// cogl_color_out = vec4(vec3(streaks), 1.0);
// cogl_color_out = vec4(vec3(atoms), 1.0);