import {vec2, vec4} from 'gl-matrix';

function get_bounding_box(box, poly) {
    box[0] = box[2] = poly[0];
    box[1] = box[3] = poly[1];
    for (var i = 2; i < poly.length; i += 2) {
        var x = poly[i + 0];
        var y = poly[i + 1];
        box[0] = Math.min(box[0], x);
        box[1] = Math.min(box[1], y);
        box[2] = Math.max(box[2], x);
        box[3] = Math.max(box[3], y);
    }
}

var edges = new Float32Array(3 * 4);

// poly is a list of [x, y]
// return a list of [x, y]
export function rasterize(poly, callback) {
    console.assert(poly.length === 8);

    // "Conservative and Tiled Rasterization Using a Modified Triangle Setup"
    // Akenine-Möller & Aila 2005
    var n = poly.length;
    var dp = 0;
    for (var i = 0; i < n; i += 2) {
        var x0 = poly[i + 0];
        var y0 = poly[i + 1];

        var j = (i + 2) % n;
        var x1 = poly[j + 0];
        var y1 = poly[j + 1];

        var dx = x1 - x0;
        var dy = y1 - y0;

        var nx = -dy;
        var ny = dx;
        var c = -(nx * x0 + ny * y0);

        var tx = nx < 0 ? 0 : 1;
        var ty = ny < 0 ? 0 : 1;
        var et = (nx * tx + ny * ty) + c;

        edges[dp++] = nx;
        edges[dp++] = ny;
        edges[dp++] = et;
    }

    // bounding box
    var box = vec4.create();
    get_bounding_box(box, poly);

    var x0 = ~~box[0];
    var y0 = ~~box[1];
    var x1 = ~~box[2];
    var y1 = ~~box[3];

    // scan the grid
    //var tiles = [];
    for (var y = y0; y <= y1; ++y) {
        for (var x = x0; x <= x1; ++x) {
            var good = true;
            var sp = 0;
            for (var i = 0; i < 4; ++i) {
                var nx = edges[sp++];
                var ny = edges[sp++];
                var et = edges[sp++];
                var result = (nx * x + ny * y) + et;
                if (result < 0) {
                    good = false;
                    break;
                }
            }

            if (good)
                callback(x, y);
        }
    }
}
