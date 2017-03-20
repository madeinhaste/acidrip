import {vec2, vec3, vec4} from 'gl-matrix';

var re_attrib_format = /([1-4])(f|x|b|ub|s|us)(\*?)/;

var attrib_types = {
    f: {
        type: 'float',
        size: 4,
        dataview_get: DataView.prototype.getFloat32,
        dataview_set: DataView.prototype.setFloat32,
    },

    x: {
        type: 'fixed',
        size: 4,
        dataview_get: DataView.prototype.getUint32, // XXX correct?
        dataview_set: DataView.prototype.setUint32,
    },

    b: {
        type: 'byte',
        size: 1,
        dataview_get: DataView.prototype.getInt8,
        dataview_set: DataView.prototype.setInt8,
    },

    ub: {
        type: 'unsigned_byte',
        size: 1,
        dataview_get: DataView.prototype.getUint8,
        dataview_set: DataView.prototype.setUint8,
    },

    s: {
        type: 'short',
        size: 2,
        dataview_get: DataView.prototype.getInt16,
        dataview_set: DataView.prototype.setInt16,
    },

    us: {
        type: 'unsigned_short',
        size: 2,
        dataview_get: DataView.prototype.getUint16,
        dataview_set: DataView.prototype.setUint16,
    },
};

class VertexAttrib {
    constructor(name, format) {
        this.name = name;
        var m = re_attrib_format.exec(format);
        console.assert(m, 'Bad attribute format');
        this.format = format;

        this.size = parseInt(m[1]);

        var t = attrib_types[m[2]];
        this.type = gl[t.type.toUpperCase()];

        this.normalized = !!m[3];
        this.byte_size = this.size * t.size;
        this.byte_offset = 0;   // WARNING: not set until layout is complete

        var self = this;

        this.get = function(view, byte_offset, v) {
            var sp = byte_offset + self.byte_offset;
            if (this.size === 1) {
                return t.dataview_get(view, sp, true);
            } else {
                for (var i = 0; i < self.size; ++i) {
                    v[i] = t.dataview_get.call(view, sp, true);
                    sp += t.size;
                }
                return v;
            }
        };

        this.set = function(view, byte_offset, v) {
            var dp = byte_offset + self.byte_offset;
            if (this.size === 1) {
                t.dataview_set(view, dp, v, true);
            } else {
                for (var i = 0; i < self.size; ++i) {
                    v[i] = t.dataview_set.call(view, dp, v[i], true);
                    dp += t.size;
                }
            }
        };

        switch (this.size) {
            case 1:
                this.create = function() { return 0 };
                break;
            case 2:
                this.create = vec2.create;
                break;
            case 3:
                this.create = vec3.create;
                break;
            case 4:
                this.create = vec4.create;
                break;
        }

        // XXX integer types?
    }
}

export class VertexArray {
    constructor() {
        var length = 0;
        var layout = null;

        if (_.isNumber(arguments[0])) {
            length = arguments[0];
            layout = arguments[1];
        } else {
            layout = arguments[0];
        }

        var self = this;
        this.layout = {};
        var byte_offset = 0;
        _.each(layout, function(format, name) {
            var attrib = new VertexAttrib(name, format);

            attrib.byte_offset = byte_offset;
            byte_offset += attrib.byte_size;

            self.layout[name] = attrib;
        });

        this.byte_stride = byte_offset;

        this.length = length || 0;
        this.buffer = new ArrayBuffer(this.byte_stride * (length ? length : 1));
        this.buffer_view = new DataView(this.buffer);
    }

    gl_attrib_pointer(name, index, instanced) {
        if (index < 0)
            return;

        var attrib = this.layout[name];
        gl.vertexAttribPointer(index, attrib.size, attrib.type, attrib.normalized, this.byte_stride, attrib.byte_offset);
        if (instanced) {
            webgl.extensions.ANGLE_instanced_arrays.vertexAttribDivisorANGLE(index, 1);
        }
    }

    struct(v) {
        var v = {};   // Object.create(Object.prototype)
        _.each(this.layout, function(attrib, name) {
            v[name] = attrib.create();
        });
        return v;
    }

    append(v) {
        // ensure the underlying buffer is big enough
        var byte_capacity = this.buffer.byteLength;
        var required_byte_capacity = ((this.length + 1) * this.byte_stride);
        if (byte_capacity < required_byte_capacity) {
            var new_byte_capacity = byte_capacity << 1;
            var new_buffer = new ArrayBuffer(new_byte_capacity);
            (new Uint8Array(new_buffer)).set(new Uint8Array(this.buffer));

            // FIXME: _resize_buffer(byte_capacity) operation
            this.buffer = new_buffer;
            this.buffer_view = new DataView(this.buffer);
        }

        // save the vertex
        this.save(v, this.length++);
    }

    push(v) {
        return this.append(v);
    }

    trim() {
        // trim excess capacity
        var byte_capacity = this.buffer.byteLength;
        var required_byte_capacity = this.length * this.byte_stride;
        if (required_byte_capacity < byte_capacity) {
            this.buffer = this.buffer.slice(0, required_byte_capacity);
            this.buffer_view = new DataView(this.buffer);
        }
    }

    // vertex accessors
    save(v, index) {
        var view = this.buffer_view;
        var byte_offset = index * this.byte_stride;
        _.each(this.layout, function(attrib) {
            attrib.set(view, byte_offset, v[attrib.name]);
        });
    }

    load(v, index) {
        var view = this.buffer_view;
        var byte_offset = index * this.byte_stride;
        _.each(this.layout, function(attrib) {
            v[attrib.name] = attrib.get(view, byte_offset, v[attrib.name]);
        });
    }

    // iterators
    each(fn) {
        // FIXME cache this
        var v = this.struct();

        for (var i = 0; i < this.length; ++i) {
            this.load(v, i);
            fn(v, i);   // XXX maybe return true to save?
            this.save(v, i);
        }
    }

    each_triangle(fn) {
        // FIXME cache this
        var v = [
            this.struct(),
            this.struct(),
            this.struct(),
            ];
        
        for (var i = 0; i < this.length; i += 3) {
            for (var j = 0; j < 3; ++j)
                this.load(v[j], i + j);

            fn(v, i/3);

            for (var j = 0; j < 3; ++j)
                this.save(v[j], i + j);
        }
    }

    each_triangle_indexed(elems, fn) {
        // FIXME cache this
        var v = [
            this.struct(),
            this.struct(),
            this.struct(),
            ];
        
        for (var i = 0; i < elems.length; i += 3) {
            for (var j = 0; j < 3; ++j)
                this.load(v[j], elems[i + j]);

            fn(v, i/3);

            for (var j = 0; j < 3; ++j)
                this.save(v[j], elems[i + j]);
        }
    }
}
