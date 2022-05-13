float progress = uForOpening ? 1.0 - uProgress : uProgress;

// Warp the texture coordinates to create a blow-up effect.
vec2 coords = cogl_tex_coord_in[0].st * 2.0 - 1.0;
float dist  = length(coords);
coords      = (coords / dist * pow(dist, 1.0 + uWarpIntensity)) * 0.5 + 0.5;
coords      = mix(cogl_tex_coord_in[0].st, coords, progress);

// Accumulate several random scratches. The color in the scratch map refers to the
// relative time when the respective part will become invisible. Therefore we can
// add a value to make the scratch appear later.
float scratchMap = 1.0;
for (int i = 0; i < uNumClaws; ++i) {
  vec2 uv     = getClawUV(coords, 1.0 / uClawSize, uSeed * (i + 1));
  float delay = i / uNumClaws * MAX_SPAWN_TIME;
  scratchMap  = min(scratchMap, clamp(texture2D(uClawTexture, uv).r + delay, 0, 1));
}

// Get the window texture. We shift the texture lookup by the local derivative of
// the claw texture in order to mimic some folding distortion.
vec2 offset    = vec2(dFdx(scratchMap), dFdy(scratchMap)) * progress * 0.5;
cogl_color_out = texture2D(uTexture, coords + offset);

// Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
if (cogl_color_out.a > 0) {
  cogl_color_out.rgb /= cogl_color_out.a;
}

// Add colorful flashes.
float flashIntensity = 1.0 / FLASH_INTENSITY * (scratchMap - progress) + 1;
if (flashIntensity < 0 || flashIntensity >= 1) {
  flashIntensity = 0;
}

// Hide flashes where there is now window.
vec4 flash = uFlashColor;
flash.a *= flashIntensity * cogl_color_out.a * (1.0 - progress);

// Hide scratched out parts.
cogl_color_out.a *= (scratchMap > progress ? 1 : 0);

// Add flash color.
cogl_color_out = alphaOver(cogl_color_out, flash);

// Fade out the remaining shards.
float fadeProgress = smoothstep(0, 1, (progress - 1.0 + FF_TIME) / FF_TIME);
cogl_color_out.a *= sqrt(1 - fadeProgress * fadeProgress);

// These are pretty useful for understanding how this works.
// cogl_color_out = vec4(vec3(flashIntensity), 1);
// cogl_color_out = vec4(vec3(scratchMap), 1);