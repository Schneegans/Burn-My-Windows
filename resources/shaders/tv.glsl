float progress = uForOpening ? 1.0 - easeOutQuad(uProgress) : easeOutQuad(uProgress);

// Scale down the window vertically.
float scale = 1.0 / mix(1.0, SCALING, progress) - 1.0;
vec2 coords = cogl_tex_coord_in[0].st;
coords.y    = coords.y * (scale + 1.0) - scale * 0.5;

// All of these are in [0..1] during the different stages of the animation.
// tb refers to the top-bottom animation.
// lr refers to the left-right animation.
// ff refers to the final fade animation.
float tbProgress = smoothstep(0, 1, clamp(progress / TB_TIME, 0, 1));
float lrProgress = smoothstep(0, 1, clamp((progress - LR_DELAY) / LR_TIME, 0, 1));
float ffProgress = smoothstep(0, 1, clamp((progress - 1.0 + FF_TIME) / FF_TIME, 0, 1));

// This is a top-center-bottom gradient in [0..1..0]
float tb = coords.y * 2;
tb       = tb < 1 ? tb : 2 - tb;

// This is a left-center-right gradient in [0..1..0]
float lr = coords.x * 2;
lr       = lr < 1 ? lr : 2 - lr;

// Combine the progress values with the gradients to create the alpha masks.
float tbMask = 1 - smoothstep(0, 1, clamp((tbProgress - tb) / BLUR_WIDTH, 0, 1));
float lrMask = 1 - smoothstep(0, 1, clamp((lrProgress - lr) / BLUR_WIDTH, 0, 1));
float ffMask = 1 - smoothstep(0, 1, ffProgress);

// Assemble the final alpha value.
float mask = tbMask * lrMask * ffMask;

cogl_color_out = texture2D(uTexture, coords);

// Shell.GLSLEffect uses straight alpha. So we have to convert from premultiplied.
if (cogl_color_out.a > 0) {
  cogl_color_out.rgb /= cogl_color_out.a;
}

cogl_color_out.rgb =
  mix(cogl_color_out.rgb, uColor* cogl_color_out.a, smoothstep(0, 1, progress));
cogl_color_out.a *= mask;

// These are pretty useful for understanding how this works.
// cogl_color_out = vec4(vec3(tbMask), 1);
// cogl_color_out = vec4(vec3(lrMask), 1);
// cogl_color_out = vec4(vec3(ffMask), 1);
// cogl_color_out = vec4(vec3(mask), 1);