var gulp = require('gulp');
var usemin = require('gulp-usemin');
var uglify = require('gulp-uglify');
var cleanCSS = require('gulp-clean-css');
var del = require('del');

gulp.task('clean', function() {
    return del([
        'dist/**'
    ]);
});

gulp.task('assets', function() {
    var assets = [
        'data/**',
        'images/**',
        'photos/**',
        'sounds/**',
        'gifs/**',
        'fonts/**',
        'gifs.html',
        'photos.html',
    ];

    return gulp.src(assets, { cwd: 'static', base: 'static' })
        .pipe(gulp.dest('dist'));
});

 
gulp.task('usemin', function() {
    return gulp.src('static/index.html')
        .pipe(usemin({
            css: [ cleanCSS() ],
            js: [ uglify() ],
        }))
        .pipe(gulp.dest('dist'));
});

gulp.task('default', [
    //'clean',
    'usemin',
    'assets'
]);
