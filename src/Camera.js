import {RAD_PER_DEG} from './utils';
import {vec3, vec4, quat, mat3, mat4} from 'gl-matrix';

export default function Camera() {
    // projection parameters
    this.fov = 60;
    this.near = 0.01;
    this.far = 150;

    // matrices
    this.viewport = vec4.fromValues(0, 0, 1, 1);
    this.proj = mat4.create();
    this.view = mat4.create();
    this.bill = mat3.create();
    this.mvp = mat4.create();
    this.inv_mvp = mat4.create();
    this.inv_view = mat4.create();
    this.inv_proj = mat4.create();
    this.view_pos = vec3.create();
    this.view_dir = vec3.create();

    this.wide = 1024/720;
    this.wide = 1;
}
Camera.use_frustum = true;

var YUP = vec3.fromValues(0, 1, 0);
var ref = vec3.create();

function my_perspective(out, fovy, aspect, near, far, dx, dy) {
    if (!Camera.use_frustum) {
        mat4.perspective(out, fovy, aspect, near, far);
        return;
    }

    dx = dx || 0;
    dy = dy || 0;

    var T = 1.0*near * Math.tan(fovy/2);
    var B = -T;

    var R = T*aspect;
    var L = -R;

    var N = near;
    var F = far;

    dx *= (R - L);
    dy *= (T - B);
    
    mat4.frustum(out, L-dx, R-dx, B-dy, T-dy, N, F);
}

var R = vec3.create();
var U = vec3.create();
var P = vec3.create();
var F = vec3.create();

var theta = 0.0;
Camera.prototype.update = function(pos, dir, up) {
    up = up || YUP;
    var ortho = false;

    if (!ortho) {
        // projection
        var aspect = this.wide * this.viewport[2] / this.viewport[3];
        my_perspective(this.proj, this.fov * RAD_PER_DEG, aspect, this.near, this.far);
    } else {
        var z = ortho;
        mat4.ortho(this.proj, -z, z, -z, z, -this.far, -this.near);
    }

    // view
    vec3.add(ref, pos, dir);
    vec3.copy(P, pos);

    mat4.lookAt(this.view, P, ref, up);
    
    // billboard
    var b = this.bill;
    var v = this.view;
    b[0] = v[0]; b[1] = v[4]; b[2] = v[8];
    b[3] = v[1]; b[4] = v[5]; b[5] = v[9];
    b[6] = v[2]; b[7] = v[6]; b[8] = v[10];

    // combined
    mat4.multiply(this.mvp, this.proj, this.view);
    mat4.invert(this.inv_mvp, this.mvp);
    mat4.invert(this.inv_view, this.view);
    mat4.invert(this.inv_proj, this.proj);

    // XXX could be just pos/dir?
    vec3.transformMat4(this.view_pos, [0, 0, 0], this.inv_view);
    vec3.set(this.view_dir, -this.inv_view[8], -this.inv_view[9], -this.inv_view[10]);
};

Camera.prototype.update_quat = function(pos, rot) {
    // projection
    var aspect = this.viewport[2] / this.viewport[3];
    my_perspective(this.proj, this.fov * RAD_PER_DEG, aspect, this.near, this.far);

    // create a view matrix with a look-at
    mat4.fromRotationTranslation(this.view, rot, pos);
    mat4.invert(this.view, this.view);

    // billboard
    var b = this.bill;
    var v = this.view;
    b[0] = v[0]; b[1] = v[4]; b[2] = v[8];
    b[3] = v[1]; b[4] = v[5]; b[5] = v[9];
    b[6] = v[2]; b[7] = v[6]; b[8] = v[10];

    // combined
    mat4.multiply(this.mvp, this.proj, this.view);
    mat4.invert(this.inv_mvp, this.mvp);
    mat4.invert(this.inv_view, this.view);

    // XXX could be just pos/dir?
    vec3.transformMat4(this.view_pos, [0, 0, 0], this.inv_view);
    vec3.set(this.view_dir, -this.inv_view[8], -this.inv_view[9], -this.inv_view[10]);
};


var tmp4 = vec4.create();

Camera.prototype.unproject = function(out, win) {
    var v = tmp4;
    v[0] = 2 * (win[0] / this.viewport[2]) - 1;
    v[1] = 2 * (win[1] / this.viewport[3]) - 1;
    v[1] = 1 - v[1];
    v[2] = 0;
    v[3] = 1;

    vec4.transformMat4(v, v, this.mvpInv);
    out[0] = v[0] / v[3];
    out[1] = v[1] / v[3];
};
