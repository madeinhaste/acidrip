module.exports = {
    files: 'static/**/*',
    server: {
        baseDir: 'static',
        directory: true,
        routes: {
            '/assets': 'dist'
        },
    },
    port: 9000
};
