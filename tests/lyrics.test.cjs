const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Compile the actual pure TypeScript modules without introducing a test runtime dependency.
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }, fileName: filename,
  });
  module._compile(outputText, filename);
};
const { LrclibProvider } = require('../lib/lyrics/lrclib.ts');
const { getLyricsProvider } = require('../lib/lyrics/provider.ts');
const { normalizeTitle, normalizeArtist, titleSimilarity } = require('../lib/lyrics/match.ts');
const { transliterateTelugu } = require('../lib/lyrics/telugu.ts');
const { parseLrc } = require('../lib/lyrics/lrc.ts');
const { customLyrics, toLrc } = require('../lib/lyrics/custom.ts');
const { getCached, setCached } = require('../lib/lyrics/cache.ts');
const query = { title: 'Samajavaragamana (From "Ala Vaikunthapurramuloo")', artist: 'Thaman S, Sid Sriram', album: 'Ala Vaikunthapurramuloo', durationMs: 219000 };
const record = (patch={}) => ({ id: 1, trackName: 'Samajavaragamana', artistName: 'Sid Sriram', albumName: query.album, duration: 219, instrumental: false, plainLyrics: 'తెలుగు పరీక్ష\nరెండవ పంక్తి', syncedLyrics: '[00:10.00] తెలుగు పరీక్ష\n[00:20.00] రెండవ పంక్తి', ...patch });
const response = (body, status=200) => new Response(JSON.stringify(body), { status });
async function mockedFetch(handler, run) {
  const original = global.fetch;
  global.fetch = async (url, init) => handler(new URL(url), init);
  try { return await run(); } finally { global.fetch = original; }
}

test('film suffixes and spacing variants match without breaking artist names or Telugu marks', () => {
  assert.equal(normalizeTitle(query.title), 'Samajavaragamana');
  assert.equal(normalizeTitle('Butta Bomma - From "Ala Vaikunthapurramuloo"'), 'Butta Bomma');
  assert.equal(normalizeArtist('Daft Punk, Singer'), 'Daft Punk');
  assert.equal(titleSimilarity('Inkem Inkem Inkem Kaavaale', 'Inkem Inkem Inkem Kavale'), .95);
  assert.equal(titleSimilarity('తెలుగు పాట', 'తెలుగుపాట'), 1);
  assert.equal(transliterateTelugu('బుట్ట బొమ్మ'), 'butta bomma');
  assert.equal(titleSimilarity('బుట్ట బొమ్మ', 'Butta Bomma'), 1);
});

test('plain exact match does not hide a singer-credited synced version from title-only search', async () => {
  const calls = [];
  const doc = await mockedFetch((url) => {
    calls.push(url.toString());
    if (url.pathname.endsWith('/get')) return response(record({ syncedLyrics:null, artistName:query.artist }));
    return response(url.searchParams.has('artist_name') ? [] : [record({ id: 2 })]);
  }, () => new LrclibProvider().getLyrics(query));
  assert.equal(doc.synced, true);
  assert.equal(doc.providerId, '2');
  assert.ok(calls.some((url) => url.includes('track_name=Samajavaragamana') && !url.includes('artist_name=')));
});

test('empty exact records do not suppress search, and concurrent lookups share requests', async () => {
  let calls = 0;
  const provider = new LrclibProvider();
  await mockedFetch((url) => {
    calls++;
    return response(url.pathname.endsWith('/get') ? record({plainLyrics:null,syncedLyrics:null}) : [record()]);
  }, async () => {
    const [a,b] = await Promise.all([provider.getLyrics(query),provider.getLyrics(query)]);
    assert.equal(a.synced,true); assert.equal(a,b); assert.equal(calls,2);
  });
});

test('wrong durations, unrelated titles, cover recordings and empty timestamps are rejected', async () => {
  const candidates = [record({id:2,duration:300}), record({id:3,trackName:'Some other song'}), record({id:4,trackName:'Samajavaragamana (Cover)'}), record({id:5,syncedLyrics:'[00:01.00]',plainLyrics:null})];
  const doc = await mockedFetch((url) => url.pathname.endsWith('/get') ? response({},404) : response(candidates), () => new LrclibProvider().getLyrics(query));
  assert.equal(doc.notFound,true);
});

