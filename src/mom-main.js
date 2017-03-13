import {BinaryReader, modulo} from './utils';
import {TIX} from './tix';
import {LBD} from './lbd';
import {Canvas3D} from './Canvas3D';
import {new_vertex_buffer, bind_vertex_buffer, get_program} from './webgl';
import {vec3, mat4} from 'gl-matrix';

window.mom_main = function() {
    var canvas = new Canvas3D({
        antialias: false,
        extensions: [ 'OES_standard_derivatives' ],
        sources: [ 'shaders/tmd.glsl' ]
    });

    canvas.camera.far = 10000;

    // check gl & setup?
    console.assert(gl);

    var stages = null;
    var stage_index = 5;
    var lbd_index = 0;
    var lbd_count = 0;
    var lbd = null;
    var lbd_columns = 0;

    var lbds = [];
    var moms = [];
    var mom_index = 0;

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

    function pad(x, n, c) {
        var s = ''+x;
        c = c || '0';
        while (s.length < n)
            s = c + s;
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
                //destroy_lbd(lbd);

                var f = new BinaryReader(buf);
                lbd = new LBD;
                lbd.read(f);

                canvas.redraw();

                $('#debug').text(`${stages[stage_index].name} m${pad(lbd_index, 3)}`);
            });
    }

    var redraw2 = _.debounce(function() { canvas.redraw() }, 100);

    function check_done() {
        for (var i = 0; i < lbd_count; ++i) {
            if (!lbds[i])
                return;

            _.each(lbd.moms, (mom, j) => {
                mom.lbd_index = i;
                mom.mom_index = j;
            });
        }
        
        console.log('DONE');

        var vertex_count = 0;
        lbds.forEach(lbd => {
            lbd.tmd.objects.forEach(obj => {
                vertex_count += obj.vertex_count;
            });
            moms.push.apply(moms, lbd.moms);
        });

        console.log('vertex-count:', vertex_count);
        console.log('mom-count:', moms.length);
    }

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
                    check_done();
                });
        }

        for (var lbd_index = 0; lbd_index < lbd_count; ++lbd_index) {
            lbds.push(null);
            load_lbd(lbd_index);
        }
    }

    key('left', () => {
        mom_index = Math.max(0, mom_index - 1);
        canvas.redraw();
    });

    key('right', () => {
        mom_index = Math.min(moms.length - 1, mom_index + 1);
        canvas.redraw();
    });

    var mat = mat4.create();
    var pgm;

    var tmd_vertex_capacity = 1<<28;
    //var tmd_vertex_capacity = 1<<19;
    var tmd_vertex = {
        array: new Uint8Array(tmd_vertex_capacity),
        buffer: null,
        next: 0 // in vertices
    };

    tmd_vertex.buffer = new_vertex_buffer(tmd_vertex.array);

    function setup_draw_tmd(env) {
        pgm = get_program('tmd').use();
        pgm.uniformMatrix4fv('m_vp', env.camera.mvp);
        pgm.uniform3fv('view_pos', env.camera.view_pos);
        pgm.uniform3fv('light_pos', env.light_pos);
        pgm.uniformSampler2D('s_tix', tix.texture);

        bind_vertex_buffer(tmd_vertex.buffer);
        pgm.vertexAttribPointer('position', 3, gl.SHORT, false, 24, 0);
        pgm.vertexAttribPointer('normal', 3, gl.SHORT, true, 24, 8);
        pgm.vertexAttribPointer('color', 3, gl.UNSIGNED_BYTE, true, 24, 16);
        pgm.vertexAttribPointer('texcoord', 2, gl.UNSIGNED_SHORT, false, 24, 20);

        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
    }

    function draw_tmd_object(env, obj, mat) {
        if (!obj.vertex_buffer) {
            //console.log(tmd_vertex.next);
            //obj.vertex_buffer = new_vertex_buffer(obj.vertex_array);

            obj.vertex_buffer = tmd_vertex.buffer;
            obj.vertex_start = tmd_vertex.next;

            var vertex_size = 24;
            tmd_vertex.array.set(obj.vertex_array, vertex_size * obj.vertex_start);
            tmd_vertex.next += obj.vertex_count;

            bind_vertex_buffer(tmd_vertex.buffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, vertex_size * obj.vertex_start, obj.vertex_array);
        }

        pgm.uniformMatrix4fv('m_obj', mat);
        gl.drawArrays(gl.TRIANGLES, obj.vertex_start, obj.vertex_count);
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

        //pgm.uniform3f('debug_color', (tile.collision & 0x80) ? 1 : 0, 0, 0);
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

        setup_draw_tmd(env);

        for (var ty = 0; ty < 20; ++ty) {
            for (var tx = 0; tx < 20; ++tx) {
                var tile_index = 20*ty + tx;
                var tile = lbd.tiles[tile_index];
                draw_tile(env, lbd, tile, 20*lx + tx, 20* ly + ty);
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

    function draw_moms(env) {
        var mom = moms[mom_index];
        if (!mom) return;
        if (!tix.texture) return;
        setup_draw_tmd(env);

        //var scale = 0.5/1024;
        var scale = 0.1;

        var t = _.map(mom.tmd.objects, obj => obj.prims.length).join(',');
        $('#debug').text(
            `lbd:${mom.lbd_index}  mom:${mom.mom_index}  objs: ${t}`);

        _.each(mom.tmd.objects, (obj, idx) => {
            mat4.identity(mat);
            //mat4.translate(mat, mat, [100*idx, 0, 0]);
            mat4.scale(mat, mat, [scale, scale, scale]);
            draw_tmd_object(env, obj, mat);
        });
    }

    key('t', () => {
        $('canvas.texture').toggle();
    });

    key('m', () => {
        var mom = moms[mom_index];
        var hdr = mom.header;
        var f = new BinaryReader(hdr.buffer);
        var line = [];
        while (f.sp < f.end) {
            var word = f.read_u32();
            line.push(pad(word.toString(16), 8));
            //line.push(pad(word, 8, ' '));
            if (line.length == 8) {
                console.log(line.join(' '));
                line = [];
            }
        }
        console.log('end');
    });

    // attach canvas and events
    $(canvas.el).addClass('webgl');
    $('#main').prepend(canvas.el);

    // connect window resize event
    window.onresize = function() { canvas.redraw() };

    // canvas drawing
    canvas.draw = function() {
        //draw_lbds(this);
        draw_moms(this);
    };

    canvas.light_pos = vec3.fromValues(100, 100, 100);
    canvas.light_pos_v = vec3.create();
}
