float distToLine(vec2 origin, vec2 direction, vec2 point) {
  vec2 perpendicular = vec2(direction.y, -direction.x);
  return abs(dot(normalize(perpendicular), origin - point));
}

float getWinding(vec2 a, vec2 b) { return cross(vec3(a, 0.0), vec3(b, 0.0)).z; }

vec2 rotate(vec2 a, float angle) {
  return vec2(a.x * cos(angle) - a.y * sin(angle), a.x * sin(angle) + a.y * cos(angle));
}