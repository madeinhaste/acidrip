module.exports = {
    context: __dirname + '/src',
    entry: {
        main: './main.js',
    },
    output: {
        path: __dirname + '/dist',
        filename: '[name].bundle.js',
        publicPath: '/assets/',
    },
    module: {
        rules:[
            //{ test: /\.css$/, use: ['style-loader', 'css-loader'] },
            //{ test: /\.(sass|scss)$/, use: ['style-loader', 'css-loader', 'sass-loader'] },
        ],
    },
    devtool: 'source-map',
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