test('an unusable exact result retains available plain text while searching for sync', async () => {
  const plain = record({ syncedLyrics:'[99:00.00] beyond this song' });
  const doc = await mockedFetch((url) => response(url.pathname.endsWith('/get') ? plain : [plain]), () => new LrclibProvider().getLyrics(query));
  assert.equal(doc.synced,false); assert.ok(doc.plain); assert.equal(doc.notFound,false);
});

test('a provider outage is thrown rather than negative-cached as missing lyrics', async () => {
  await mockedFetch(() => { throw Error('offline'); }, async () => {
    await assert.rejects(new LrclibProvider().getLyrics(query), /offline/);
  });
});

test('second source recovers real text when LRCLIB is unavailable; text is never called synced', async () => {
  const doc = await mockedFetch((url) => {
    if (url.hostname === 'lrclib.net') throw Error('offline');
    assert.equal(url.hostname, 'api.lyrics.ovh');
    return response({ lyrics: 'తెలుగు పరీక్ష\nరెండవ పంక్తి' });
  }, () => getLyricsProvider().getLyrics({...query,title:'Second source test'}));
  assert.equal(doc.source,'lyrics.ovh'); assert.equal(doc.synced,false); assert.ok(doc.plain);
});

test('LRC preserves Telugu, repeats, enhanced tags and applies millisecond offsets', () => {
  assert.deepEqual(parseLrc('[offset:200]\n[00:01.00][00:03.50] తెలుగు <00:01.50>పరీక్ష\n[00:02.000] రెండవ పంక్తి'),[
    { tMs:800,text:'తెలుగు పరీక్ష' },{ tMs:1800,text:'రెండవ పంక్తి' },{ tMs:3300,text:'తెలుగు పరీక్ష' },
  ]);
  assert.deepEqual(parseLrc('[00:99.00] invalid'),[]);
});

test('custom synced lyrics round-trip and reject timestamps outside the recording', () => {
  const lines=[{tMs:1234,text:'తెలుగు పరీక్ష'},{tMs:2567,text:'రెండవ పంక్తి'}];
  const doc=customLyrics(toLrc(lines),'track',10000,1);
  assert.deepEqual(doc.lines,lines); assert.equal(doc.synced,true);
  assert.throws(()=>customLyrics('[00:20.00] text','track',10000,1),/recording/);
  assert.throws(()=>customLyrics('[00:99.00] text','track',10000,1),/valid LRC/);
  assert.equal(customLyrics('తెలుగు పరీక్ష','track',10000,1).synced,false);
});

test('misses expire quickly and plain text is rechecked for new timing data', () => {
  const now=Date.now; let time=1000000; Date.now=()=>time;
  try {
    setCached('missing',{notFound:true}); setCached('plain',{notFound:false,synced:false}); setCached('synced',{synced:true});
    time+=31000;
    assert.equal(getCached('missing'),null); assert.ok(getCached('plain'));
    time+=5*60000;
    assert.equal(getCached('plain'),null); assert.ok(getCached('synced'));
  } finally { Date.now=now; }
});


test('native Telugu title finds a romanized catalog entry through the search fallback', async () => {
  const q={...query,title:'బుట్ట బొమ్మ',durationMs:194000};
  const doc=await mockedFetch((url)=> {
    if(url.pathname.endsWith('/get'))return response({},404);
    const native=String(url.searchParams.get('track_name')).includes('బుట్ట');
    return response(native ? [] : [record({trackName:'Butta Bomma',duration:194})]);
  },()=>new LrclibProvider().getLyrics(q));
  assert.equal(doc.synced,true);
});

test('a requested live recording cannot silently match the studio version', async () => {
  const q={...query,title:'Samajavaragamana - Live'};
  const doc=await mockedFetch((url)=>url.pathname.endsWith('/get') ? response({},404) : response([record()]),()=>new LrclibProvider().getLyrics(q));
  assert.equal(doc.notFound,true);
});
