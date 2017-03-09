import {vec3, mat4} from 'gl-matrix';
import {new_vertex_buffer, bind_vertex_buffer, get_program} from './webgl';

var trn = vec3.create();
var mat = mat4.create();

const VERTEX_BUFFER_SIZE = 1 << 16;

function alloc_buffer(size) {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, size, gl.STATIC_DRAW);
    return buf;
}

class VertexBuffer {
    constructor(size=VERTEX_BUFFER_SIZE) {
        this.buffer = alloc_buffer(size);
        this.size = size;
        this.dp = 0;
    }

    add_array(src) {
        if (this.dp + src.length > this.size)
            return -1;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, this.dp, src);

        var start = this.dp;
        this.dp += src.length;
        return start;
    }
}

export class StageRenderer {
    constructor() {
        this.env = null;
        this.stage = null;
        this.buffers = [];
        this.bound_buffer = null;
        this.pgm = null;
    }

    setup(env, stage) {
        this.env = env;
        this.stage = stage;
    }

    get_vertex_buffer(obj) {
        if (obj.vertex_buffer)
            return obj.vertex_buffer;

        const VERTEX_SIZE = 24;

        for (;;) {
            if (!this.buffers.length)
                this.buffers.push(new VertexBuffer);

            var vb = this.buffers[this.buffers.length - 1];
            console.assert(obj.vertex_array.length <= vb.size);

            var dp = vb.add_array(obj.vertex_array);
            if (dp >= 0) {
                obj.vertex_buffer = vb;
                obj.vertex_start = dp / VERTEX_SIZE;
                break;
            } else {
                this.buffers.push(new VertexBuffer);
            }
        }

        console.assert(obj.vertex_buffer);
        return obj.vertex_buffer;
    }

    draw_tmd_object(obj, mat) {
        /*
        var vb = this.get_vertex_buffer(obj);
        var pgm = this.pgm;

        if (vb !== this.bound_buffer) {
            bind_vertex_buffer(vb.buffer);
            pgm.vertexAttribPointer('position', 3, gl.SHORT, false, 24, 0);
            pgm.vertexAttribPointer('normal', 3, gl.SHORT, true, 24, 8);
            pgm.vertexAttribPointer('color', 3, gl.UNSIGNED_BYTE, true, 24, 16);
            pgm.vertexAttribPointer('texcoord', 2, gl.UNSIGNED_SHORT, false, 24, 20);
            this.bound_buffer = vb;
        }

        pgm.uniformMatrix4fv('m_obj', mat);
        gl.drawArrays(gl.TRIANGLES, obj.vertex_start, obj.vertex_count);
        */

        if (!obj.vertex_buffer) {
            obj.vertex_buffer = new_vertex_buffer(obj.vertex_array);
        }

        var pgm = this.pgm;
        bind_vertex_buffer(obj.vertex_buffer);
        pgm.vertexAttribPointer('position', 3, gl.SHORT, false, 24, 0);
        pgm.vertexAttribPointer('normal', 3, gl.SHORT, true, 24, 8);
        pgm.vertexAttribPointer('color', 3, gl.UNSIGNED_BYTE, true, 24, 16);
        pgm.vertexAttribPointer('texcoord', 2, gl.UNSIGNED_SHORT, false, 24, 20);

        pgm.uniformMatrix4fv('m_obj', mat);
        gl.drawArrays(gl.TRIANGLES, obj.vertex_start, obj.vertex_count);
    }

    draw_tile(tmd, tile, trn, tx, ty) {
        if (!tile.visible)
            return;

        var h = tile.height;

        const scale = 0.5/1024;
        mat4.identity(mat);

        tx += 0.5;
        ty += 0.5;

        mat4.translate(mat, mat, [trn[0] + tx, trn[2] - h, trn[1] - ty]);
        mat4.scale(mat, mat, [scale, scale, scale]);
        mat4.rotateY(mat, mat, -0.5 * tile.direction * Math.PI);

        var tmd_index = tile.tmd_index;
        var tmd_object = tmd.objects[tmd_index];

        //pgm.uniform3f('debug_color', (tile.collision & 0x80) ? 1 : 0, 0, 0);
        this.draw_tmd_object(tmd_object, mat);

        if (tile.extra) {
            this.draw_tile(tmd, tile.extra, trn, tx, ty);
        }
    }

    draw_lbd(lbd, trn) {
        var tile_index = 0;
        for (var ty = 0; ty < 20; ++ty) {
            for (var tx = 0; tx < 20; ++tx) {
                var tile = lbd.tiles[tile_index++];
                this.draw_tile(lbd.tmd, tile, trn, tx, ty);
            }
        }
    }

    draw() {
        var env = this.env;
        var stage = this.stage;

        if (!(env && stage))
            return;

        var tix = stage.tix;
        if (!tix.texture)
            return;

        var pgm = this.pgm = get_program('tmd').use();
        pgm.uniformMatrix4fv('m_vp', env.camera.mvp);

        pgm.uniform3fv('view_pos', env.camera.view_pos);
        pgm.uniform3fv('light_pos', env.light_pos);
        pgm.uniformSampler2D('s_tix', tix.texture);    // XXX

        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        this.bound_buffer = null;

        for (var lbd_index = 0; lbd_index < stage.lbd_count; ++lbd_index) {
            var lbd = stage.lbds[lbd_index];
            if (!lbd)
                continue;

            stage.get_lbd_translation(trn, lbd_index);
            this.draw_lbd(lbd, trn);
        }
    }
}
