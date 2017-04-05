import {vec3, mat4} from 'gl-matrix';
import {get_program, new_vertex_buffer, bind_vertex_buffer} from './webgl';
import {clamp} from './utils';

export class Player {
    constructor() {
        this.pos = vec3.create();
        this.dir = 0;
        this.mat = mat4.create();
        this.geom = null;
        this.pgm = get_program('simple');
        this.level = null;
        this.collide = true;
        this.area = 0;

        this.mvp = mat4.create();
        this.inverse_mvp = mat4.create();

        this.touch = {
            rotate: 0,
            rotating: false,
            advance: 0
        };
    }

    move(x, y, z) {
        this.pos[0] += x || 0;
        this.pos[1] += y || 0;
        this.pos[2] += z || 0;
    }

    rotate(angle) {
        this.dir += angle;
    }

    set_area(area) {
        if (this.area == area)
            return;

        this.on_leave_area(this.area);
        this.area = area;
        this.on_enter_area(this.area);
    }

    on_leave_area(area) {
    }

    on_enter_area(area) {
    }

    advance(dist) {
        var theta = -0.5 * Math.PI * this.dir;
        var x = this.pos[0] + dist * Math.cos(theta);
        var y = this.pos[1] + dist * Math.sin(theta);
        var z = this.pos[2];

        if (this.collide && this.level) {
            var [tile, h] = this.level.get_tile(x, y, z);

            if (!tile) {
                // absent tile
                return;
            }

            if (tile.area == 1) {
                // collision
                return;
            }

            this.set_area(tile.area);
        } else {
            var h = 0.0;
        }

        h = Math.max(h, 0);

        var PLAYER_HEIGHT = 0.5;

        this.pos[0] = x;
        this.pos[1] = y;
        this.pos[2] = h + PLAYER_HEIGHT;
    }

    draw(env) {
        if (!this.geom) {
            this.create_geom();
        }

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        var pgm = get_program('simple').use();

        var mat = this.mat;
        this.get_matrix(mat, 0.5/1024);
        mat4.multiply(mat, env.camera.mvp, mat);

        pgm.uniformMatrix4fv('mvp', mat);
        pgm.uniform4f('color', 1, 0, 0, 1);

        bind_vertex_buffer(this.geom.buffer);
        pgm.vertexAttribPointer('position', 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, this.geom.count);
    }

    get_matrix(mat, scale) {
        var tx = this.pos[0];
        var ty = this.pos[1];
        var tz = this.pos[2];
        mat4.identity(mat);
        mat4.translate(mat, mat, [tx, tz, -ty]);
        mat4.scale(mat, mat, [scale, scale, scale]);
        mat4.rotateY(mat, mat, -0.5 * this.dir * Math.PI);
    }

    create_geom() {
        var radius = 600;
        var width = 100;
        var steps = 30;

        var verts = [];

        function push_vert(u, radius) {
            var theta = 2 * Math.PI * u;
            verts.push(
                radius * Math.cos(theta),
                0,
                radius * Math.sin(theta));
        }

        var r0 = radius - width;
        var r1 = radius + width;
        for (var i = 0; i < steps; ++i) {
            var u0 = i / steps;
            var u1 = (i + 1) / steps;

            push_vert(u0, r0);
            push_vert(u0, r1);
            push_vert(u1, r1);

            push_vert(u0, r0);
            push_vert(u1, r1);
            push_vert(u1, r0);
        }

        push_vert(-0.03, 800);
        push_vert(0.03, 800);
        push_vert(0, 1024);

        verts = new Float32Array(verts);
        this.geom = {
            buffer: new_vertex_buffer(verts),
            count: verts.length/3
        };
    }

    check_keys() {
        var rotate_speed = 1/64;
        var advance_speed = 0.1;

        if (key.shift) {
            advance_speed *= 3;
        }

        if (key.control) {
            advance_speed *= 0.1;
        }

        if (key.isPressed('left')) {
            this.rotate(-rotate_speed);
        }

        if (key.isPressed('right')) {
            this.rotate(rotate_speed);
        }

        if (key.isPressed('up')) {
            this.advance(advance_speed);
        }

        if (key.isPressed('down')) {
            this.advance(-advance_speed);
        }

        // touch stuff
        this.rotate(this.touch.rotate);

        /*
        if (!this.touch.rotating) {
            this.touch.rotate *= 0.2;
            this.touch.advance *= 0.2;
        }

        */

        if (Math.abs(this.touch.advance) > 0.1) {
            var a = clamp(this.touch.advance, -advance_speed, advance_speed);
            this.advance(a);
        }
    }
}
