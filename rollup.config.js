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
            globals(id) {
                return id.startsWith('d3-') ? 'd3' : id;
            },
            name: 'TimeChart',
            format: 'umd',
            sourcemap: true
        },
        { file: pkg.module, format: 'es', sourcemap: true },
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
