import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readdir, readFile, writeFile, stat, mkdir, symlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CheckpointStore } from '../../../chain-reader/src/checkpoint-store';

test('serialized checkpoint transport preserves bounds and malformed caches fail closed',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pons-checkpoint-wire-'));
  const store=new CheckpointStore(directory,512,4096,4);
  const payload=JSON.stringify({hello:'garden',n:42});
  assert(await store.saveSerialized('wire',payload));
  assert.equal(await store.loadSerialized('wire'),payload);
  assert.deepEqual(await store.load('wire'),JSON.parse(payload));
  assert.equal(await store.saveSerialized('wire','x'.repeat(513)),false);
  assert.equal(await store.loadSerialized('wire'),payload);
  assert.equal(await store.save('wire',undefined),false);
  const cycle:any={};cycle.self=cycle;assert.equal(await store.save('wire',cycle),false);
  assert(await store.saveSerialized('invalid','{'));
  assert.equal(await store.load('invalid'),null);
});

test('checkpoint storage survives reopening, isolates keys and rejects corrupted payloads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pons-checkpoints-'));
  const store = new CheckpointStore(directory);
  assert.equal(await store.load('scope-A'), null);
  assert(await store.save('scope-A', { head: 4, logs: ['verified'] }));
  assert.deepEqual(await new CheckpointStore(directory).load('scope-A'), { head: 4, logs: ['verified'] });
  assert.equal(await store.load('scope-B'), null);
  const file = join(directory, (await readdir(directory))[0]);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const envelope = JSON.parse(await readFile(file, 'utf8')); envelope.payload = '{"head":999}';
  await writeFile(file, JSON.stringify(envelope)); assert.equal(await store.load('scope-A'), null);
});

test('independent processes cannot exceed shared checkpoint entry quota',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pons-checkpoint-process-'));
  const modulePath=require.resolve('../../../chain-reader/src/checkpoint-store');
  const script=`const {CheckpointStore}=require(process.argv[1]);new CheckpointStore(process.argv[2],512,4096,1).save(process.argv[3],{n:1}).then(v=>console.log(v));`;
  const results=await Promise.all(Array.from({length:8},(_,i)=>promisify(execFile)(process.execPath,['-e',script,modulePath,directory,String(i)])));
  assert.equal(results.filter(r=>r.stdout.trim()==='true').length,1);
  assert.equal((await readdir(directory)).filter(n=>n.endsWith('.json')).length,1);
  assert(!(await readdir(directory)).includes('.write-lock'));
});

test('abandoned lock fails closed while reads remain usable; symlink cache files are rejected',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pons-checkpoint-abandoned-'));
  const store=new CheckpointStore(directory);
  assert(await store.save('A',{n:1}));
  await mkdir(join(directory,'.write-lock')); // State left by interrupted writer.
  assert.equal(await store.save('B',{n:2}),false);
  assert.deepEqual(await store.load('A'),{n:1});
  const file=(await readdir(directory)).find(n=>n.endsWith('.json'))!;
  const other=await mkdtemp(join(tmpdir(),'pons-checkpoint-symlink-'));
  await symlink(join(directory,file),join(other,file));
  assert.equal(await new CheckpointStore(other).load('A'),null);
});

test('checkpoint write limits serialize concurrent wallets and preserve prior valid data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pons-checkpoint-limit-'));
  const store = new CheckpointStore(directory, 512, 512, 1);
  assert.deepEqual(await Promise.all([store.save('A', { n: 1 }), store.save('B', { n: 2 })]), [true, false]);
  assert.equal(await store.save('A', 'x'.repeat(1000)), false);
  assert.deepEqual(await store.load('A'), { n: 1 });
  assert(await store.save('A', { n: 3 })); assert.deepEqual(await store.load('A'), { n: 3 });
  assert((await readdir(directory)).every(n => n.endsWith('.json')));
});
