import {TIM} from './tim';

export class TIX {
    constructor() {
        this.groups = [];

        this.canvas = document.createElement('canvas');
        this.canvas.width = 2048;
        this.canvas.height = 1024;
        this.ctx = this.canvas.getContext('2d');

        this.texture = null;
    }

    read(f) {
        var ngroups = f.read_u32();
        for (var group_idx = 0; group_idx < ngroups; ++group_idx) {
            var group_top = f.read_u32();
            f.push();
            f.seek(group_top);
            var ntims = f.read_u32();
            if (ntims) {
                var group = [];
                this.groups.push(group);
            }
            for (var tim_idx = 0; tim_idx < ntims; ++tim_idx) {
                var tim_ptr = f.read_u32() + group_top;
                f.push();
                f.seek(tim_ptr);
                var tim = new TIM;
                tim.read(f);
                group.push(tim);
                f.pop();
            }

            f.pop();
        }
    }

    update_canvas() {
        this.ctx.clearRect(0, 0, 2048, 512);
        _.flatten(this.groups).forEach(tim => {
            this.ctx.putImageData(tim.image, 2*tim.xorg, tim.yorg);
        });
    }

    update_texture() {
        if (!this.texture) {
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }

        this.update_canvas();

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
    }
}
