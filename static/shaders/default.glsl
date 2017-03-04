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
    float scale = 100.0;
    gl_Position = mvp * vec4(scale * position, 1.0);
}

// simple.fragment //
void main() {
    gl_FragColor = color;
}
