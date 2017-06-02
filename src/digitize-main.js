import {vec2, mat2d} from 'gl-matrix';
import msgpack from 'msgpack-lite';
import {save_file_as} from './utils';

const text = [
    //"Love is just a button we pressed",
    //"last night by the camp fire."

    //"Neon, a blue neon lamp",
    //"in a midnight country field."

    //"Girls from the pool say 'Hi'"

    //"Pool summer summer pool summer vibes killed",
    //"In cold blood",

    //"How green",
    //"How green was my valley?"

    "Pay up sign up LA",
];

class Stroke {
    constructor() {
        this.points = [];
    }

    add_point(x, y) {
        this.points.push(x, y);
    }

    draw(ctx) {
        ctx.beginPath();
        for (var i = 0; i < this.points.length; i += 2) {
            var x = this.points[i];
            var y = this.points[i+1];
            if (i)
                ctx.lineTo(x, y);
            else
                ctx.moveTo(x, y);
        }
        //ctx.lineWidth = 2;
        ctx.strokeStyle = '#ff0';
        ctx.stroke();
    }

    transformMat2d(mat) {
        var tmp = vec2.create();
        for (var i = 0; i < this.points.length; i += 2) {
            tmp[0] = this.points[i];
            tmp[1] = this.points[i+1];

            vec2.transformMat2d(tmp, tmp, mat);

            this.points[i] = tmp[0];
            this.points[i+1] = tmp[1];
        }
    }
}

export function digitize_main() {
    var canvas = document.querySelector('canvas');
    var ctx = canvas.getContext('2d');
    var cw, ch;

    var strokes = [];
    var stroke = null;

    var done = false;

    function resize() {
        cw = canvas.width = canvas.clientWidth;
        ch = canvas.height = canvas.clientHeight;
        redraw();
    }
    window.onresize = resize;
    resize();

    function draw_strokes() {
        strokes.forEach(stroke => {
            stroke.draw(ctx);
        });
    }

    ctx.font = '250px "Merriweather Sans"';

    function redraw() {
        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = '#282828';
        ctx.font = '160px "Merriweather Sans"';

        var th = 300;
        var ty = 400;
        var tx = 0;
        text.forEach(line => {
            var tw = ctx.measureText(line).width;
            ctx.fillText(line, tx + (cw - tw)/2, ty);
            ty += th;
        });

        if (done) {
            ctx.save();
            ctx.translate(cw/2, ch/2);
            ctx.scale(500, 500);
            ctx.lineWidth = 1/500;

            ctx.fillStyle = '#334';
            ctx.fillRect(-1, -1, 2, 2);

            draw_strokes();
        } else {
            ctx.lineWidth = 2;
            draw_strokes();
        }

    }

    var pos = vec2.create();

    canvas.onmousedown = function(e) {
        stroke = new Stroke;
        strokes.push(stroke);
        vec2.set(pos, e.offsetX, e.offsetY);
        stroke.add_point(pos[0], pos[1]);
        redraw();
    };

    document.onmousemove = function(e) {
        if (stroke) {
            const kappa = 0.1;
            vec2.lerp(pos, pos, [e.offsetX, e.offsetY], kappa);
            stroke.add_point(pos[0], pos[1]);
            redraw();
        }
    };

    document.onmouseup = function(e) {
        if (stroke) {
            stroke.add_point(e.offsetX, e.offsetY);
            stroke = null;
            redraw();

            var total_points = 0;
            strokes.forEach(s => { total_points += s.points.length/2 });
            $('#debug').text(`strokes: ${strokes.length}  points: ${total_points}`);
        }
    };

    key('z', function() {
        strokes.pop();
        redraw();
    });

    key('d', function() {
        // clip & normalize
        var bbox = [Infinity, Infinity, -Infinity, -Infinity];
        strokes.forEach(stroke => {
            for (var i = 0; i < stroke.points.length; i += 2) {
                var x = stroke.points[i + 0];
                var y = stroke.points[i + 1];
                bbox[0] = Math.min(bbox[0], x);
                bbox[1] = Math.min(bbox[1], y);
                bbox[2] = Math.max(bbox[2], x);
                bbox[3] = Math.max(bbox[3], y);
            }
        });

        var mat = mat2d.create();
        var scale = 2/(bbox[2] - bbox[0])
        mat2d.translate(mat, mat, [-1, 0]);
        mat2d.scale(mat, mat, [scale, scale]);

        //var ty = (bbox[3] - bbox[1])/2;
        //mat2d.translate(mat, mat, [0, ty]);

        var ty = (bbox[1] + bbox[3])/2;
        mat2d.translate(mat, mat, [-bbox[0], -ty]);

        strokes.forEach(stroke => stroke.transformMat2d(mat));

        var out = [];
        strokes.forEach(stroke => {
            out.push(new Float32Array(stroke.points));
        });
        //var json = JSON.stringify(out);
        var file = msgpack.encode(out);
        //save_file_as(json, 'lyrics.json', 'application/json');
        save_file_as(file, 'lyrics.msgpack', 'application/x-msgpack');

        done = true;
        redraw();
    });
}
