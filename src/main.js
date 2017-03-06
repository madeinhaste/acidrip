import {BinaryReader, modulo} from './utils';
import {TIX} from './tix';
import {LBD} from './lbd';
import {Canvas3D} from './Canvas3D';
import {new_vertex_buffer, bind_vertex_buffer, get_program} from './webgl';
import {vec3, mat4} from 'gl-matrix';

window.main = function() {
    var canvas = new Canvas3D({
        antialias: false,
        extensions: [ 'OES_standard_derivatives' ],
        sources: [ 'shaders/tmd.glsl' ]
    });

    canvas.camera.far = 10000;

    // check gl & setup?
    console.assert(gl);

    var stages = null;
    var stage_index = 1;
    var lbd_index = 0;
    var lbd_count = 0;
    var lbd = null;
    var lbd_columns = 0;

    var lbds = [];

    var tix = new TIX;

    fetch('data/stages.json')
        .then(r => r.json())
        .then(obj => {
            stages = obj;
            next_stage(0);
        });

    function next_stage(dir) {
        stage_index = modulo(stage_index + dir, stages.length);
        var stage = stages[stage_index];
        lbd_count = stage.nlbds;
        load_tix();
        load_lbds(stage_index, lbd_count);
        lbd_columns = stage.columns || 0;

        //lbd_index = 0;
        //next_lbd(0);
    }

    function load_tix() {
        var tixname = `stg${pad(stage_index, 2)}/texa`;
        fetch(`data/cdi/${tixname}.tix`)
            .then(r => r.arrayBuffer())
            .then(buf => {
                var f = new BinaryReader(buf);
                tix.read(f);
                tix.update_texture();
                canvas.redraw();
            });
    }

    var $tix_canvas = $(tix.canvas).addClass('texture').hide();
    $('#main').append($tix_canvas);

    function destroy_lbd(lbd) {
        if (!lbd)
            return;

        lbd.tmd.objects.forEach(obj => {
            if (obj.vertex_buffer) {
                gl.deleteBuffer(obj.vertex_buffer);
                obj.vertex_buffer = null;
            }
        });
    }

    function pad(x, n) {
        var s = ''+x;
        while (s.length < n)
            s = '0' + s;
        return s;
    }

    function next_lbd(dir) {
        lbd_index = modulo(lbd_index + dir, lbd_count);

        var prefix = `stg${pad(stage_index, 2)}/`;
        load_lbd(`${prefix}/m${pad(lbd_index, 3)}`);
    }

    function load_lbd(name) {
        return fetch(`data/cdi/${name}.lbd`)
            .then(r => r.arrayBuffer())
            .then(buf => {
                destroy_lbd(lbd);

                var f = new BinaryReader(buf);
                lbd = new LBD;
                lbd.read(f);

                canvas.redraw();

                $('#debug').text(`${stages[stage_index].name} m${pad(lbd_index, 3)}`);
            });
    }

    var redraw2 = _.debounce(function() { canvas.redraw() }, 100);

    function load_lbds(stage_index, lbd_count) {
        _.each(lbds, destroy_lbd);
        lbds = [];

        function load_lbd(lbd_index) {
            var url = `data/cdi/stg${pad(stage_index, 2)}/m${pad(lbd_index, 3)}.lbd`;
            fetch(url)
                .then(r => r.arrayBuffer())
                .then(buf => {
                    var f = new BinaryReader(buf);
                    lbd = new LBD;
                    lbd.read(f);
                    lbds[lbd_index] = lbd;
                    redraw2();
                });
        }

        for (var lbd_index = 0; lbd_index < lbd_count; ++lbd_index) {
            lbds.push(null);
            load_lbd(lbd_index);
        }
    }

    key('left', () => {
        lbd_columns = Math.max(1, lbd_columns - 1);
        $('#debug').text('columns: ' + lbd_columns);
        canvas.redraw();
    });

    key('right', () => {
        lbd_columns = lbd_columns + 1;
        $('#debug').text('columns: ' + lbd_columns);
        canvas.redraw();
    });

    key('pageup', () => next_stage(1));
    key('pagedown', () => next_stage(-1));

    var mat = mat4.create();

    function draw_tmd_object(env, obj, mat) {
        if (!obj.vertex_buffer) {
            obj.vertex_buffer = new_vertex_buffer(obj.vertex_array);
        }

        var pgm = get_program('tmd').use();
        pgm.uniformMatrix4fv('m_vp', env.camera.mvp);
        pgm.uniform3fv('view_pos', env.camera.view_pos);
        pgm.uniform3fv('light_pos', env.light_pos);
        pgm.uniformSampler2D('s_tix', tix.texture);

        bind_vertex_buffer(obj.vertex_buffer);

        pgm.vertexAttribPointer('position', 3, gl.SHORT, false, 24, 0);
        pgm.vertexAttribPointer('normal', 3, gl.SHORT, true, 24, 8);
        pgm.vertexAttribPointer('color', 3, gl.UNSIGNED_BYTE, true, 24, 16);
        pgm.vertexAttribPointer('texcoord', 2, gl.UNSIGNED_SHORT, false, 24, 20);

        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        pgm.uniformMatrix4fv('m_obj', mat);
        gl.drawArrays(gl.TRIANGLES, 0, obj.vertex_count);
    }

    function draw_tile(env, lbd, tile, tx, ty) {
        if (!tile.visible)
            return;

        var h = tile.height;

        var scale = 0.5/1024;
        mat4.identity(mat);
        mat4.translate(mat, mat, [tx-9.5, -h, 9.5-ty]);
        mat4.scale(mat, mat, [scale, scale, scale]);
        mat4.rotateY(mat, mat, -0.5 * tile.direction * Math.PI);

        var tmd_index = tile.tmd_index;
        var tmd_object = lbd.tmd.objects[tmd_index];
        draw_tmd_object(env, tmd_object, mat);

        if (tile.extra) {
            draw_tile(env, lbd, tile.extra, tx, ty);
        }
    }

    function draw_lbd(env, lbd, lx, ly) {
        if (!lbd)
            return;

        if (!tix.texture)
            return;

        for (var ty = 0; ty < 20; ++ty) {
            for (var tx = 0; tx < 20; ++tx) {
                var tile_index = 20*ty + tx;
                var tile = lbd.tiles[tile_index];
                draw_tile(env, lbd, tile, 20.1*lx + tx, 20.1* ly + ty);
            }
        }
    }

    function draw_lbds(env) {
        if (!stages) return;
        var stage = stages[stage_index];

        var layout = stage.layout || 'v';
        //var columns = stage.columns || 0;
        var columns = lbd_columns;

        for (var lbd_index = 0; lbd_index < lbd_count; ++lbd_index) {
            var lbd = lbds[lbd_index];
            if (!lbd) continue;

            var lx = 0;
            var ly = 0;
            if (layout == 'h') {
                var lx = lbd_index % columns;
                var ly = Math.floor(lbd_index / columns);
                lx -= (ly % 2) * 0.5;
            }

            draw_lbd(env, lbd, lx, ly);
        }
    }

    key('t', () => {
        $('canvas.texture').toggle();
    });

    // attach canvas and events
    $(canvas.el).addClass('webgl');
    $('#main').prepend(canvas.el);

    // connect window resize event
    window.onresize = function() { canvas.redraw() };

    // canvas drawing
    canvas.draw = function() {
        draw_lbds(this);
    };

    canvas.light_pos = vec3.fromValues(100, 100, 100);
    canvas.light_pos_v = vec3.create();
}
