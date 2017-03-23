import {vec4, mat4} from 'gl-matrix';
import {fetch_msgpack_gz, clamp} from './utils';
import {get_program, new_element_buffer, new_vertex_buffer, bind_element_buffer, bind_vertex_buffer} from './webgl';

var color = vec4.create();

export class Lyric {
    constructor(o) {
        this.buffers = {
            v: null,
            e: null
        };
        this.elem_count = 0;
        this.start_time = 0;
        this.mat = mat4.create();
        this.color = vec4.create();
        this.color2 = vec4.create();
        this.fade_time = 0;
        this.speed = 0.02;

        this.setup(o);
    }

    setup(o) {
        var mat = this.mat;
        mat4.identity(mat);
        mat4.translate(mat, mat, o.pos);
        mat4.scale(mat, mat, [o.scale, o.scale, o.scale]);
        mat4.rotateY(mat, mat, o.rotate);

        vec4.copy(this.color, o.color);
        vec4.copy(this.color2, o.color2);

        this.speed = o.speed;

        // load the vertex data
        var url = `data/${o.id}.mpz`;
        fetch_msgpack_gz(url).then(d => this.init(d));
    }

    start() {
        this.start_time = performance.now();
        this.fade_time = 0;
    }

    fade() {
        this.fade_time = performance.now();
    }

    init(strokes) {
        var v = [];
        var e = [];
        var idx = 0;
        strokes.forEach(points => {
            for (var i = 0; i < points.length; i += 2) {
                var x =  points[i + 0];
                var y = -points[i + 1];
                if (i)
                    e.push(idx - 1, idx);
                v.push(x, y);
                ++idx;
            }
        });
        console.assert(idx < 65536);

        this.buffers.e = new_element_buffer(new Uint16Array(e));
        this.buffers.v = new_vertex_buffer(new Float32Array(v));
        this.elem_count = e.length;
    }

    draw(env) {
        if (!this.elem_count)
            return;

        if (!this.start_time)
            return;

        var now = (performance.now() - this.start_time) / 1000;
        vec4.copy(color, this.color);

        if (this.fade_time) {
            var fade = (performance.now() - this.fade_time) / 3000;
            fade = clamp(1 - fade, 0, 1);
            if (fade == 0) return;

            color[3] *= fade * fade;
        }

        var noise_time = 1.0 * now;

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        //gl.lineWidth(2);

        var pgm = get_program('lyric').use();
        pgm.uniformMatrix4fv('m_vp', env.camera.mvp);
        pgm.uniformMatrix4fv('m_obj', this.mat);

        pgm.uniform4fv('color', color);
        pgm.uniform1f('time', noise_time);

        bind_vertex_buffer(this.buffers.v);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);
        bind_element_buffer(this.buffers.e);

        var time = this.speed * now;
        var count = Math.min(this.elem_count, Math.floor(time * this.elem_count));

        gl.drawElements(gl.LINES, count, gl.UNSIGNED_SHORT, 0);
        gl.disable(gl.BLEND);
    }
}
