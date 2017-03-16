import {Canvas3D} from './Canvas3D';
import {vec3, mat4, quat} from 'gl-matrix';
import {Player} from './player';
import {StageRenderer} from './StageRenderer';
import {load_stages} from './Stage';
import {padl} from './utils';

window.main = function() {
    var gamepad_index = -1;

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
    //player.pos[0] = 59.0;
    //player.pos[1] = 100.5;
    player.pos[0] = 50.5;
    player.pos[1] = 41.0;
    //player.pos[2] = 0.9;
    player.pos[2] = 0.5;
    //player.dir = -1;
    player.dir = 1;

    var stages = [];
    var stage_renderer = new StageRenderer;
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
        });
    });
    
    function animate() {
        requestAnimationFrame(animate);
        if (player.check_keys(get_gamepad()))
            canvas.redraw();
        scan_gamepad();
    }
    animate();

    // connect window resize event
    window.onresize = function() { canvas.redraw() };

    function hex(x, n=2) {
        return padl(x.toString(16), n);
    }

    var player_cam = {
        enabled: true,
        pos: vec3.create(),
        dir: quat.create(),

        update() {
            this.pos[0] = player.pos[0];
            this.pos[1] = player.pos[2];
            this.pos[2] = -player.pos[1];

            quat.identity(this.dir);
            quat.rotateY(this.dir, this.dir, -0.5 * (player.dir + 1) * Math.PI);
        }
    };

    key('p', function() {
        player_cam.enabled = !player_cam.enabled;
        canvas.redraw();
    });

    // canvas drawing
    canvas._draw = function() {
        this.check_resize();
        this.update_camera();
        gl.clearColor(0.05, 0, 0.15, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        /*
        if (stage) {
            var tile = stage.get_tile(
                player.pos[0],
                player.pos[1]);

            stage_renderer.highlight_tile = tile;
            if (tile) {
                var txt = `c:${hex(tile.collision)} h:${hex(tile.height)}`;
                if (tile.extra) {
                    tile = tile.extra;
                    txt += `  (c:${hex(tile.collision)} h:${hex(tile.height)})`;
                }
                $('#debug').text(txt);

                //player.pos[2] = tile.collision;
            } else {
                $('#debug').text('');
            }
        }
        */

        if (player_cam.enabled) {
            player_cam.update();
            this.camera.update_quat(player_cam.pos, player_cam.dir);
        } else {
            this.draw_grid();
        }

        stage_renderer.draw(this);
        player.draw(this);

        //$('#debug').text(`${player.pos[0].toFixed(3)},${player.pos[1].toFixed(3)}`);
    };

    /*
    function setup_tix_viewer() {
        var $tix_canvas = $(tix.canvas).addClass('texture').hide();
        $('#main').append($tix_canvas);
        key('t', () => { $('canvas.texture').toggle(); });
    }
    */

    function init_gamepads() {
        window.addEventListener('gamepadconnected', function() {
            $('#debug').text('gamepad connected');
            check_gamepads();
        });

        window.addEventListener('gamepaddisconnected', function() {
            $('#debug').text('gamepad disconnected');
            gamepad_index = -1;
        });

        function check_gamepads() {
            _.each(navigator.getGamepads(), gp => {
                if (gp) {
                    console.log('gpii:', gp);
                    gamepad_index = gp.index;
                    return false;
                }
            });
            if (gamepad_index < 0)
                return;
        }

        check_gamepads();
    }
    init_gamepads();

    function get_gamepad() {
        if (gamepad_index < 0)
            return null;
        else
            return navigator.getGamepads()[gamepad_index];
    }

    function scan_gamepad() {
        var gamepad = get_gamepad();
        if (!gamepad) return;

        var buttons = [];
        _.each(gamepad.buttons, (b, i) => {
            if (b.pressed) {
                buttons.push(i);
            }
        });
        buttons = buttons.join(', ');
        if (buttons.length == 0)
            return;

        $('#debug').text(buttons);
        console.log(buttons);
    }
}

import {mom_main} from './mom-main';
window.mom_main = mom_main;
