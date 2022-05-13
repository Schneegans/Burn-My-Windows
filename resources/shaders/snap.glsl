// We simply inverse the progress for opening windows.
float progress = uForOpening ? uProgress : 1.0 - uProgress;

float gradient = cogl_tex_coord_in[0].t * ACTOR_SCALE - PADDING;
progress       = 2.0 - gradient - 2.0 * progress;
progress = progress + 0.25 - 0.5 * simplex2D((cogl_tex_coord_in[0].st + uSeed) * 2.0);
progress = pow(max(0, progress), 2.0);

// This may help you to understand how this effect works.
// cogl_color_out = vec4(progress, 0, 0, 0);
// return;

cogl_color_out = vec4(0, 0, 0, 0);

for (float i = 0; i < DUST_LAYERS; ++i) {

  // Create a random direction.
  float factor   = DUST_LAYERS == 1 ? 0 : i / (DUST_LAYERS - 1);
  float angle    = 123.123 * (uSeed.x + factor);
  vec2 direction = vec2(1.0, 0.0);
  direction      = rotate(direction, angle);

  // Flip direction for one side of the window.
  vec2 coords = cogl_tex_coord_in[0].st * ACTOR_SCALE - PADDING - 0.5;
  if (getWinding(direction, coords) > 0) {
    direction *= -1;
  }

  // Flip direction for half the layers.
  if (factor > 0.5) {
    direction *= -1;
  }

  // We grow the layer along the random direction, shrink it orthogonally to it
  // and scale it up slightly.
  float dist = distToLine(vec2(0.0), direction, coords);
  vec2 grow  = direction * dist * mix(0, GROW_INTENSITY, progress);
  vec2 shrink =
    vec2(direction.y, -direction.x) * dist * mix(0, SHRINK_INTENSITY, progress);
  float scale = mix(1.0, 1.05, factor * progress);
  coords      = (coords + grow + shrink) / scale;

  // Add some wind.
  coords.x += WIND_INTENSITY * progress * (uForOpening ? 1.0 : -1.0);

  // Now check wether there is actually something in the current dust layer at
  // the coords position.
  vec2 dustCoords = (coords + uSeed) * uSize / uDustScale / 100.0;
  vec2 dustMap    = texture2D(uDustTexture, dustCoords).rg;
  float dustGroup = floor(dustMap.g * DUST_LAYERS * 0.999);

  if (dustGroup == i) {

    // Get the window color.
    vec4 windowColor = texture2D(uTexture, coords + 0.5);

    // Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
    if (windowColor.a > 0) {
      windowColor.rgb /= windowColor.a;
    }

    // Fade the window color to uDustColor.
    vec3 dustColor  = mix(windowColor.rgb, uDustColor.rgb, uDustColor.a);
    windowColor.rgb = mix(windowColor.rgb, dustColor, progress);

    // Dissolve and blend the layers.
    if (dustMap.x - progress > 0) {
      cogl_color_out = windowColor;
    }
  }
}