$(function() {
    FastClick.attach(document.body);

    /*
    var ctx = new (window.AudioContext || window.webkitAudioContext);

    function start_source(source) {
        if (typeof source.start === 'undefined') {
            source.noteOn(0);
        } else {
            source.start();
        }
    }

    function unlock() {
        console.log('unlocking...');
        var source = ctx.createBufferSource();
        source.buffer = ctx.createBuffer(2, 1024, 22050);
        source.connect(ctx.destination);
        //start_source(source);
        source.onended = function() {
            console.log('unlocked');
            source.disconnect(0);
            document.removeEventListener('touchend', unlock, true);
        };
        source.start();
        //setInterval(function() { console.log('state:', 0); }, 100);
    }
    document.addEventListener('touchend', unlock, true);
    */

    /*
    function Sound(o) {
        var src = o.src[0];
        var loop = o.loop;

        this.buffer = null;
        this.source = null;

        var self = this;
        fetch(src)
            .then(r => r.arrayBuffer())
            .then(ab => {
                ctx.decodeAudioData(ab, function(buf) {
                    self.buffer = buf;
                    self.emit('load');
                });
            });

        //var source = ctx.createBufferSource();
        //source.buffer = X;
        //source.connect(ctx.destination);
        //source.start()

        this.listeners = {};
    }

    Sound.prototype.emit = function(name) {
        var l = this.listeners[name];
        if (l) {
            l.forEach(cb => cb(this));
        }
    };

    Sound.prototype.on = function(name, cb) {
        this.listeners[name] = this.listeners[name] || [];
        this.listeners[name].push(cb);
    };

    Sound.prototype.playing = function() {
        return !!this.source;
    };

    Sound.prototype.play = function() {
        if (!this.buffer)
            return;

        if (this.source)
            return;

        this.source = ctx.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(ctx.destination);
        start_source(this.source);
        //this.source.start();
    };

    Sound.prototype.stop = function() {
        if (!this.source)
            return;

        this.source.stop();
        this.source = null;
    };
    */

    //Howler.mobileAutoEnable = false;

    function get_sound(path, loop) {
        var base_url = 'sounds/' + path;
        //var exts = ['mp3', 'webm', 'm4a'];
        var exts = ['ogg', 'm4a', 'mp3'];
        var src = _.map(exts, function(ext) { return base_url + '.' + ext });
        return new Howl({ src: src, loop: loop });
    }

    var sounds = {
        intro: get_sound('3ww_intro', true),
        howl1: get_sound('howl1', false),
        howl2: get_sound('howl2', false),
        brass1: get_sound('brass1', false),
        brass2: get_sound('brass2', false),
        pool1: get_sound('pool1', true),
        pool2: get_sound('pool2', true),
        campfire: get_sound('campfire_c', true),
        screech: get_sound('screech_and_bump', false),
        siren: get_sound('siren', false),
        plane_splash: get_sound('plane_splash', false),
        door_open: get_sound('door_open', false),
    };

    _.each(sounds, (s, k) => {
        var b = $('<button>').text(k);
        $('.buttons').append(b);

        s.on('load', () => b.css({ backgroundColor: 'pink' }));

        b.on('click', function() {
            if (s.playing()) {
                s.stop();
                b.css({ backgroundColor: 'pink' });
            } else {
                s.play();
                b.css({ backgroundColor: 'lightgreen' });
            }
        });
    });

});
