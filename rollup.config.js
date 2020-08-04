import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import { terser } from "rollup-plugin-terser";

const pkg = require('./package.json')

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
        { file: 'dist/timechart.module.js', format: 'es', sourcemap: true },
    ],
    external: (id) => id.startsWith('d3-'),
    watch: {
        include: 'src/**',
    },
    plugins: [
        typescript(),
        commonjs(),
        resolve(),
    ],
}

const minConfig = {
    ...config,
    output: {
        ...config.output[0],
        file: `dist/timechart.min.js`
    },
    plugins: [
        ...config.plugins,
        terser(),
    ]
};

export default [
    config,
    minConfig,
]
