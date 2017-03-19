import {Canvas3D} from './Canvas3D';
import {vec3, mat4, quat} from 'gl-matrix';
import {Player} from './player';
import {padl, save_file_as} from './utils';
import {Level} from './Level';


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
    vec3.set(player.pos, 60.5, 40.0, 0.5);
    player.dir = 1;
    player.collide = true;

    var level = new Level;
    level.load(5).then(() => {
        player.level = level;
        canvas.redraw()
    });
    
    function animate() {
        requestAnimationFrame(animate);
        // if (player.check_keys())
        //     canvas.redraw();
        player.check_keys();
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
        //level.fog_enabled = player_cam.enabled;
        canvas.redraw();
    });

    key('a', function() {
        player_cam.aerial = !player_cam.aerial;
        //level.fog_enabled = !player_cam.aerial;
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
        level.draw(this);
        player.draw(this);

        //$('#debug').text(`${player.pos[0].toFixed(3)},${player.pos[1].toFixed(3)}`);
    };

    key('d', function() {
        console.log('POS:', player.pos);
    });

}

import {mom_main} from './mom-main';
window.mom_main = mom_main;
