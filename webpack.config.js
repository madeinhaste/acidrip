var path = require('path');

module.exports = {
    context: __dirname + '/src',
    entry: {
        main: './main.js',
    },
    output: {
        path: __dirname + '/dist',
        filename: '[name].bundle.js',
        publicPath: '/',
    },
    module: {
        rules:[
            {
                test: /\.js$/,
                include: path.join(__dirname, 'src'),
                loader: 'babel-loader',
                query: {
                    presets: [
                        'es2015'
                    ]
                }
            },
            {
                test: /\.glsl$/,
                include: path.join(__dirname, 'src'),
                loader: 'raw-loader'
            },
        ],
    },
    devtool: 'eval-source-map',
    devServer: {
        contentBase: [
            __dirname + '/static',
        ],
        host: '0.0.0.0',
        port: 8000
    },
    performance: {
        hints: false,
    },
};
