import {Canvas3D} from './Canvas3D';
import {vec2, vec3, vec4, mat4, quat} from 'gl-matrix';
import {Player} from './player';
import {padl, save_file_as, get_event_offset, lerp} from './utils';
import {Level} from './Level';
import {PickRay} from './PickRay';
import copy_to_clipboard from 'copy-to-clipboard';
import {Howl} from 'howler';
import {Lyric} from './lyric';
import {Placard} from './placard';
import {new_vertex_buffer, bind_vertex_buffer, get_program} from './webgl';
import shaders_glsl from './shaders.glsl';

//Howler.mobileAutoEnable = true;
//Howler.usingWebAudio = true;

function get_sound(path, loop) {
    var exts = ['ogg', 'm4a', 'mp3'];
    var srcs = _.map(exts, ext => `sounds/${path}.${ext}`);
    return new Howl({ src: srcs, loop: loop });
}

function has_touch() {
    return Modernizr.touchevents;
}

function link_url(type, id, ...args) {
    const YOUTUBE_IDS = {
        adeline: '1XwU8H6e8Ts',
        in_cold_blood: 'rP0uuI80wuY',
        _3ww: 'ZwBkXgWNs_M',
        house_of_the_rising_sun: 'X1Knskoe15g',
        hit_me_like_that_snare: 'sXQVj2mQS5I',
        deadcrush: 'LqdSvVpv3Zk',
        last_year: '-OjkHRp2ti0',
        pleader: 'tD__QQvknXU',
        kimmel_3ww: '5SHTsgAvS88',
        holland_in_cold_blood: '3sHa0bGGrw0',
    };

    switch (type) {
        case 'yt':
            id = YOUTUBE_IDS[id] || id;
            var url = 'https://www.youtube.com/embed/' + id + '?autoplay=1';
            if (args)
                url += '&' + args;

            console.log('link_url:', url);
            return url;

        case 'altj':
            return 'https://alt-j.lnk.to/' + id;
        case 'pic':
            return 'photos.html#' + id
        case 'gif':
            return 'gifs.html#Atl-J-' + id
    }
}

