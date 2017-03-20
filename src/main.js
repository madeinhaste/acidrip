import {Canvas3D} from './Canvas3D';
import {vec2, vec3, mat4, quat} from 'gl-matrix';
import {Player} from './player';
import {padl, save_file_as, get_event_offset, lerp} from './utils';
import {Level} from './Level';
import {PickRay} from './PickRay';
import copy_to_clipboard from 'copy-to-clipboard';


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
    //vec3.set(player.pos, 37, 26, 0.5);
    //vec3.set(player.pos, 80.2591323852539, 95.85198974609375, 0.5)
    player.dir = 1;
    player.collide = true;

    var level = new Level;
    level.load(5).then(() => {
        player.level = level;
        init_player_state();
    });
    
    function animate() {
        requestAnimationFrame(animate);
        // if (player.check_keys())
        //     canvas.redraw();
        player.check_keys();
        update_ghost();
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
            //vec3.copy(this.aerial_pos, this.pos);
            this.aerial_pos[1] = this.aerial_height;

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
        player_cam.aerial_pos[0] = player.pos[0];
        player_cam.aerial_pos[2] = -player.pos[1];
        level.fog_enabled = !player_cam.aerial;
        canvas.redraw();
    });

    key('c', function() {
        player.collide = !player.collide;
        canvas.redraw();
    });


    // aerial mode
    var mouse = {
        pos: vec2.create(),
        last: vec2.create(),
        first: vec2.create(),
        delta: vec2.create(),
        button: -1,
        update(e) {
            vec2.copy(this.last, this.pos);
            get_event_offset(this.pos, e);
            vec2.sub(this.delta, this.pos, this.last);
        },
        pick_ray: new PickRay(canvas.camera)
    };

    document.addEventListener('mousewheel', e => {
        if (!player_cam.aerial)
            return;

        var dy = e.wheelDelta / 120;
        player_cam.aerial_height += 5 * dy;
        player_cam.aerial_height = Math.max(10, player_cam.aerial_height);
    });

    canvas.el.addEventListener('mousedown', e => {
        if (!player_cam.aerial)
            return;

        mouse.update(e);
        vec2.copy(mouse.first, mouse.pos);
        mouse.button = e.button;
        e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
        if (!player_cam.aerial)
            return;

        mouse.update(e);

        if (mouse.button == 0) {
            const scale = 0.01;
            player_cam.aerial_pos[0] -= scale * mouse.delta[0];
            player_cam.aerial_pos[2] -= scale * mouse.delta[1];
        }
    });

    document.addEventListener('mouseup', e => {
        if (!player_cam.aerial)
            return;

        if (vec2.dist(mouse.first, mouse.pos) < 0.1) {
            // click event
            mouse.pick_ray.fromWindowCoords(mouse.pos[0], window.innerHeight - mouse.pos[1]);
            var tmp = vec3.create();
            vec3.copy(tmp, mouse.pick_ray.origin);
            var t = -mouse.pick_ray.origin[1] / mouse.pick_ray.direction[1];
            vec3.scaleAndAdd(tmp, tmp, mouse.pick_ray.direction, t);

            player.pos[0] = tmp[0];
            player.pos[1] = -tmp[2];
            copy_to_clipboard(vec3.str(player.pos));

            $('#debug').text(vec3.str(player.pos));
        }

        mouse.update(e);
        mouse.button = -1;
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

        //this.draw_grid();
        level.draw(this);
        player.draw(this);

        //$('#debug').text(`${player.pos[0].toFixed(3)},${player.pos[1].toFixed(3)}`);
    };

    key('d', function() {
        console.log('POS:', player.pos);
        //set_clipboard_text(vec3.str(player.pos));
        //copy_to_clipboard(vec3.str(player.pos));
    });

    /*
    function set_clipboard_text(text) {
        var ta = document.querySelector('textarea#ta-clipboard');
        ta.value = 'hello';
        console.log('v:', ta.value);
        ta.select();
        console.log(ta);
        document.execCommand('copy');
    }
    */
    function save_player_state() {
        var state = {
            pos: Array.from(player.pos),
            dir: player.dir
        };
        state = JSON.stringify(state);
        localStorage.setItem('player.state', state);
    }

    function load_player_state() {
        var state = localStorage.getItem('player.state');
        if (!state) return;
        state = JSON.parse(state);
        console.log('player.state:', state);
        vec3.copy(player.pos, state.pos);
        player.dir = state.dir;
    }

    function init_player_state() {
        load_player_state();
        setInterval(save_player_state, 500);
    }

    key('r', function() {
        vec3.set(player.pos, 60.5, 40.0, 0.5);
        player.dir = 1;
    });

    function update_ghost() {
        var ghost = level.ghost;

        var dx = ghost.pos[0] - (player.pos[0] - 0.5);
        var dy = ghost.pos[1] - (player.pos[1] + 0.5);
        var angle = -Math.atan2(dy, dx);
        var dir = (2 * angle / Math.PI) + 1;
        ghost.dir = lerp(ghost.dir, dir, 0.05);

        var theta = -0.5 * Math.PI * (ghost.dir + 1);
        var dist = 0.005;
        var x = ghost.pos[0] + dist * Math.cos(theta);
        var y = ghost.pos[1] + dist * Math.sin(theta);

        ghost.pos[0] = x;
        ghost.pos[1] = y;
    }
}

import {mom_main} from './mom-main';
window.mom_main = mom_main;
