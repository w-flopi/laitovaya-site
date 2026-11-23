import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

const media = await readdir('dist/clips');
const photos = await readdir('dist/media');
const files = ['index.html','folio.css','folio.js','booking.js',
  ...media.map(name => 'clips/' + name), ...photos.map(name => 'media/' + name)];
const entries = await Promise.all(files.map(async path => {
  const data = await readFile('dist/' + path);
  return ['/' + path, /\.(mp4|jpg|webp)$/.test(path) ? data.toString('base64') : data.toString('utf8')];
}));
const server = (await readFile('worker/booking.mjs','utf8')).replace('export async function', 'async function');
const handler = await readFile('worker/site.mjs','utf8');
await mkdir('dist/server',{recursive:true});
await writeFile('dist/server/index.js', server + '\nconst assets = ' + JSON.stringify(Object.fromEntries(entries)) + ';\n' + handler);
