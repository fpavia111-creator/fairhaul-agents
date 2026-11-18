#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { main } from 'fairhaul-core';
import { manifest } from '../src/manifest.js';
import { demo } from '../src/demo.js';

main(manifest, { bin: 'fairhaul-ltl-reweighs', demo, evalFile: fileURLToPath(new URL('../evals/cases.json', import.meta.url)) });
