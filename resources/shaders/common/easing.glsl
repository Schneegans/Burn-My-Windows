// This provides some basic easing function. More can be added if required!
// Taken from here:
// https://gitlab.gnome.org/GNOME/mutter/-/blob/main/clutter/clutter/clutter-easing.c

float easeOutQuad(float x) { return -1.0 * x * (x - 2); }