import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Game} from '../game';
import {SESSION_REPLACED_CLOSE,IDENTITY_REJECTED_CLOSE} from '../../../shared/protocol';

test('only an authenticated replacement closes the previous session with a terminal signal',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pons-session-replaced-'));
  const game=new Game(directory);await game.initialize();
  const hello={t:'hello' as const,id:'sessionreplace123',secret:'sessionreplacesecret',name:'Session QA'};
  const messages:any[]=[],closed:unknown[][]=[];
  const socket=()=>({OPEN:1,readyState:1,send(raw:string){messages.push(JSON.parse(raw));},close(...args:unknown[]){closed.push(args);this.readyState=3;}} as any);
  try{
    const first=socket(),second=socket();const original=game.join(first,hello)!;
    assert.equal(game.join(second,{...hello,secret:'wrong-secret'}),null);
    assert.deepEqual(closed,[[IDENTITY_REJECTED_CLOSE,'sign-in rejected']]);assert.equal(first.readyState,1);assert.equal(game.live.get(hello.id),original);
    const fresh=socket(),replacement=game.join(fresh,hello)!;
    assert(replacement);assert.equal(game.live.get(hello.id)?.ws,fresh);assert.equal(game.live.size,1);
    assert(messages.some(m=>m.t==='error' && m.code==='session-replaced'));
    assert.deepEqual(closed,[[IDENTITY_REJECTED_CLOSE,'sign-in rejected'],[SESSION_REPLACED_CLOSE,'session replaced']]);
  }finally{await game.store.close();}
});
