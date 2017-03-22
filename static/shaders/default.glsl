// grid //
attribute vec2 position;

// grid.vertex //
uniform mat4 mvp;

void main() {
    gl_Position = mvp * vec4(position.x, 0, position.y, 1);
}

// grid.fragment //
uniform vec4 color;

void main() {
    gl_FragColor = color;
}


// simple //
attribute vec3 position;

// simple.vertex //
uniform mat4 mvp;

void main() {
    gl_Position = mvp * vec4(position, 1.0);
}

// simple.fragment //
uniform vec4 color;
void main() {
    gl_FragColor = color;
}



// lyric //
attribute vec2 coord;

// lyric.vertex //
uniform mat4 m_vp;
uniform mat4 m_obj;
uniform float time;

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
uniform vec4 color;
void main() {
    gl_FragColor = color;
}




// packshot //
attribute vec2 coord;
varying vec2 v_texcoord;
varying vec3 v_view;

// packshot.vertex //
uniform mat4 m_vp;
uniform mat4 m_obj;
uniform vec3 view_pos;
uniform float texpos;

void main() {
    vec3 P = vec3(coord.x - 0.5, coord.y, 0.0);
    P = (m_obj * vec4(P, 1.0)).xyz;
    v_view = (view_pos - P);
    gl_Position = m_vp * vec4(P, 1.0);
    v_texcoord = vec2(0.5*(coord.x + texpos), coord.y);
}

// packshot.fragment //
uniform sampler2D s_image;
uniform vec2 fog_range;
uniform vec3 fog_color;

void main() {
    // FIXME normals?? fog??
    vec4 Ct = texture2D(s_image, v_texcoord.xy);
    gl_FragColor = Ct;

    {
        float fog_start = fog_range[0];
        float fog_end = fog_range[1];
        float d = length(v_view);
        float fog_factor = (fog_end - d) / (fog_end - fog_start);
        fog_factor = clamp(fog_factor, 0.0, 1.0);
        gl_FragColor.rgb = mix(fog_color, gl_FragColor.rgb, fog_factor);
    }
}
