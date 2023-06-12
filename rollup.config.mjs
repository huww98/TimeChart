import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import terser from "@rollup/plugin-terser";

import pkg from './package.json' assert {type: 'json'};

const ts = typescript({ compilerOptions: {outDir: 'dist', declaration: false}})

const config = {
    input: `src/index.ts`,
    output: [
        {
            file: pkg.main,
            globals(id) {
                return id.startsWith('d3-') ? 'd3' : id;
            },
            name: 'TimeChart',
            format: 'umd',
            sourcemap: true
        },
        {
            file: 'dist/timechart.min.js',
            globals(id) {
                return id.startsWith('d3-') ? 'd3' : id;
            },
            name: 'TimeChart',
            format: 'iife',
            plugins: [terser()],
            sourcemap: true
        },
        { file: 'dist/timechart.module.js', format: 'es', sourcemap: true },
    ],
    external: (id) => id.startsWith('d3-'),
    watch: {
        include: 'src/**',
    },
    plugins: [
        ts,
        commonjs(),
        resolve(),
    ],
}

const configPluginsExtra = {
    input: `src/plugins_extra/index.ts`,
    output: [
        {
            file: 'dist/timechart.plugins_extra.js',
            globals(id) {
                return id.startsWith('d3-') ? 'd3' : id;
            },
            name: 'TimeChart.plugins_extra',
            format: 'umd',
            sourcemap: true
        },
        {
            file: 'dist/timechart.plugins_extra.min.js',
            globals(id) {
                return id.startsWith('d3-') ? 'd3' : id;
            },
            name: 'TimeChart.plugins_extra',
            format: 'iife',
            plugins: [terser()],
            sourcemap: true
        },
    ],
    external: (id) => id.startsWith('d3-'),
    watch: {
        include: 'src/plugins_extra/**',
    },
    plugins: [
        ts,
        commonjs(),
        resolve(),
    ],
}

export default [
    config,
    configPluginsExtra,
];
