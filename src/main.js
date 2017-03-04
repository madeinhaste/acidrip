import {TextureSet} from './TextureSet';
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

    // check gl & setup?
    console.assert(gl);

    var stages = null;
    var stage_index = 0;
    var lbd_index = 0;
    var lbd_count = 0;
    var lbd = null;
    var tix = new TextureSet;

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
        lbd_index = 0;
        next_lbd(0);

        var tixname = `stg${pad(stage_index, 2)}/texa`;
        tix.load_tix(tixname)
            .then(() => {
                // rotate
                for (var i = 1; i < 31; i += 2)
                    tix.load_tix_page(i+1, tixname, i, 0, 2, 0);

                tix.draw_labels();
                tix.update_texture();
                canvas.redraw();
            });
    }

    var $tix_canvas = $(tix.canvas).addClass('texture');
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

    key('left', () => next_lbd(-1));
    key('right', () => next_lbd(1));

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

        if (tix && tix.texture)
            pgm.uniformSampler2D('s_tix', tix.texture);

        bind_vertex_buffer(obj.vertex_buffer);

        pgm.vertexAttribPointer('position', 3, gl.SHORT, false, 24, 0);
        pgm.vertexAttribPointer('normal', 3, gl.SHORT, true, 24, 8);
        pgm.vertexAttribPointer('color', 3, gl.UNSIGNED_BYTE, true, 24, 16);
        pgm.vertexAttribPointer('texcoord', 3, gl.UNSIGNED_BYTE, false, 24, 20);

        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);

        pgm.uniformMatrix4fv('m_obj', mat);
        gl.drawArrays(gl.TRIANGLES, 0, obj.vertex_count);
    }

    var visible_count = 0;
    var tpages = new Set;

    function draw_tile(env, tile, tx, ty) {
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

        ++visible_count;
        tmd_object.prims.forEach(prim => {
            if (prim.mode & (1<<2))
                tpages.add(prim.tpage);
        });

        if (tile.extra) {
            draw_tile(env, tile.extra, tx, ty);
        }
    }

    function draw_lbd(env, lbd) {
        if (!lbd)
            return;

        if (!tix.texture)
            return;

        visible_count = 0;
        tpages.clear();

        for (var ty = 0; ty < 20; ++ty) {
            for (var tx = 0; tx < 20; ++tx) {
                var tile_index = 20*ty + tx;
                var tile = lbd.tiles[tile_index];
                draw_tile(env, tile, tx, ty);
            }
        }
    }

    //key('left', () => load_next_object(-1));
    //key('right', () => load_next_object(1));

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
        draw_lbd(this, lbd);
    };

    canvas.light_pos = vec3.fromValues(100, 100, 100);
    canvas.light_pos_v = vec3.create();

    
}

window.tix_main = function() {
    fetch('data/cdi/stg00/texa.tix')
            .then(r => r.arrayBuffer())
            .then(buf => {
                var f = new BinaryReader(buf);
                var tix = new TIX;
                tix.read(f);
                display_tix(tix);
            });

    function display_tix(tix) {
        var atlas = document.createElement('canvas');
        atlas.width = 2048;
        atlas.height = 512;
        var atlas_ctx = atlas.getContext('2d');
        atlas_ctx.fillStyle = 'black';
        atlas_ctx.fillRect(0, 0, 2048, 512);

        var tims = [];

        _.each(tix.groups, (grp, grp_idx) => {
            var $grp = $(`<h3>Group ${grp_idx}</h3>`);
            //$('#main').append($grp);
            grp.forEach(tim => {
                var c = document.createElement('canvas');
                var img = tim.image;
                c.width = img.width;
                c.height = img.height;
                var ctx = c.getContext('2d');
                ctx.putImageData(img, 0, 0);

                ctx.fillStyle = '#fff';
                ctx.shadowOffsetY = 1;
                ctx.shadowOffsetX = 1;
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 1;
                ctx.font = '16px Roboto';

                var text = [
                    `${c.width}x${c.height}`,
                    `tpage: ${tim.tpage}`,
                    `org: ${tim.xorg},${tim.yorg}`
                ]

                var ty = 20;
                var th = 22;
                text.forEach(line => {
                    ctx.fillText(line, 6, ty);
                    ty += th;
                });

                tims.push(tim);

                //$('#main').append(c);

                // add to atlas
            });
        });

        $('#main')
            .append('<h3>VRAM</h3>')
            .append(atlas);

        key('space', function() {
            var tim = tims.pop();
            if (!tim) {
                atlas_ctx.fillStyle = 'red';
                atlas_ctx.fillRect(0, 0, 640, 16);
                return;
            }
            atlas_ctx.putImageData(tim.image, 2*tim.xorg, tim.yorg);
        });
    }
}
