import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
    entry: 'main.js',
    format: 'es',
    plugins: [
        nodeResolve({
            //module: true,
            jsnext: false,
            main: true,
            //skip: ['xxx'],
            //browser: true,
            //extensions: ['.js', '.json'],
            //preferBuiltins: false
        }),
        commonjs()
    ]
};
