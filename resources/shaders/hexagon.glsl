// We simply inverse the progress for opening windows.
float progress = uForOpening ? 1.0 - uProgress : uProgress;

// Add some smooth noise to the progress so that not every tile behaves the
// same.
float noise = simplex2D(cogl_tex_coord_in[0].st + uSeed);
progress    = clamp(mix(noise - 1.0, noise + 1.0, progress), 0.0, 1.0);

// glowProgress fades in in the first half of the animation, tileProgress fades
// in in the second half.
float glowProgress = smoothstep(0, 1, clamp(progress / 0.5, 0, 1));
float tileProgress = smoothstep(0, 1, clamp((progress - 0.5) / 0.5, 0, 1));

vec2 texScale = 0.1 * uSize / uScale;
vec4 hex      = getHexagons(cogl_tex_coord_in[0].st * texScale);

if (tileProgress > hex.z) {

  // Crop outer parts of the shrinking tiles.
  cogl_color_out.a = 0.0;

} else {

  // Make the tiles shrink by offsetting the texture lookup towards the edge
  // of the cell.
  vec2 lookupOffset = tileProgress * hex.xy / texScale / (1.0 - tileProgress);
  cogl_color_out    = texture2D(uTexture, cogl_tex_coord_in[0].st + lookupOffset);

  // Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
  if (cogl_color_out.a > 0) {
    cogl_color_out.rgb /= cogl_color_out.a;
  }

  vec4 glow = uGlowColor;
  vec4 line = uLineColor;

  // For the glow, we accumulate a few exponentially scaled versions of hex.w.
  glow.a *= pow(hex.w, 20.0) * 10.0 + pow(hex.w, 10.0) * 5.0 + pow(hex.w, 2.0) * 0.5;

  // Using step(uLineWidth, hex.z) would be simpler, but the below creates some
  // fake antialiasing.
  line.a *= 1.0 - smoothstep(uLineWidth * 0.02 * 0.5, uLineWidth * 0.02, hex.z);

  // Fade in the glowing lines.
  glow.a *= glowProgress;
  line.a *= glowProgress;

  // Do not add the hexagon lines onto transparent parts of the window.
  glow *= cogl_color_out.a;
  line *= cogl_color_out.a;

  if (uAdditiveBlending) {
    cogl_color_out.rgb += glow.rgb * glow.a;
    cogl_color_out.rgb += line.rgb * line.a;
  } else {
    cogl_color_out.rgb = mix(cogl_color_out.rgb, glow.rgb, glow.a);
    cogl_color_out.rgb = mix(cogl_color_out.rgb, line.rgb, line.a);
  }
}