import {Canvas3D} from './Canvas3D';
import {vec3, mat4, quat} from 'gl-matrix';
import {Player} from './player';
import {StageRenderer} from './StageRenderer';
import {load_stages} from './Stage';
import {padl, save_file_as} from './utils';

window.main = function() {
    var canvas = new Canvas3D({
        antialias: false,
        extensions: [ 'OES_standard_derivatives' ],
        sources: [ 'shaders/tmd.glsl' ]
    });
    console.assert(gl);

    canvas.camera.far = 10000;
    canvas.camera.fov = 30;
    canvas.light_pos = vec3.fromValues(100, 100, 100);
    canvas.light_pos_v = vec3.create();

    $(canvas.el).addClass('webgl');
    $('#main').prepend(canvas.el);

    var player = new Player;
    player.pos[0] = 50.5;
    //player.pos[0] = 40.5;
    player.pos[1] = 41.0;
    //player.pos[1] = 41.5;
    player.pos[2] = 0.5;
    player.dir = 1;

    var stages = [];
    var stage_renderer = new StageRenderer;
    stage_renderer.fog_enabled = false;

    var stage_id = 5;
    var stage = null;

    load_stages().then(d => {
        stages = d;
        stage = stages[stage_id];
        stage.load().then(() => {
            stage_renderer.setup(canvas, stage);
            player.stage = stage;
            canvas.redraw();
            $(canvas.el).css({opacity: 1});

            /*
            var vdata = [];
            var total = 0;
            stage.lbds.forEach(lbd => {
                lbd.tmd.objects.forEach(obj => {
                    var b = obj.vertex_array;
                    vdata.push(b);
                    total += b.length;
                });
            });

            console.log('vertex-total:', total);
            var out = new Uint8Array(total);
            var dp = 0;
            vdata.forEach(b => {
                out.set(b, dp);
                dp += b.length;
            });

            save_file_as(out, 'vertex-data.bin');
            console.log(dp);
            */
        });
    });
    
    function animate() {
        requestAnimationFrame(animate);
        if (player.check_keys())
            canvas.redraw();
    }
    animate();

    // connect window resize event
    window.onresize = function() { canvas.redraw() };

    function hex(x, n=2) {
        return padl(x.toString(16), n);
    }

    var player_cam = {
        enabled: true,
        aerial: false,

        pos: vec3.create(),
        dir: quat.create(),
        
        aerial_pos: vec3.create(),
        aerial_dir: quat.create(),
        aerial_height: 50,

        update() {
            this.pos[0] = player.pos[0];
            this.pos[1] = player.pos[2];
            this.pos[2] = -player.pos[1];

            quat.identity(this.dir);
            quat.rotateY(this.dir, this.dir, -0.5 * (player.dir + 1) * Math.PI);

            // aerial camera
            vec3.copy(this.aerial_pos, this.pos);
            this.aerial_pos[1] += this.aerial_height;

            quat.identity(this.aerial_dir);
            quat.rotateX(this.aerial_dir, this.aerial_dir, -0.5 * Math.PI);

        }
    };

    key('p', function() {
        player_cam.enabled = !player_cam.enabled;
        //stage_renderer.fog_enabled = player_cam.enabled;
        canvas.redraw();
    });

    key('a', function() {
        player_cam.aerial = !player_cam.aerial;
        //stage_renderer.fog_enabled = !player_cam.aerial;
        canvas.redraw();
    });

    key('c', function() {
        player.collide = !player.collide;
        canvas.redraw();
    });

    document.addEventListener('mousewheel', e => {
        if (!player_cam.aerial)
            return;

        var dy = e.wheelDelta / 120;
        player_cam.aerial_height += 5 * dy;
        player_cam.aerial_height = Math.max(10, player_cam.aerial_height);
        canvas.redraw();
    });


    // canvas drawing
    canvas._draw = function() {
        this.check_resize();
        this.update_camera();

        gl.clearColor(0.05, 0, 0.15, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (player_cam.enabled) {
            player_cam.update();

            if (player_cam.aerial) {
                this.camera.update_quat(player_cam.aerial_pos, player_cam.aerial_dir);
            } else {
                this.camera.update_quat(player_cam.pos, player_cam.dir);
            }
        } else {
            //this.draw_grid();
        }

        this.draw_grid();
        stage_renderer.draw(this);
        player.draw(this);

        //$('#debug').text(`${player.pos[0].toFixed(3)},${player.pos[1].toFixed(3)}`);
    };

}

import {mom_main} from './mom-main';
window.mom_main = mom_main;
