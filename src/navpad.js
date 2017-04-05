export function create_navpad(size) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = canvas.height = size;

    var cs = 512;
    ctx.scale(size/cs, size/cs);

    //ctx.fillStyle = '#ccc';
    ctx.fillStyle = 'rgba(0,0,0, 0.5)';
    //ctx.fillRect(0, 0, cs, cs);
    ctx.strokeStyle = 'rgba(255,255,255, 0.25)';

    var lw = 3;
    ctx.lineWidth = lw;

    /*
    ctx.beginPath();
    ctx.arc(cs/2, cs/2, cs/2 - lw, 0, 2*Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    */

    function arrow() {
        var w0 = 0.32 * cs/2;
        var w = 0.85 * cs/2;
        var w2 = 0.5 * cs/2;
        var h = 30;
        var h2 = 62;

        ctx.beginPath();

        ctx.moveTo(w0, 0);
        ctx.lineTo(w0, -h);
        ctx.lineTo(w2, -h);
        ctx.lineTo(w2, -h2);

        ctx.lineTo(w, 0);
        ctx.lineTo(w2, h2);
        ctx.lineTo(w2, h);

        ctx.lineTo(w0, h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    ctx.save();
    ctx.translate(cs/2, cs/2);
    for (var i = 0; i < 4; ++i) {
        ctx.save();
        ctx.rotate(0.5*i*Math.PI);
        arrow();
        ctx.restore();
    }
    ctx.restore();
    return canvas;
}
