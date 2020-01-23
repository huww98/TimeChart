import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
// import sourceMaps from 'rollup-plugin-sourcemaps'
import typescript from '@rollup/plugin-typescript'

const pkg = require('./package.json')

export default {
    input: `src/index.ts`,
    output: [
        {
            file: pkg.main,
            globals: {
                'd3-color': 'd3',
                'd3-selection': 'd3',
                'd3-scale': 'd3',
                'd3-axis': 'd3',
            },
            name: 'TimeChart',
            format: 'umd',
            sourcemap: true
        },
        { file: pkg.module, format: 'es', sourcemap: true },
    ],
    external: ['d3-color', 'd3-selection', 'd3-scale', 'd3-axis'],
    watch: {
        include: 'src/**',
    },
    plugins: [
        typescript(),
        commonjs(),
        resolve(),
    ],
}
