import {Canvas3D} from './Canvas3D';
import {vec3, mat4} from 'gl-matrix';
import {Player} from './player';
import {StageRenderer} from './StageRenderer';
import {load_stages} from './Stage';

window.main = function() {
    var canvas = new Canvas3D({
        antialias: false,
        extensions: [ 'OES_standard_derivatives' ],
        sources: [ 'shaders/tmd.glsl' ]
    });
    console.assert(gl);

    canvas.camera.far = 10000;
    canvas.light_pos = vec3.fromValues(100, 100, 100);
    canvas.light_pos_v = vec3.create();

    $(canvas.el).addClass('webgl');
    $('#main').prepend(canvas.el);

    var player = new Player;

    var stages = [];
    var stage_renderer = new StageRenderer;
    var stage_id = 5;

    load_stages().then(d => {
        stages = d;
        var stage = stages[stage_id];
        stage.load();
        stage_renderer.setup(canvas, stage);
    });
    
    function animate() {
        requestAnimationFrame(animate);
        if (player.check_keys())
            canvas.redraw();
    }
    animate();

    // connect window resize event
    window.onresize = function() { canvas.redraw() };

    // canvas drawing
    canvas.draw = function() {
        stage_renderer.draw(this);
        player.draw(this);
    };

    /*
    function setup_tix_viewer() {
        var $tix_canvas = $(tix.canvas).addClass('texture').hide();
        $('#main').append($tix_canvas);
        key('t', () => { $('canvas.texture').toggle(); });
    }
    */
}
