import {cp, mkdir, rm} from 'node:fs/promises';

const source = new URL('../assets/posenet/mobilenet-v1-075-stride16/', import.meta.url);
const destination = new URL('../dist/posenet/mobilenet-v1-075-stride16/', import.meta.url);

await rm(destination, {force: true, recursive: true});
await mkdir(destination, {recursive: true});
await cp(source, destination, {recursive: true});
