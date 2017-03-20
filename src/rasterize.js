import {vec2, vec4} from 'gl-matrix';

function edge_func(q0, q1) {
    // "Conservative and Tiled Rasterization Using a Modified Triangle Setup"
    // Akenine-Möller & Aila 2005
    var dx = q1[0] - q0[0];
    var dy = q1[1] - q0[1];

    var n = vec2.fromValues(-dy, dx);
    var c = -vec2.dot(n, q0);

    const gsize = 1;
    var tx = n[0] < 0 ? 0 : gsize;
    var ty = n[1] < 0 ? 0 : gsize;
    var et = vec2.dot(n, [tx, ty]) + c;

    return function(p) {
        //return vec2.dot(n, p) + c;
        return vec2.dot(n, p) + et;

        // 2 mults + 2 adds per edge
        // nx * px + ny * py + et
    }
}

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

function get_edge_funcs(poly) {
    var edges = [];
    var n = poly.length;
    for (var i = 0; i < n; i += 2) {
        var q0 = [
            poly[i + 0],
            poly[i + 1]
        ];

        var j = (i + 2) % n;
        var q1 = [
            poly[j + 0],
            poly[j + 1]
        ];

        var edge = edge_func(q0, q1);
        edges.push(edge);
    }
    return edges;
}

// poly is a list of [x, y]
// return a list of [x, y]
export function rasterize(poly) {
    var box = vec4.create();
    get_bounding_box(box, poly);

    var x0 = ~~box[0];
    var y0 = ~~box[1];
    var x1 = ~~box[2];
    var y1 = ~~box[3];

    var tiles = [];
    var edges = get_edge_funcs(poly);

    // scan the grid
    for (var y = y0; y <= y1; ++y) {
        for (var x = x0; x <= x1; ++x) {
            var px = x;
            var py = y;
            var p = [px, py];

            var good = true;
            for (var i = 0; i < 4; ++i) {
                if (edges[i](p) < 0) {
                    good = false;
                    break;
                }
            }

            if (good) {
                tiles.push(px, py);
            }
        }
    }

    return tiles;
}
