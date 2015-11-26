var gulp = require('gulp');
var uglify = require('gulp-uglify');
var rename = require("gulp-rename");
var coffee = require("gulp-coffee");



gulp.task('default', function() {
    return gulp.src('src/*.coffee')
        .pipe(coffee())
        .pipe(gulp.dest('dist'));
});

gulp.task('minify', function() {
    return gulp.src('src/*.coffee')
        .pipe(coffee())
        .pipe(uglify())
        .pipe(rename({
            extname: '.min.js'
        }))
        .pipe(gulp.dest('dist'));
});