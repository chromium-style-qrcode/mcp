import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * @type {import('rollup').RollupOptions}
 */
export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: !isProduction,
    preserveModules: true,
    preserveModulesRoot: 'src',
    banner: '#!/usr/bin/env node',
    entryFileNames: '[name].js',
  },
  external: [
    '@chromium-style-qrcode/generator',
    '@modelcontextprotocol/sdk',
    '@modelcontextprotocol/sdk/server/index.js',
    '@modelcontextprotocol/sdk/server/stdio.js',
    '@modelcontextprotocol/sdk/types.js',
    '@napi-rs/canvas',
    'zod',
    /node:/,
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
      outDir: 'dist',
    }),
    nodeResolve({
      preferBuiltins: true,
    }),
    commonjs(),
    json(),
  ],
};