window.main = function() {
    const links = [
        // PROMOS

        {
            name: 'relaxer',
            url: link_url('altj', 'RelaxerPR'),

            visited: false,
            pos: [59, 0.5],
            respawn: [59.6, 4.6, 3.0]
        },

        // VIDEOS

        {
            // behind crane on the port
            name: 'crane',
            //url: link_url('yt', 'p6vRUd9SFR8'),
            url: link_url('yt', 'pleader'),
            visited: false,
            pos: [88, 98],
            respawn: [87.8, 94.2, 3.1]
        },

        {
            // end of longest jetty
            name: 'jetty1',
            //url: link_url('yt', '5A-4VGfx5lU'),
            url: link_url('yt', 'house_of_the_rising_sun'),
            visited: false,
            pos: [69, 104],
            respawn: [68.1, 97.3, 3.1],
        },

        {
            // eye graffiti (nearest to overpass)
            name: 'eye1',
            //url: link_url('yt', 'ol4OSIGGukA'),
            url: link_url('yt', 'deadcrush'),
            visited: false,
            pos: [37, 62],
            respawn: [35.4, 57.6, 3.21],
        },

        // PHOTOS

        {
            // hopscotch girl
            name: 'hopscotch',
            //url: link_url('pic', '0213'),
            url: link_url('yt', 'kimmel_3ww'),
            visited: false,
            pos: [44, 25],
            respawn: [40.7, 27.2, 0.3]
        },

        {
            // gunman
            name: 'gunman',
            url: link_url('pic', '0218'),
            visited: false,
            pos: [93, 70],
            respawn: [92.3, 73.3, 0.8],
        },

        {
            // second eye graffiti
            name: 'eye2',
            url: link_url('pic', '0305'),
            visited: false,
            pos: [37, 70],
            respawn: [38.5, 67.4, 2.8],
        },

        {
            // sailor
            name: 'sailor',
            //url: link_url('pic', '2527'),
            url: link_url('yt', 'holland_in_cold_blood'),
            visited: false,
            pos: [77, 97],
            respawn: [80.0, 95.1, 2.5],
        },

        {
            // tree by port end wall
            name: 'tree2',
            //url: link_url('pic', '0206'),
            url: link_url('yt', '_3ww'),
            visited: false,
            pos: [94, 88],
            respawn: [96.6, 84.1, 2.7]
        },

        // GIFS

        {
            // tree
            name: 'tree1',
            //url: link_url('gif', '1'),
            url: link_url('yt', 'last_year'),
            visited: false,
            pos: [95, 42],
            respawn: [92.8, 46.5, 0.6]
        },

        {
            // lamp
            name: 'lamp',
            //url: link_url('gif', '2'),
            url: link_url('yt', 'hit_me_like_that_snare'),
            visited: false,
            pos: [38, 8],
            respawn: [36.3, 14.1, 0.7]
        },

        {
            // woman
            name: 'woman',
            //url: link_url('pic', '0206'),
            //url: link_url('gif', '3'),
            url: link_url('yt', 'adeline'),
            visited: false,
            pos: [63, 9],
            respawn: [62.1, 12.4, 0.7],
        },

        {
            // building site
            name: 'hole',
            //url: link_url('gif', '4'),
            url: link_url('yt', 'in_cold_blood', 't=5s'),
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
            //pool2: get_sound('pool2', true),
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
        shaders: [ shaders_glsl ]
    });

    if (!gl) {
        $('.info').html(
            `Sorry, your device doesn\'t support WebGL :( \
            <br\><br/>
            <a style="display: inline-block; border: 1px solid white; padding: 10px; width: 200px;" href="http://altjband.com/">Home</a>`);
        return;
    }

    canvas.light_pos = vec3.fromValues(100, 100, 100);
    canvas.light_pos_v = vec3.create();

    $(canvas.el).addClass('webgl');
    $('#main').prepend(canvas.el);

    var level = new Level;
    level.load(5).then(() => {
        player.level = level;
        level.player = player;  // XXX
        init_player_state();

        //console.log('L.S.D.');
        //[ '.^..^^..', '.^.^..^^', '.^...^..' ].map(x => console.log(x));
    });

    var player = new Player;
    vec3.set(player.pos, 60.5, 40.0, 0.5);
    player.dir = 1;
    player.collide = true;


    player.on_leave_area = function(area) {
        if (area == 0) {
            sounds.intro.fade(1, 0, 500);
        }

        if (area == 2) {
            //var s = _.sample([sounds.howl1, sounds.howl2]);
            //var s = sounds.brass1;
            //s.play();
        }

        if (area == 5) {
            lyrics[1].fade();
            sounds.campfire.stop();
            level.ghost.active = true;
        }

        if (area == 3) {
            // kicker
            sounds.brass2.stop();
            lyrics[2].fade();
        }


        if (area == 6) {
            sounds.pool1.stop();
            lyrics[0].fade();
        }

        if (area == 8) {
            sounds.siren.stop();
        }
    };

    player.on_enter_area = function(area) {
        if (area == 0) {
            sounds.intro.fade(0, 1, 1000);
        }

        if (area == 3) {
            // kicker
            sounds.brass2.play();
            lyrics[2].start();
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
            lyrics[1].start();
        }

        if (area == 6) {
            //var s = _.sample([sounds.pool1, sounds.pool2]);
            var s = sounds.pool1;
            s.play();
            lyrics[0].start();
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


    var lyrics = [
        // pool
        new Lyric({
            id: 'lyr2',
            pos: [37.0, 1.5, -2.5],
            scale: 4.5,
            rotate: Math.PI,
            color: [0.0, 0.4, 0.9, 0.85],
            color2: [0.8, 0.0, 0.7, 0.65],
            speed: 0.067
        }),

        // campfire
        new Lyric({
            id: 'lyr1',
            pos: [77.5, 1.5, -66.001],
            scale: 2,
            rotate: Math.PI,
            color: [1.0, 0.8, 0.1, 0.85],
            color2: [1.0, 0.3, 0.0, 0.65],
            speed: 0.02
        }),

        // brass
        new Lyric({
            id: 'lyr4',
            pos: [91.005, 0.5, -12.5],
            scale: 3,
            rotate: 0.5*Math.PI,
            color: [0.8, 0.1, 0.0, 0.55],
            color2: [1.0, 0.3, 0.0, 0.65],
            speed: 0.20,
            distort: 0.0015,
            delay: 5.0
        })
    ];

    // PLACARDS
    var placards = [
        new Placard({
            pos: [59.0, 0.0, -0.01],
            scale: 1.0,
            rotate: Math.PI,
            texpos: 0
        }),

        /*
        new Placard({
            pos: [30.4, 0.0, -72.01],
            scale: 0.6,
            rotate: 1.0*Math.PI,
            texpos: 1
        })
        */
    ];

    var paused = false;
    var devmode = false;

    function start(dev) {
        sounds.intro.play();
        animate();

        if (dev) {
            init_keys();
            devmode = true;
        }

        if (has_touch())
            init_navpad();
    }

    function pause() {
        paused = true;
        sounds.intro.fade(1, 0, 500);
    }

    function clear() {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    function resume() {
        if (paused) {
            paused = false;
            if (player.area == 0)
                sounds.intro.fade(0, 1, 500);
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

            // camera intrinsics
            this.camera.near = 0.01;
            this.camera.far = 20;
            this.camera.fov = 30;

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

        // placards
        placards.forEach(o => o.draw(this));

        level.flicker = (player.area == 5);
        level.draw(this);

        if (player_cam.aerial) {
            player.draw(this);
        }

        // lyrics
        lyrics.forEach(o => o.draw(this));

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
            if (dist < 2.0) {
                ghost.active = false;
                sounds.screech.play();
            }
        }
    }

    function trigger_plane() {
        sounds.plane_splash.play();
        level.plane_start = performance.now();
    }

    function update_plane() {
        if (level.plane_start)
            return;

        var px = ~~player.pos[0];
        var py = ~~player.pos[1];
        var dir = Math.round(player.dir) & 3;
        if (px == 79 && py == 86 && dir == 3) {
            trigger_plane();
        }
    }

    function open_link(link) {
        // create iframe
        var $iframe = $('<iframe>').attr({
            src: link.url,
            frameborder: 0,
            allowfullscreen: 1
        });
        //$('.linkbox').prepend($iframe);
        $('.linkbox').html($iframe);
        $iframe.on('load', function(e) {
            // show on load
            $('.linkbox').css({ display: 'block', opacity: 1 });
            $('.close').show();
        });

        pause();
        requestAnimationFrame(clear);
        sounds.door_open.play();
    }

    $('button.close').on('click', function() {
        resume();

        // remove iframe and hide linkbox
        $('.linkbox iframe').remove();
        $('.linkbox').css({ display: 'none', opacity: 0 });
        $('.close').hide();
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
            if (!devmode) {
                open_link(link);

                // kill sounds
                sounds.siren.stop();
            }

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

    function do_navpad_dir(dir, state) {
        const rotate_speed = 0.01;
        const advance_speed = 1.0;


        switch (dir) {
            case 'u':
                player.touch.advance = state ? advance_speed : 0;
                break;

            case 'r':
                player.touch.rotate = state ? rotate_speed : 0;
                break;

            case 'd':
                player.touch.advance = state ? -advance_speed : 0;
                break;

            case 'l':
                player.touch.rotate = state ? -rotate_speed : 0;
                break;
        }

        player.touch.rotating = state ? true : false;
    }

    function init_navpad() {
        $('.arrow-controls').show();

        $('.arrow-controls-dir').on('mousedown touchstart', function(e) {
            e.preventDefault();
            var dir = this.dataset.dir;
            do_navpad_dir(dir, 1);
            $(this).addClass('arrow-controls-dir-active');
        });

        $('.arrow-controls-dir').on('mouseup touchend', function(e) {
            e.preventDefault();
            var dir = this.dataset.dir;
            do_navpad_dir(dir, 0);
            $(this).removeClass('arrow-controls-dir-active');
        });

        canvas.el.addEventListener('touchstart', function(e) {
            // prevent select
            e.preventDefault();
        });
    }

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
            // save areas from local storage
            var s = localStorage.getItem('level.areas');
            save_file_as(s, 'level.areas.txt', 'text/plain');
        });
        
        key('x', trigger_plane);

        key('l', function() {
            //open_link(links[0]);
            level.load_areas_from_local_storage();
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
