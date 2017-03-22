import {vec4, mat4} from 'gl-matrix';
import {fetch_msgpack, clamp} from './utils';
import {get_program, new_vertex_buffer, bind_vertex_buffer, load_texture} from './webgl';

var color = vec4.create();
var quad = new Float32Array([ 0, 0, 1, 0, 0, 1, 1, 1 ]);
var buffer = null;
var texture = null;
var pgm = null;

function init_gl() {
    if (buffer)
        return;
    buffer = new_vertex_buffer(quad);
    texture = load_texture('images/packshots.jpg', {
        filter: gl.NEAREST,
        flip: true
    });
    pgm = get_program('packshot');
}

export class Packshot {
    constructor() {
        init_gl();
        this.mat = mat4.create();
        this.texpos = 0;
    }

    setup(o) {
        var mat = this.mat;
        mat4.identity(mat);
        mat4.translate(mat, mat, o.pos);
        mat4.scale(mat, mat, [o.scale, o.scale, o.scale]);
        mat4.rotateY(mat, mat, o.rotate);
        this.texpos = o.texpos;
    }

    draw(env) {
        if (!buffer)
            return;

        gl.enable(gl.DEPTH_TEST);

        pgm.use();
        pgm.uniformMatrix4fv('m_vp', env.camera.mvp);
        pgm.uniform3fv('view_pos', env.camera.view_pos);
        pgm.uniformMatrix4fv('m_obj', this.mat);
        pgm.uniformSampler2D('s_image', texture);
        pgm.uniform1f('texpos', this.texpos);
        pgm.uniform3f('fog_color', 0.05, 0, 0.15);
        pgm.uniform2f('fog_range', 10, 20);

        bind_vertex_buffer(buffer);
        pgm.vertexAttribPointer('coord', 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        //gl.disable(gl.DEPTH_TEST);
        //gl.drawArrays(gl.LINE_LOOP, 0, 4);
    }
}
