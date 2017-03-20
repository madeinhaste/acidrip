// grid //
attribute vec2 position;
uniform mat4 mvp;
uniform vec4 color;

// grid.vertex //
void main() {
    gl_Position = mvp * vec4(position.x, 0, position.y, 1);
}

// grid.fragment //
void main() {
    gl_FragColor = color;
}


// simple //
attribute vec3 position;
uniform mat4 mvp;
uniform vec4 color;

// simple.vertex //
void main() {
    gl_Position = mvp * vec4(position, 1.0);
}

// simple.fragment //
void main() {
    gl_FragColor = color;
}



// lyric //
attribute vec2 coord;
uniform mat4 m_vp;
uniform mat4 m_obj;
uniform vec4 color;
uniform float time;

// lyric.vertex //
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec2 distort(vec2 co, float time) {
    vec2 o;
    float scale = 0.015;
    o.x = co.x + scale * (rand(vec2(time + co.x, co.y)) - 0.5);
    o.y = co.y + scale * (rand(vec2(time + co.x + 4.2323, co.y + 83.2392)) - 0.5);
    return o;
}

void main() {
    vec3 P = vec3(coord.x, coord.y, 0.0);
    P.xy = distort(P.xy, 0.000002*time);
    gl_Position = m_vp * m_obj * vec4(P, 1.0);
}

// lyric.fragment //
void main() {
    gl_FragColor = color;
}
