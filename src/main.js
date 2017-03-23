import {Canvas3D} from './Canvas3D';
import {vec2, vec3, vec4, mat4, quat} from 'gl-matrix';
import {Player} from './player';
import {padl, save_file_as, get_event_offset, lerp} from './utils';
import {Level} from './Level';
import {PickRay} from './PickRay';
import copy_to_clipboard from 'copy-to-clipboard';
import {Howl} from 'howler';
import {Lyric} from './lyric';
import {Packshot} from './packshot';
import {new_vertex_buffer, bind_vertex_buffer, get_program} from './webgl';

//Howler.mobileAutoEnable = true;
//Howler.usingWebAudio = true;

function get_sound(path, loop) {
    var base_url = 'sounds/' + path;
    var exts = ['ogg', 'm4a', 'mp3'];
    //var exts = ['webm', 'mp3'];
    var src = _.map(exts, function(ext) { return base_url + '.' + ext });
    return new Howl({
        src: src,
        loop: loop,
        //preload: false
    });
}

window.main = function() {
    const links = [
        {
            name: '3ww',
            url: 'https://alt-j.lnk.to/3wwPR',
            visited: false,
            pos: [59, 0.5],
            respawn: [59.6, 4.6, 3.0]
        },

        {
            name: 'relaxer',
            url: 'https://alt-j.lnk.to/RelaxerPR',
            visited: false,
            pos: [32, 74],
            respawn: [34.8, 77.4, 1.3]
        },
    ];

    var sounds = {
        intro: get_sound('3ww_intro', true)
    };

    function load_sounds() {
        _.assign(sounds, {
            howl1: get_sound('howl1', false),
            howl2: get_sound('howl2', false),
            brass1: get_sound('brass1', false),
            brass2: get_sound('brass2', false),
            pool1: get_sound('pool1', true),
            pool2: get_sound('pool2', true),
            campfire: get_sound('campfire_c', true),
            screech: get_sound('screech_and_bump', false),
            siren: get_sound('siren', true),
            plane_splash: get_sound('plane_splash', false),
            door_open: get_sound('door_open', false),
        });
    }

    var canvas = new Canvas3D({
        antialias: false,
        extensions: [ 'OES_standard_derivatives' ],
        sources: [
            'shaders/tmd.glsl',
            'shaders/tiles.glsl',
        ]
    });

    if (!gl) {
        $('.info').html(
            `Sorry, your device doesn\'t support WebGL :( \
            <br\><br/>
            <a style="display: inline-block; border: 1px solid white; padding: 10px; width: 200px;" href="http://altjband.com/">Home</a>`);
        return;
    }

    canvas.camera.far = 10;
    canvas.camera.near = 0.1;
    canvas.camera.fov = 30;
    canvas.light_pos = vec3.fromValues(100, 100, 100);
    canvas.light_pos_v = vec3.create();

    $(canvas.el).addClass('webgl');
    $('#main').prepend(canvas.el);

    var level = new Level;
    level.load(5).then(() => {
        player.level = level;
        level.player = player;  // XXX
        init_player_state();
        console.log('OK');
    });

    var player = new Player;
    vec3.set(player.pos, 60.5, 40.0, 0.5);
    player.dir = 1;
    player.collide = true;


    player.on_leave_area = function(area) {
        console.log('leave area', area);

        if (area == 0) {
            //sounds.intro.pause();
            sounds.intro.fade(1, 0, 500);
            console.log('LEAVE');
            //sounds.intro.on('fade', function() { sounds.intro.pause(); });
        }

        if (area == 2) {
            //var s = _.sample([sounds.howl1, sounds.howl2]);
            //var s = sounds.brass1;
            //s.play();
        }

        if (area == 5) {
            lyrics.campfire.fade();
            sounds.campfire.stop();
            level.ghost.active = true;
        }

        if (area == 3) {
            // kicker
            sounds.brass2.stop();
        }


        if (area == 6) {
            sounds.pool1.stop();
            sounds.pool2.stop();
            lyrics.neon.fade();
        }

        if (area == 8) {
            sounds.siren.stop();
        }
    };

    player.on_enter_area = function(area) {
        console.log('enter area', area);

        if (area == 0) {
            //sounds.intro.play();
            sounds.intro.fade(0, 1, 1000);
        }

        if (area == 3) {
            // kicker
            sounds.brass2.play();
        }

        if (area == 2) {
            //var s = _.sample([sounds.howl1, sounds.howl2]);
            //var s = sounds.brass1;
            //s.play();
            //lyrics.neon.start();
        }

        if (area == 5) {
            //var s = _.sample([sounds.howl1, sounds.howl2]);
            var s = sounds.campfire;
            s.play();
            lyrics.campfire.start();
        }

        if (area == 6) {
            var s = _.sample([sounds.pool1, sounds.pool2]);
            s.play();
            lyrics.neon.start();
        }

        if (area == 4) {
            var s = _.sample([sounds.howl1, sounds.howl2]);
            //var s = sounds.siren;
            s.play();
        }

        if (area == 8) {
            sounds.siren.play();
        }
    };

    // LYRICS

    var lyrics = {
        campfire: new Lyric('data/lyric-campfire2.msgpack'),
        neon: new Lyric('data/lyric-neon2.msgpack'),
    };

    lyrics.campfire.setup({
        pos: [77.5, 1.5, -66.001],
        scale: 2,
        rotate: Math.PI,
        color: [1.0, 0.8, 0.1, 0.85],
        color2: [1.0, 0.3, 0.0, 0.65],
        speed: 0.02
    });

    lyrics.neon.setup({
        pos: [37.0, 1.5, -2.5],
        scale: 4.5,
        rotate: Math.PI,
        color: [0.0, 0.4, 0.9, 0.85],
        color2: [0.8, 0.0, 0.7, 0.65],
        speed: 0.1
    });


    // PACKSHOTS

    var packshots = [
        new Packshot,
        new Packshot,
    ];

    packshots[0].setup({
        pos: [59.0, 0.0, -0.01],
        scale: 1.0,
        rotate: Math.PI,
        texpos: 1
    });

    packshots[1].setup({
        pos: [30.4, 0.0, -72.01],
        scale: 0.6,
        rotate: 1.0*Math.PI,
        texpos: 0
    });

    var paused = false;
    var devmode = false;

    function start(dev) {
        console.log('main:start');
        sounds.intro.play();
        console.log('main:start.animate');
        animate();

        if (dev) {
            init_keys();
            devmode = true;
        }
    }

    function pause() {
        paused = true;
    }

    function clear() {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    function resume() {
        if (paused) {
            paused = false;
            animate();
        }
    }

    function animate() {
        if (!paused)
            requestAnimationFrame(animate);

        player.check_keys();
        update_ghost();
        update_plane();
        update_links();
        canvas._draw();
    }
    //animate();

    // connect window resize event
    //window.onresize = function() { canvas.redraw() };

    function hex(x, n=2) {
        return padl(x.toString(16), n);
    }

    var player_cam = {
        enabled: true,
        aerial: false,
        ortho: true,

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

            if (e.ctrlKey) {
                player.pos[0] = tmp[0];
                player.pos[1] = -tmp[2];
                copy_to_clipboard(vec3.str(player.pos));
                $('#debug').text(vec3.str(player.pos));
            } else {
                var x = tmp[0];
                var y = -tmp[2];
                level.toggle_area(x, y, area_index);
            }
        }

        mouse.update(e);
        mouse.button = -1;
    });

    var area_index = 0;

    var fade_color = vec4.fromValues(0, 0, 0, 1);
    var fade_amount = 1.0;
    var fade_target = 0.0;

    var fade_quad = new_vertex_buffer(new Float32Array([ 0, 0, 1, 0, 0, 1, 1, 1 ]));
    var fade_pgm = get_program('simple');
    var fade_mat = mat4.create();
    mat4.identity(fade_mat);
    mat4.translate(fade_mat, fade_mat, [-1, -1, 0]);
    mat4.scale(fade_mat, fade_mat, [2, 2, 2]);

    function draw_fade() {
        fade_amount = lerp(fade_amount, fade_target, 0.0075);

        if (fade_amount < 0.01) {
            fade_amount = 0.0;
            return;
        }

        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        var pgm = fade_pgm.use();
        pgm.uniformMatrix4fv('mvp', fade_mat);
        fade_color[3] = fade_amount;
        pgm.uniform4fv('color', fade_color);

        bind_vertex_buffer(fade_quad);
        pgm.vertexAttribPointer('position', 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disable(gl.BLEND);
    }

    // canvas drawing
    canvas._draw = function() {
        this.check_resize();
        this.update_camera();

        gl.clearColor(0.05, 0, 0.15, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (player_cam.enabled) {
            player_cam.update();

            this.camera.far = 20;
            this.camera.near = 0.01;
            //this.camera.near = 0.5;
            this.camera.ortho = false;
            this.camera.update_quat(player_cam.pos, player_cam.dir);

            // copy mvp to player for debug
            mat4.copy(player.mvp, this.camera.mvp);
            mat4.copy(player.inverse_mvp, this.camera.inv_mvp);

            if (player_cam.aerial) {
                this.camera.far = 1000;
                this.camera.near = 0.01;

                // overwrite camera
                this.camera.ortho = player_cam.ortho ? (0.5*player_cam.aerial_pos[1] - 10) : 0;
                this.camera.update_quat(player_cam.aerial_pos, player_cam.aerial_dir);
            } else {
                this.camera.ortho = 0;
            }
        } else {
            this.camera.ortho = 0;
        }

        // packshots
        packshots[0].draw(this);
        packshots[1].draw(this);

        level.flicker = (player.area == 5);
        level.draw(this);

        if (player_cam.aerial) {
            player.draw(this);
        }

        // lyrics
        lyrics.campfire.draw(this);
        lyrics.neon.draw(this);

        //level.draw_tiles_debug(this);

        // fade
        draw_fade();
    };

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

        player_cam.aerial_pos[0] = player.pos[0];
        player_cam.aerial_pos[2] = -player.pos[1];
    }

    function reset_player_state() {
        vec3.set(player.pos, 60.5, 41.0, 0.5);
        player.dir = 1;
    }

    function init_player_state() {
        reset_player_state();
        //load_player_state();
        //setInterval(save_player_state, 500);
    }

    //vec3.set(level.ghost.pos, 77.45, 65.30, 0.0);
    vec3.set(level.ghost.pos, 78.52, 66.41, 0.0);

    function update_ghost() {
        var ghost = level.ghost;

        var dx = ghost.pos[0] - (player.pos[0] - 0.5);
        var dy = ghost.pos[1] - (player.pos[1] + 0.5);
        var angle = -Math.atan2(dy, dx);
        var dir = (2 * angle / Math.PI) + 1;
        ghost.dir = lerp(ghost.dir, dir, 0.05);

        if (ghost.active) {
            var theta = -0.5 * Math.PI * (ghost.dir + 1);
            var dist = 0.005;
            var x = ghost.pos[0] + dist * Math.cos(theta);
            var y = ghost.pos[1] + dist * Math.sin(theta);
            ghost.pos[0] = x;
            ghost.pos[1] = y;

            var dist = vec2.dist(ghost.pos, player.pos);
            //console.log(dist);
            if (dist < 2.0) {
                ghost.active = false;
                sounds.screech.play();
            }
        }
    }

    function trigger_plane() {
        console.log('PLANE!');
        sounds.plane_splash.play();
        level.plane_start = performance.now();
    }

    function update_plane() {
        if (level.plane_start)
            return;

        var px = ~~player.pos[0];
        var py = ~~player.pos[1];
        var dir = Math.round(player.dir) & 3;
        //console.log(px, py, dir);
        if (px == 79 && py == 86 && dir == 3) {
            trigger_plane();
        }
    }

    function open_link(link) {
        $('.linkbox iframe').attr('src', link.url);
        $('.linkbox').css({ display: 'block' });

        pause();
        requestAnimationFrame(clear);
        sounds.door_open.play();
    }

    $('iframe').on('load', function() {
        $('.linkbox').css({ display: 'block', opacity: 1 });
    });

    $('button.close').on('click', function() {
        resume();
        $('.linkbox').css({ display: 'none', opacity: 0 });
    });

    $('button.enter').on('click', function() {
        $('.infobox').hide();
        start();
    });

    function update_links() {
        links.forEach(link => {
            if (link.visited)
                return;

            var dist = vec2.dist(player.pos, link.pos);
            if (dist > 1)
                return;

            //link.visited = true;
            if (!devmode)
                open_link(link);

            link.visited = true;    // stop further linking

            // FIXME use fade
            setTimeout(function() {
                // respawn/re-enable linking
                player.pos[0] = link.respawn[0];
                player.pos[1] = link.respawn[1];
                player.dir = link.respawn[2];
                link.visited = false;
            }, 500);
        });
    }

    function init_touch_events() {
        function get_event_pos(out, e) {
            var rect = e.target.getBoundingClientRect();
            if (typeof e.pageX == 'undefined') {
                e = (e.targetTouches[0] ||
                     e.changedTouches[0]);
            }

            if (!e) {
                out[0] = 0;
                out[1] = 0;
                return;
            }

            out[0] = e.pageX - rect.left;
            out[1] = e.pageY - rect.top;
        }

        var mouse = {
            start: vec2.create(),
            first: vec2.create(),
            last: vec2.create(),
            curr: vec2.create(),
            delta: vec2.create(),
            button: -1,
            touches: 0,

            down: function(e) {
                get_event_pos(this.start, e);
                vec2.copy(this.curr, this.start);
                vec2.copy(this.last, this.curr);
                vec2.copy(this.first, this.curr);
                vec2.sub(this.delta, this.curr, this.last);

                if (e.button === undefined) {
                    // touches
                    var n = e.targetTouches.length;
                    this.button = { 1: 0, 2: 2, 3: 1 }[n];
                    this.touches = n;
                } else {
                    this.button = e.button;
                    this.touches = 0;
                }
            },

            move: function(e) {
                vec2.copy(this.last, this.curr);
                get_event_pos(this.curr, e);
                vec2.sub(this.delta, this.curr, this.last);
            },

            up: function(e) {
                vec2.copy(this.last, this.curr);
                get_event_pos(this.curr, e);
                vec2.sub(this.delta, this.curr, this.last);
                this.button = -1;
            },
            
            drag: false
        };

        canvas.el.addEventListener('touchstart', function(e) {
            //$('#debug').text('touchstart: ' + vec2.str(mouse.delta));
            mouse.down(e);
            mouse.drag = true;
            e.preventDefault();
        });

        canvas.el.addEventListener('touchmove', function(e) {
            if (!mouse.drag)
                return;

            mouse.move(e);

            var dx = mouse.curr[0] - mouse.first[0];
            var dy = mouse.curr[1] - mouse.first[1];
            //console.log(dx);

            const rotate_speed = 0.0001;
            //player.touch.rotate = rotate_speed * mouse.delta[0];
            player.touch.rotate = rotate_speed * dx;
            player.touch.rotating = true;
            player.touch.advance = -0.001 * dy;

            //$('#debug').text('delta: ' + vec2.str(mouse.delta));
        });

        canvas.el.addEventListener('touchend', function(e) {
            if (!mouse.drag)
                return;

            mouse.drag = false;
            mouse.up(e);
            player.touch.rotating = false;
        });
    }
    init_touch_events();

    load_sounds();

    function mute(value) {
        if (typeof value == 'undefined')
            value = !Howler._muted;
        Howler.mute(value);
        return value;
    }
    key('m', () => mute());

    function init_keys() {
        key('p', function() {
            var tx = player.pos[0].toFixed(1);
            var ty = player.pos[1].toFixed(1);
            var dir = player.dir;
            $('#debug').text(`${tx},${ty},${dir}`);
        });

        key('a', function() {
            player_cam.aerial = !player_cam.aerial;
            player_cam.aerial_pos[0] = player.pos[0];
            player_cam.aerial_pos[2] = -player.pos[1];
            level.fog_enabled = !player_cam.aerial;
            level.draw_debug = player_cam.aerial;
        });

        key('o', function() {
            player_cam.ortho = !player_cam.ortho;
        });

        key('c', function() {
            player.collide = !player.collide;
        });

        function bind_area_key(idx) {
            var area_key = String.fromCharCode(48 + idx);
            key(area_key, function() {
                if (area_index == idx)
                    area_index = 0;
                else
                    area_index = idx;
                $('#debug').text('area: ' + area_index);
            });
        }

        for (var i = 0; i <= 8; ++i) {
            bind_area_key(i);
        }

        key('r', function() {
            reset_player_state();
        });

        key('d', function() {
            var s = localStorage.getItem('level.areas');
            save_file_as(s, 'level.areas.txt', 'text/plain');
        });
        
        key('x', trigger_plane);

        key('l', function() {
            open_link(links[0]);
        });

        key('s', save_player_state);
    }

    return {
        start,
        mute,
    };
}

//import {digitize_main} from './digitize-main';
//window.digitize_main = digitize_main;
