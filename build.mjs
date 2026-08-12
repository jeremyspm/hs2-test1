/* Splices pack.js into cram-engine/template.html to produce the shipped
   single-file index.html. Run: node build.mjs
   The output is 100% offline and dependency-free — this build step exists
   only so the ~500-card pack stays editable in its own file. */
import { readFileSync, writeFileSync } from 'node:fs';

const TPL = '../cram-engine/template.html';
const START = '/* ===== CONTENT PACK START ===== */';
const END   = '/* ===== CONTENT PACK END ===== */';

const tpl  = readFileSync(TPL, 'utf8');
const pack = readFileSync('pack.js', 'utf8').replace(/^﻿/, '');

const a = tpl.indexOf(START), b = tpl.indexOf(END);
if (a < 0 || b < 0) { console.error('markers not found in template'); process.exit(1); }

// Figures live in the generated figs.js (ported byte-for-byte from
// hs2-module1). Inline them ahead of PACK so cards can call F('id')/FC('id').
const { FIG } = await import('./figs.js');
const used = new Set([...pack.matchAll(/\bFC?\('([a-z0-9-]+)'\)/g)].map(m => m[1]));
for (const id of used) if (!FIG[id]) { console.error(`pack references unknown figure "${id}"`); process.exit(1); }
const figBlock =
  'const FIGART={' + [...used].map(id => `'${id}':${JSON.stringify(FIG[id].art)}`).join(',\n') + '};\n' +
  'const FIGCAP={' + [...used].map(id => `'${id}':${JSON.stringify(FIG[id].cap)}`).join(',') + '};\n' +
  'const F=id=>FIGART[id]||\'\', FC=id=>FIGCAP[id]||\'\';\n';

/* Stats come from LOADING the pack, not from regexing it. pack.js is now generated
   JSON, so patterns written for the old hand-authored style (type:'flash', crit:'cvs-7')
   matched nothing and every count silently read zero — a build that reported "0 cards"
   while shipping 588. Loaded HERE rather than after the splice because the checklist
   block below needs the criterion list to join against. */
const { loadPack } = await import('./audit/load-pack.mjs');
const { pack: P } = loadPack();

/* ════════ THE CHECKLIST — generated from the corpus, never typed ════════════════
   `🗂 I'll choose` is the course's own assessable-criteria list, in the course's own
   words. The strings therefore come out of audit/corpus.json at build time and are
   spliced in; a literal typed into pack.js would be a paraphrase waiting to happen
   ([[porting-not-reimplementing]]). G-CHK1 below diffs every shipped string back
   against the corpus, so the page and the course document cannot diverge.

   Three things are AUTHORED, and each is gated: which pack criterion is which numbered
   row (checklist-map.json), which glossary entry a published term means where the two
   spell it differently (glossary-aliases.json), and nothing else. */
const { readChecklist, joinChecklist, ws: WS, normTerm } = await import('./audit/checklist.mjs');
let CHECK = null;
{
  const raw = JSON.parse(readFileSync('audit/checklist-map.json', 'utf8'));
  const map = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
  const aliasRaw = JSON.parse(readFileSync('audit/glossary-aliases.json', 'utf8'));
  const alias = Object.fromEntries(Object.entries(aliasRaw).filter(([k]) => !k.startsWith('_')));

  let doc;
  try { doc = readChecklist('audit/corpus.json'); }
  catch (e) { console.error(`✗ NOT SHIPPING. The checklist could not be read out of the corpus: ${e.message}`); process.exit(1); }

  /* The two case studies are NOT on the published checklist. They are this pack's own
     extra criteria and they carry about a fifth of the paper's marks, so they get their
     own block below the numbered list, headed honestly — never renumbered into it. The
     verbatim list is exactly 36 rows or the page has stopped being the course's
     document. Derived from the map, so declaring a third one is a one-line change. */
  const extra = P.criteria.filter((c) => !map[c.id]).map((c) => c.id);
  const { rows, fails } = joinChecklist(doc.items, map, P.criteria, extra);
  if (fails.length) {
    console.error('✗ NOT SHIPPING. The checklist ↔ pack join is not total:');
    for (const f of fails) console.error('    ' + f);
    process.exit(1);
  }

  /* ── G-CHK5: every published term reaches a glossary entry ───────────────────
     All 64 published terms DO have an entry; 8 of them only through an alias. A naive
     equality match renders those 8 as uncovered, which is a confidently-drawn gap that
     is not there. Resolved at BUILD time so the page ships links, not a lookup — and so
     this can fail rather than a reader finding a dead chip mid-revision.

     It fails in BOTH directions. An alias that is no longer needed is exactly the shape
     of the dead ALIAS that once silently deleted ten of her own questions: an
     indirection nothing disagrees with, because nothing can. */
  const gloss = new Map((P.glossary ?? []).map((g) => [normTerm(g.term), g.term]));
  const unresolved = [], usedAlias = new Set();
  const resolve = (t) => {
    const direct = gloss.get(normTerm(t));
    if (direct) return direct;
    const a = alias[t] ?? alias[WS(t)];
    if (a && gloss.get(normTerm(a))) { usedAlias.add(alias[t] ? t : WS(t)); return gloss.get(normTerm(a)); }
    return null;
  };
  let nTerms = 0;
  for (const r of rows) {
    if (!r.terms) continue;
    r.terms = r.terms.map((t) => {
      nTerms++;
      const g = resolve(t);
      if (!g) unresolved.push(`${r.sys} ${r.num}: "${t}"`);
      return { t, g };
    });
  }
  if (unresolved.length) {
    console.error(`✗ NOT SHIPPING. ${unresolved.length} published term(s) resolve to no glossary entry:`);
    for (const u of unresolved) console.error('    ' + u);
    console.error('   Add the entry, or an alias in audit/glossary-aliases.json if it is already there under another heading.');
    process.exit(1);
  }
  const dead = Object.keys(alias).filter((k) => !usedAlias.has(k));
  if (dead.length) {
    console.error(`✗ NOT SHIPPING. ${dead.length} glossary alias(es) are never needed: ${dead.join(', ')}`);
    console.error('   An indirection nothing disagrees with fails silently by construction. Delete it.');
    process.exit(1);
  }
  console.log(`the checklist is ${rows.length} rows in the course's own words · all ${nTerms} published terms reach the glossary (${usedAlias.size} via an alias) ✓`);

  CHECK = {
    rows,
    extra,
    block: 'PACK.checklist=' + JSON.stringify({
      title: 'Module 1 — Assessment Criteria',
      lead: 'The ' + rows.length + ' points the course publishes, in its own words. Everything in this tool is filed under one of them.',
      /* Word for word, typos included. The reader is holding this beside their own
         Canvas tab; a line we quietly corrected is a line they cannot find. */
      note: 'Copied word for word from the course’s own list — including its typos and its numbering, so you can match it against Canvas line by line. The short name under each one is this tool’s.',
      systems: doc.systems.map((s) => ({
        code: s.code, name: s.name,
        rows: s.items.map((it) => {
          const r = rows.find((x) => x.crit && x.sys === it.sys && x.num === it.num);
          return { crit: r.crit, num: it.num, text: it.text, subs: it.subs, terms: r.terms };
        }),
      })),
      extra,
      extraNote: 'Not on the published checklist — the two case studies every written question comes from.',
    }) + ';\n',
  };
}

let out = tpl.slice(0, a + START.length) + '\n' + figBlock + pack.trim() + '\n' + CHECK.block + tpl.slice(b);

/* ── the <title> in the head ─────────────────────────────────────────────────
   The splice only replaces what sits between the two markers, so the shipped page kept
   the TEMPLATE's title — "Cram Engine — Example Pack" — and hs2-test1 was the only one
   of the seven tools carrying it. The engine sets document.title from PACK at runtime,
   which is why nobody noticed: it self-corrects the moment the script runs. It does not
   self-correct in the static HTML, which is what a link preview, a search result, and
   the tab during a 3.5 MB load actually read.

   Taken from PACK.title rather than hardcoded, and it must actually change something —
   a template whose <title> has been renamed should say so rather than silently do
   nothing. */
{
  const title = (pack.match(/^\s*"title":\s*("(?:[^"\\]|\\.)*")/m) ?? [])[1];
  if (!title) { console.error('✗ pack.js has no "title" — cannot set the page <title>'); process.exit(1); }
  const before = out;
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${JSON.parse(title)}</title>`);
  if (out === before) { console.error('✗ no <title> found in the template to replace'); process.exit(1); }
}

/* Filled by the runtime smoke test below (the shipped page counting its own rings) and
   checked against audit/spine.mjs further down, where the pack object is loaded. */
let ENGINE_RINGS = null;
/* Same hoist as ENGINE_RINGS, and for the same reason: `ctx` is local to the smoke
   test, and these are read where the pack object is loaded. */
let ENGINE_YIELD = null, ENGINE_SHARE = null, ENGINE_STOP = null;

// Parse the generated page's scripts before writing. A stray apostrophe inside a
// single-quoted card string kills the whole app silently — the page still renders,
// it just runs no JavaScript. Never ship without this passing.
for (const [i, m] of [...out.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].entries()) {
  try { new Function(m[1]); }
  catch (e) {
    const line = (m[1].slice(0, Number(String(e.lineNumber ?? 0)) || 0).match(/\n/g) || []).length;
    console.error(`✗ script block ${i} does not parse: ${e.message}`);
    const bad = m[1].split('\n').find(l => /model:'|a:'|q:'|why:'/.test(l) && /[^\\]'[a-z]/.test(l.replace(/^\s*\w+:'/, '')));
    if (bad) console.error('  likely culprit (unescaped apostrophe):\n  ' + bad.trim().slice(0, 160));
    process.exit(1);
  }
}
/* ── runtime smoke test ───────────────────────────────────────────────────────
   THE PARSE CHECK ABOVE IS NOT ENOUGH, and this exists because it let a dead build
   through. A `const` declared 500 lines below its first use is syntactically perfect
   and throws "Cannot access X before initialization" the moment the page runs — the
   whole app died before rendering a single card, and every gate below still passed
   because they read the pack object, not the page.

   So: execute the shipped page's main script against a stub DOM and require it to reach
   the end. This cannot prove the tool WORKS — only a browser does that — but it catches
   the class of failure where the file is fine and the program is not, which is the one
   the parse check is blind to and the one that ships silently. */
{
  const script = [...out.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0];
  const el = () => new Proxy({}, {
    get: (t, k) => k === 'style' || k === 'classList' || k === 'dataset' ? el()
      : k === 'innerHTML' || k === 'textContent' || k === 'value' || k === 'className' ? ''
      : k === 'hidden' || k === 'checked' ? false
      : typeof k === 'string' && k.startsWith('on') ? null
      : el,
    set: () => true,
    apply: () => el(),
  });
  const doc = {
    querySelector: () => el(), querySelectorAll: () => [],
    addEventListener() {}, createElement: () => el(), documentElement: el(), body: el(),
    get title() { return this._t ?? ''; }, set title(v) { this._t = v; },
  };
  const store = new Map();
  const ctx = {
    document: doc, console: { log() {}, warn() {}, error() {} },
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    location: { search: '', origin: 'file://', pathname: '/index.html', href: '' },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    setTimeout: () => 0, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    /* Added when G25 first drove a set to its end: the done screen scrolls to the top,
       and no gate had ever reached that path, so the stub had never needed it. A stub
       grows only when a probe walks somewhere real code goes. */
    scrollTo() {}, fetch: () => ({ catch() {} }),
    URLSearchParams, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Set, Map, Proxy, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  const vm = await import('node:vm');
  vm.createContext(ctx);
  /* ── G13 IS RETIRED, AND ITS SUCCESSOR IS G-CHK7 ──────────────────────────────
     G13 checked that each of the 62 chips in the "Rep only…" panel dealt the count it
     printed. It was written because those two predicates drifted the day they were
     written: the panel counted "No source recorded" with `provOf` (which files the 46
     rails there, as every other view does) while the queue matched on `c.tier` raw, so
     the chip promised 46 cards and dealt nought. A reader cannot tell a filter that
     matches nothing from a pack that contains nothing.

     The panel is gone (see the note in the template where it stood) and G-CHK7 asks the
     same question of every scope the tool can now produce — 172 of them, including the
     Checklist's presets — and asks it of `buildDeck` rather than `deckSource`, which is
     one layer deeper and is where the round intersection that G13 could not see happens.
     Strictly more coverage, not less. Retiring a gate is only allowed with a sentence
     like this one naming what took it over.

     Appended to the shipped script rather than run against `ctx`, because `const`
     declarations in a classic script are script-scoped and never become properties
     of the vm's global — reaching them from outside would silently find `undefined`
     and pass. Same rule as the ckey fixture: check the artifact, in its own scope. */
  const GATE = `
    /* ── G15: the page's own idea of which ring each card is in ────────────────
       Counted here, in the artifact's own scope, and compared below against
       audit/spine.mjs. ringOf is written twice on purpose — the page imports
       nothing — so this comparison is the only thing keeping the two honest.
       No backticks anywhere in this string: it is inside one. */
    ;(function(){
      if(typeof ringOf!=='function'||!HASRINGS()){ globalThis.__RINGCOUNTS__=null; return; }
      /* Length comes from RINGS, not a literal. Hardcoded as [0,0,0,0] this probe
         reported the fifth ring as NaN the moment a written half was declared — which
         G15 caught, but only because the comparison is against spine.mjs rather than
         against a number this same array produced. A probe that sizes itself from a
         constant the feature does not own is a probe that stops measuring the feature. */
      const n=new Array(RINGS.length).fill(0);
      for(const c of PACK.cards){ if(c.damaged) continue; n[ringOf(c)]++; }
      globalThis.__RINGCOUNTS__=n;
    })();
    /* ── G23: the written half is its own round, and Round 1 opens on it ───────
       Two claims, one probe. (1) The written round holds every non-spine card on a
       declared written point and nothing else — declared, so a pack that infers it
       from type:'saq' fails here rather than quietly redefining what the screen
       promises. (2) yieldOpen hoists those points to the front of Round 1 without
       changing its membership: publication order put the two focus points carrying
       18.4% of the marks at cards 37 and 38, and the ONLY thing making the fix safe
       is that it is a reorder. Same set test as G18, for the same reason.
       No backticks: this whole thing is inside one. */
    ;(function(){
      if(typeof yieldOpen!=='function'||typeof primaryWritten!=='function'||!HASRINGS()||!HASWRITTEN()){ globalThis.__YIELD__=null; return; }
      const all=cardsOf(ALLTYPES,'all').filter(inPool).filter(answerable);
      const r1=all.filter(function(c){ return ringOf(c)===R_SPINE; });
      const got=yieldOpen(r1.slice()), set=new Set(got);
      const wRound=all.filter(function(c){ return ringOf(c)===R_WRITTEN; });
      const wantW=all.filter(function(c){ return onWritten(c)&&ringOf(c)!==R_SPINE; });
      globalThis.__YIELD__={
        same:got.length===r1.length&&r1.every(function(c){ return set.has(c); }),
        lead:got.length?primaryWritten(got[0]):false,
        nLead:got.filter(primaryWritten).length,
        headClean:got.slice(0,got.filter(primaryWritten).length).every(primaryWritten),
        wRound:wRound.length, wantW:wantW.length,
        strays:wRound.filter(function(c){ return !onWritten(c); }).length,
        escapeTo:ESCAPETO, escapeIsWritten:ESCAPETO===R_WRITTEN,
      };
    })();
    /* ── G25: a set ENDS — the direct regression test for the card-39 loop ─────
       A ringed pack used to deal for ever: nothing locks inside the hour, the deck
       filters on !isLocked, so it rebuilt to the same cards and re-dealt them while
       every answer said "did not count". Drive setSize()+1 cards through the real
       session counter and require the study view to reach the done screen. Reads the
       rendered text, not a flag, because a flag can be true while nothing renders.
       No backticks: this whole thing is inside one. */
    ;(function(){
      if(typeof setSize!=='function'||!HASRINGS()){ globalThis.__STOP__=null; return; }
      /* DO NOT SCRAPE THE STUB. document.querySelector('#view').innerHTML is '' for every
         element the stub hands back, so a probe that looks for markup in it passes or
         fails for reasons that have nothing to do with the page — the wrong-artifact trap
         that has already cost this repo two silent gates. The observable that actually
         means "the set stopped" is that renderStudy DEALT NO CARD: CUR is the card on
         screen, and if it changes after the goal is reached, the loop is back. */
      const keepS=JSON.stringify(S.sess), keepV=VIEW, keepL=JSON.stringify(S.lock);
      S.sess={d:'',n:0,goal:0,base:0}; sessStart();
      const size=sessState().goal-sessState().base;
      let dealt=0, before=null;
      for(let i=0;i<size;i++){ renderStudy(); if(CUR) dealt++; sessDone(); }
      before=CUR; renderStudy();
      /* comeBackHTML is a pure function of S.lock, so it is exercised directly, in all
         three states a reader can be in rather than only the one this run happens to hit. */
      const say=function(){ try{ return String(comeBackHTML()); }catch(e){ return ''; } };
      const none=say();
      const sp=PACK.spine||{}, k1=Object.values(sp)[0];
      S.lock={}; S.lock[k1]={n:1,t:Date.now()};       const fresh=say();
      S.lock={}; S.lock[k1]={n:1,t:Date.now()-2*LOCKGAP}; const ready=say();
      globalThis.__STOP__={
        size:size, dealt:dealt, stopped:CUR===before,
        none:/Nothing is half-way/.test(none),
        fresh:/Come back after/.test(fresh),
        ready:/hour is already up/.test(ready),
        /* [0-9] not \d: this probe is inside a TEMPLATE LITERAL, which eats a lone
           backslash, so the regex shipped as /d{1,2}:d{2}/ and matched nothing while the
           string it was testing said 5:36pm. Same family as the backticks. */
        clock:/[0-9]{1,2}:[0-9]{2}(am|pm)/.test(fresh),
      };
      S.sess=JSON.parse(keepS); VIEW=keepV; S.lock=JSON.parse(keepL); save();
    })();
    /* ── G24: the reader's SHARE sentence is computed, never typed ─────────────
       "about a fifth" is a claim about the paper. Typed as a literal it is the
       invented-pass-mark failure with extra steps — a number that looks official,
       sourced from nobody, and silently wrong the moment exam config changes. Drives
       paperWeights through a different exam and requires the words to move. */
    ;(function(){
      if(typeof shareWord!=='function'||typeof SAQSHARE!=='function'){ globalThis.__SHARE__=null; return; }
      const real=shareWord(SAQSHARE());
      const keep=PACK.exam; PACK.exam=Object.assign({},keep,{auto:1,saq:60,saqShare:0.5});
      const moved=shareWord(SAQSHARE()); PACK.exam=keep;
      globalThis.__SHARE__={real:real,moved:moved,differs:real!==moved};
    })();
    /* ── G18: the easy opening REORDERS Round 1 and never re-crews it ──────────
       coldOpen promotes three short machine-marked questions to the front for a
       reader who has answered nothing. Ordering is a judgement call; membership is
       the claim the rebuild spec reviewed card by card. Compare the set, not the
       list, and check the promotion actually happened — a filter that silently
       matches nothing would leave the five-mark essay as card one and pass every
       other gate in this file. No backticks: this whole thing is inside one. */
    ;(function(){
      if(typeof coldOpen!=='function'||!HASRINGS()){ globalThis.__COLD__=null; return; }
      const base=cardsOf(ALLTYPES,'all').filter(inPool).filter(answerable).filter(c=>ringOf(c)===0);
      const got=coldOpen(base.slice());
      const set=new Set(got);
      globalThis.__COLD__={
        n:got.length, base:base.length,
        same:got.length===base.length&&base.every(c=>set.has(c)),
        moved:base.length>2&&got[0]!==base[0],
        head:got.slice(0,3).map(c=>c.type+'/'+c.tier),
      };
    })();
    /* ── G19: all four Spine Bar states are reachable ─────────────────────────
       A state nobody can ever reach is a lie drawn in CSS. SEEN in particular is
       computed differently from the other three — off any card on the topic rather
       than off its lead card — so it is the one that can quietly stop happening.
       Drives S.lock and S.mcq synthetically and reads pointState back. */
    ;(function(){
      if(typeof pointState!=='function'||!HASRINGS()){ globalThis.__SEGSTATES__=null; return; }
      const cr=(PACK.criteria||[]).find(c=>(PACK.spine||{})[c.id]&&critCards(c.id).length>1);
      if(!cr){ globalThis.__SEGSTATES__=[]; return; }
      const lead=(PACK.spine||{})[cr.id];
      const other=critCards(cr.id).find(c=>c.key!==lead&&!isRecall(c));
      const keepL=S.lock, keepM=S.mcq, hit={};
      S.lock={}; S.mcq={}; hit[pointState(cr.id)]=1;
      if(other){ S.mcq[other.key]={a:1,c:1,g:1,t:1}; hit[pointState(cr.id)]=1; }
      S.lock[lead]={n:1,t:Date.now()}; hit[pointState(cr.id)]=1;
      S.lock[lead]={n:2,t:Date.now()}; hit[pointState(cr.id)]=1;
      S.lock=keepL; S.mcq=keepM;
      globalThis.__SEGSTATES__=Object.keys(hit);
    })();
    /* ── G20: the bar draws one segment per focus point, in NAMED blocks ───────
       The names are the half that broke. The bar blanked any block holding under a
       fifth of the focus points, so CARDIOVASCULAR and RESPIRATORY were labelled and
       LYMPHATIC — four points of thirty-eight — was an anonymous run of segments the
       reader could not identify. Nothing failed: the segments were all there, the
       blocks were all there, and the markup for the third one simply had no text in
       it. So count the names, not just the blocks.

       WHERE THE NAME LIVES CHANGED; THE CLAIM DID NOT. There is no measured labels row
       above the bar any more — a whole sticky row of chrome about chrome. The name is on
       the block's own title attribute and heads its section in the list the bar opens
       into, so this counts it in BOTH places. A reader who cannot identify a run of
       segments has exactly two things to try, and both have to work.
       No backticks anywhere: this whole thing is inside one. */
    ;(function(){
      if(typeof spineBarHTML!=='function'||!HASRINGS()){ globalThis.__SPINE__=null; return; }
      const h=spineBarHTML(), gs=spineGroups(), list=String(blueprintRowsHTML());
      const want=gs.filter(function(g){ return g.label; });
      globalThis.__SPINE__={segs:(h.match(/class="sseg /g)||[]).length,
                            groups:(h.match(/class="spinegrp"/g)||[]).length,
                            crits:(PACK.criteria||[]).length,
                            /* Through the page's own esc(), or "Lymphatic & immunity"
                               never matches its own escaped markup and the gate fails on
                               an ampersand. Compare the artifact the way it is written. */
                            named:want.filter(function(g){ return h.indexOf('data-sys="'+esc(g.label)+'"')>=0; }).length,
                            listed:want.filter(function(g){ return list.indexOf('>'+esc(g.label)+'<')>=0; }).length,
                            want:want.length,
                            rows:(list.match(/class="bprow /g)||[]).length};
    })();
    /* ── G21: the retired Brief has no way in ─────────────────────────────────
       A ringed pack retires the Brief tab, and for one shipped build four other
       things went on offering it anyway — most visibly the "Read the full
       explanation" button under every wrong answer, which dropped the reader onto a
       page that is not in the tab bar and has no way back. Hiding a tab is not
       retiring a surface; the surface is retired when nothing can reach it.

       Checks what RENDERS an offer (the wrong-answer link, and the two prose lines
       that used to name the tab by hand) and what ROUTES to it, and requires
       VIEWS.brief to still EXIST — otherwise this passes for the wrong reason the
       day somebody deletes renderBrief, and stops guarding the guard. The tab button
       is not checked here: the stub DOM answers hidden:false to everything, so
       that assertion would be theatre. No backticks: this whole thing is inside one. */
    ;(function(){
      if(!HASRINGS()){ globalThis.__BRIEF__=null; return; }
      const keep=VIEW;
      nav('brief');
      const landed=VIEW;
      nav(keep);
      /* BOTH BRANCHES, forced. bgRow renders the sentence that names the Brief only
         while the background cards are OUT, so read off the default state this check
         cannot fail no matter what those strings say, which is worse than not having it.
         The filter panel used to be swept the same way and is gone; the sheet that
         replaced it is swept instead, with the background row inside it. */
      const keepBG=S.bg, keepQ=QSHEET; QSHEET=true; let prose='';
      for(const bg of [false,true]){ S.bg=bg; prose+=' '+bgRow(ALLTYPES)+' '+queueLineHTML(ALLTYPES); }
      S.bg=keepBG; QSHEET=keepQ;
      globalThis.__BRIEF__={
        ok:BRIEFOK(),
        viewExists:typeof VIEWS.brief==='function',
        links:PACK.cards.map(function(c,i){return briefLink({...c,key:ckey(c),idx:i})}).filter(Boolean).length,
        landed:landed,
        proseLen:prose.length,
        namesIt:/brief/i.test(prose),
      };
    })();
    /* ── G26: the reader is ASKED, and can change their mind ───────────────────
       The rounds are a good order and for one release they were the ONLY order: the
       tool opened by explaining what was about to happen, and the only ways off it
       were a filter that narrows the round you are already in and a blueprint row
       three taps deep in Progress. A default nobody was offered an alternative to is
       not a default, it is a rail.

       Six claims, all of them things that would go quiet rather than loud if they
       broke:
         1. with no route chosen the chooser renders BOTH options, and the first-run
            panel stays silent underneath it (two first-run surfaces at once is how
            the reader gets explained a route they have not agreed to);
         2. under EITHER route the sheet still carries BOTH doors and exactly one is
            lit — the anti-lock claim, and the one a well-meant tidy-up breaks first;
         3. the two routes deal DIFFERENT decks. A second door that changes nothing
            is worse than no second door;
         4. nothing names a round while the rounds are paused;
         5. coming back to Guided from a one-topic drill undoes the drill, or the
            reader lands in "Round 1" secretly narrowed to one focus point;
         6. the CLOSED queue line names the route that is running, and offers the
            control that changes it. This claim is new and it is what buys the right to
            fold the doors into a sheet at all: a choice is only reversible-without-a-
            menu-path if the state is visible and its edit button is beside it. Checked
            with the sheet SHUT, which is how the reader meets it.
       No backticks anywhere: this whole thing is inside one. */
    ;(function(){
      if(typeof queueLineHTML!=='function'||typeof routePickHTML!=='function'||!HASRINGS()){ globalThis.__ROUTE__=null; return; }
      const keepR=S.route, keepF=JSON.stringify(S.filters), keepRing=S.ring, keepOb=S.onboarded, keepQ=QSHEET, out={};
      S.route=undefined; S.onboarded=false;
      const ask=routePickHTML();
      out.asks=ROUTEASK();
      out.askLen=ask.length;
      out.hasBoth=/id="rpGuided"/.test(ask)&&/id="rpOwn"/.test(ask);
      /* The modal is a full-screen overlay with no close button, so its two options MUST
         go through the delegated handler. Wired per render, a lost binding locks the
         reader out of the whole tool rather than out of one control. */
      out.askDelegated=/data-route="guided"/.test(ask)&&/data-route="own"/.test(ask);
      let vals0=(ask.match(/data-route="[a-z]+"/g)||[]);
      /* The RETURN VALUE, not the stub's innerHTML — which reads back as '' for every
         element and would pass this check no matter what the panel did. */
      out.panelQuiet=renderOnboard()==='';
      let vals=vals0.slice();
      out.doors={}; out.shut={};
      for(const r of ['guided','own']){
        setRoute(r);
        /* SHUT FIRST. This is the state the reader is actually in, and the whole claim
           of the redesign is that it still says which route is running. */
        QSHEET=false;
        const closed=queueLineHTML(ALLTYPES);
        out.shut[r]={names:/Guided|You are choosing/.test(closed),
                     change:/data-qx="change"/.test(closed),
                     leaks:/data-route=/.test(closed)};
        QSHEET=true;
        const ui=queueLineHTML(ALLTYPES);
        vals=vals.concat((ui.match(/data-route="[a-z]+"/g)||[]));
        out.doors[r]={g:/data-route="guided"/.test(ui),o:/data-route="own"/.test(ui),
                      why:/data-qx="gloss"/.test(ui),lit:(ui.match(/class="rowbtn on"/g)||[]).length};
      }
      QSHEET=keepQ;
      setRoute('guided'); S.ring=0;
      out.gRing=ringNow(); out.gDeck=buildDeck(ALLTYPES).length; out.gSub=String(spineSubHTML(spineTally()));
      setRoute('own');
      out.oRing=ringNow(); out.oDeck=buildDeck(ALLTYPES).length; out.oSub=String(spineSubHTML(spineTally()));
      out.oHead=String(ringHeadHTML()).trim();
      /* The one-point drill: it announces itself, it says how many, and it carries the
         way back on the same row — which is the queue line now, not a bar of its own.
         Read from the CLOSED line, because a way out that needs a sheet opened first is
         a menu path, and this is the control house policy is strictest about. */
      repScope('crits:'+(PACK.criteria||[])[0].id);
      QSHEET=false;
      const drilled=queueLineHTML(ALLTYPES);
      out.drill={names:drilled.indexOf(String((PACK.criteria||[])[0].name||''))>=0,
                 /* DOUBLE backslash: this whole probe is inside a template literal, so a
                    lone \\d is just "d" and the regex silently matches nothing. Exactly
                    the bug that shipped /d{1,2}:d{2}/ for the come-back clock. */
                 counts:/all \\d+ cards?/.test(drilled),
                 out:/data-route="guided"/.test(drilled)};
      vals=vals.concat((drilled.match(/data-route="[a-z]+"/g)||[]));
      setRoute('guided');
      out.undrilled=S.filters.crits.length===0&&typeof S.ring==='number';
      out.values=vals.map(function(v){ return v.slice(12,-1); });
      S.route=keepR; S.filters=JSON.parse(keepF); S.ring=keepRing; S.onboarded=keepOb; save();
      globalThis.__ROUTE__=out;
    })();
    /* ── G22: the provenance label states a SOURCE, not a prediction ──────────
       The verbatim tier means the question came out of one of her own past papers.
       It shipped reading "One of Hannetjie's own exam questions", which a reader
       hears as a claim about what is coming — the one claim this pack cannot make.
       Everywhere else the same tier is already worded as a source ("From a past
       quiz"). Assert the label, not a vague ban on the word. */
    ;(function(){
      globalThis.__LEADS__=(typeof REASONLEAD==='object'&&REASONLEAD)?{...REASONLEAD}:null;
    })();
    /* ── G-CHK4 (runtime half): the page DRAWS the list, expanded, under every preset ──
       The half of G-CHK4 that lives above this checks the DATA — 36 rows, case studies
       outside them. That is not the same claim as "the page renders them": a view that
       produces 36 collapsed rows and throws on the first tap ships perfectly happily
       past a data check, and the expanded body is where all the work is (the ⚡ Rep
       button, the term chips, the stem index, the preset arithmetic).
       So every row is opened, under every preset, and asked for its markup. */
    ;(function(){
      if(typeof chkRows!=='function'||!HASCHK()){ globalThis.__CHK__=null; return; }
      const keep=S.chk, out={presets:[],terms:0,termRows:0,chars:0};
      for(const p of CHKPRESETS){
        S.chk=p.id;
        const rs=chkRows();
        let chars=0;
        rs.forEach(function(r){ CHKOPEN[r.crit]=true; });
        rs.forEach(function(r){ chars+=String(chkRowHTML(r)).length; });
        rs.forEach(function(r){ CHKOPEN[r.crit]=false; });
        out.presets.push({id:p.id,rows:rs.length,ids:rs.map(function(r){ return r.crit; }),
                          n:rs.reduce(function(a,r){ return a+r.n; },0),chars:chars});
        out.chars+=chars;
      }
      S.chk='all';
      chkRows().forEach(function(r){ if(r.terms){ out.termRows++; out.terms+=r.terms.length; } });
      out.extra=String(chkExtraHTML());
      S.chk=keep; save();
      globalThis.__CHK__=out;
    })();
    /* ── G-CHK7: a ⚡ Rep button hands over exactly what it promised ────────────
       THIS IS THE GATE THAT CATCHES THE RING-INTERSECTION BUG, and today's shipped
       version fails it. All cards' "Rep these in Study" set S.filters and nothing
       else; GUIDED() is the default, so buildRingDeck then intersected that filter
       with the CURRENT ROUND — and Round 1 is one card per focus point. A button
       reading "Rep all 16 cards" dealt at most one, and zero once that point's lead
       card was locked, dropping the reader on the filter dead-end.

       Two things make it checkable. Every Rep button now states its promise in
       data-repn, from the same expression the queue builds from; and the press is
       simulated from the COLD DEFAULT — Guided, Round 1 — because that is the state
       a reader who has never taken the second door is actually in, and the only
       state in which the old handler was wrong.

       Measured on buildDeck, never deckSource. deckSource is the SCOPE and was
       right the whole time; the loss happened one layer further in. A gate written
       against deckSource here would have passed against the broken build, which is
       the failure mode [[hs2-provenance-audit]] records: a check whose fixture is
       the wrong artifact is not a check. */
    ;(function(){
      if(typeof repBtnHTML!=='function'||typeof repScope!=='function'){ globalThis.__REP__=null; return; }
      const keepF=JSON.stringify(S.filters), keepR=S.route, keepRing=S.ring;
      const scopes=[];
      /* Every scope any surface can produce, INCLUDING the Checklist's presets — those
         are the two-dimension ones, and a preset that re-counts a row without changing
         what the button deals is the same broken promise wearing a new hat. */
      const PRESETS=(typeof CHKPRESETS==='object'&&CHKPRESETS)?CHKPRESETS.map(function(p){ return p.scope||''; }):[''];
      (PACK.criteria||[]).forEach(function(cr){
        PRESETS.forEach(function(sfx){ scopes.push('crits:'+cr.id+sfx); });
      });
      (PACK.topics||[]).forEach(function(t){ scopes.push('topics:'+t.id); });
      ALLTYPES.forEach(function(t){ scopes.push('types:'+t); });
      scopes.push('status:flagged');
      const bad=[];
      for(const s of scopes){
        /* Reset to cold BEFORE each press. Without this the second scope is pressed
           from inside the first one's drill, which is a state no reader is ever in
           and which happens to make the intersection bug invisible. */
        S.filters=FILT0(); S.route='guided'; S.ring=0;
        const m=String(repBtnHTML(s)).match(/data-repn="(\\d+)"/);
        if(!m){ bad.push(s+' — the button states no count at all'); continue; }
        const promised=+m[1];
        repScope(s);
        const dealt=buildDeck(ALLTYPES).length;
        if(dealt!==promised) bad.push(s+' — the button says '+promised+', the queue deals '+dealt);
      }
      S.filters=JSON.parse(keepF); S.route=keepR; S.ring=keepRing; save();
      globalThis.__REP__={bad:bad,n:scopes.length};
    })();
  `;
  try {
    vm.runInContext(script + GATE + '\n;globalThis.__REACHED_END__=true;', ctx, { filename: 'index.html', timeout: 15000 });
  } catch (e) {
    console.error(`✗ the shipped page THROWS at run time: ${e.message}`);
    console.error('  The file parses; the program does not run. Nothing below this would have caught it.');
    process.exit(1);
  }
  if (!ctx.__REACHED_END__) { console.error('✗ the shipped page did not finish executing'); process.exit(1); }
  console.log('shipped page executes end-to-end against a stub DOM ✓');

  /* THE FILTER PANEL IS GONE, AND SO IS ANY OTHER WAY TO NARROW THE QUEUE BEHIND THE
     READER'S BACK. Every narrowing now goes through `repScope`, which also sets
     `ring:'point'` — so the pool announces itself and carries its own way out. This
     asserts the deletion held: a `filtDims`/`filterUI` that grew back would be a second
     road into `S.filters` with none of that, which is the shape of every bug this
     rebuild removed. Structural, cheap, and it fails the moment somebody restores it
     without also restoring a gate over it. */
  for (const gone of ['function filtDims(', 'function filterUI(', 'FPANEL'])
    if (script.includes(gone)) { console.error(`✗ NOT SHIPPING. "${gone}" is back — a second way to narrow the queue with no announcement and no exit.`); process.exit(1); }
  /* ── G-CHK8: nothing tells the reader to press a button that is not there ──────
     Deleting a surface is not finished when the code goes; it is finished when nothing
     names it. The retired Brief taught this the expensive way — the tab was hidden by
     one test and four other things went on offering the view, so clicking "Read the full
     explanation" dropped the reader on a dead page, which is how they learn to distrust
     the rest of the buttons (G21 is that gate). "🔎 Rep only…" was named by the first-run
     panel and by the unringed door help on the day the panel was deleted.

     Reader-facing strings only: the deletion notes in the source say the name on purpose,
     and a comment is not a button. Same comment-stripping as G-CHK6, same reason. */
  {
    const CODE = script.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '');
    const named = ['Rep only'].filter(s => CODE.includes(s));
    if (named.length) {
      console.error(`✗ NOT SHIPPING. A reader-facing string still names a deleted surface: ${named.join(', ')}`);
      console.error('   A control the copy promises and the screen does not have reads as a broken tool.');
      process.exit(1);
    }
  }
  console.log('the five-dimension filter panel is gone, and nothing still tells the reader to press it ✓');
  ENGINE_RINGS = ctx.__RINGCOUNTS__ ?? null;
  ENGINE_YIELD = ctx.__YIELD__ ?? null;
  ENGINE_SHARE = ctx.__SHARE__ ?? null;
  ENGINE_STOP  = ctx.__STOP__ ?? null;

  /* ── G14: All cards' "as tested" view is the study card, not a copy of it ─────
     The whole claim of that view is that a card looks there exactly as it looks when
     you are being tested on it, and the only thing making that true is that both go
     through `cardHeadHTML` and `faceHTML`. A well-meant future fix that inlines the
     markup instead — to tweak a size, to drop a button — breaks the claim silently,
     because both pages still look plausible. Cheap structural check, in the artifact. */
  const face = script.match(/function libTestCardHTML\(c\)\{[\s\S]*?\n\}/);
  if (!face) { console.error('✗ libTestCardHTML not found — the as-tested view has been renamed or removed'); process.exit(1); }
  const missing = ['cardHeadHTML(', 'faceHTML('].filter(fn => !face[0].includes(fn));
  if (missing.length) {
    console.error(`✗ NOT SHIPPING. libTestCardHTML no longer calls ${missing.join(' or ')} — "as tested" would be a lookalike, not the card.`);
    process.exit(1);
  }
  if ((script.match(/function faceHTML\(/g) || []).length !== 1) {
    console.error('✗ NOT SHIPPING. More than one faceHTML — the study card and the browse view can now drift.');
    process.exit(1);
  }
  console.log('“as tested” renders through the study card’s own head/face functions ✓');

  /* ── G17: every kind of lead card can actually reach LOCKED ───────────────────
     This gate exists because the tool shipped for a week with two of its 38 lead
     cards unlockable. Three of the four study runners called lockMark; studyWritten
     did not, and two focus points have a WRITTEN lead card — so Round 1 could never
     be completed and Round 2 could never open through the door built to open it.

     Nothing else here would have caught it: the pack was correct, the spine resolved,
     the rings counted, the page ran. The bug lived in one of four near-identical
     functions, in the branch nobody re-reads. Structural, in the artifact's own
     source: a runner either calls lockMark itself or delegates to wireRate, which
     does. Add a fifth runner and this fails until it is wired. */
  /* ── G-CHK6: ONE ⚡ Rep journey, with one writer ──────────────────────────────
     The bug G-CHK7 catches was not a typo, it was a second implementation. Two
     buttons doing "the same journey" wrote the same shared state and one of them
     wrote a subset of it — silently, because the deck the subset produced was still
     a valid deck. So the structural rule is that there is nothing to disagree with:
     one delegated handler, one writer of the drill state, and every button that
     offers the journey states the number it is promising.

     Cheap, in the artifact, and it fails the moment somebody helpfully adds a second
     path — which is how this got here in the first place. */
  {
    /* COUNT CODE, NOT PROSE. The first version of this gate counted raw occurrences
       and failed on its own documentation — the comment standing where wireBlueprint
       used to be names the assignment it forbids, which is the single most useful
       sentence at that spot. This file's comments are line-initial block comments, so
       stripping those is enough and never reaches the pack's single-line strings.
       That comment is deliberately left in place: it is the fixture proving the strip
       still works, and it is why each hit below is reported with its own line. */
    const CODE = script.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '').replace(/^[ \t]*\/\/.*$/gm, '');
    const fail = [];
    const rep = CODE.match(/\nfunction repScope\([^)]*\)\{[\s\S]*?\n\}/);
    if (!rep) fail.push('repScope is gone or renamed — the drill state has no single writer');
    else for (const w of ['S.filters=', 'S.ring=', 'S.route='])
      if (!rep[0].includes(w)) fail.push(`repScope no longer sets ${w} — a partial write is exactly the shipped bug`);
    if ((CODE.match(/function repScope\(/g) || []).length !== 1) fail.push('more than one repScope');
    const handlers = (CODE.match(/closest\('\[data-rep\]'\)/g) || []).length;
    if (handlers !== 1) fail.push(`${handlers} [data-rep] click handlers — there must be exactly 1`);
    /* AND THE HANDLER MUST DELEGATE TO IT. Without this line the gate has a hole wide
       enough to drive the original bug back through: a handler that assembles the state
       inline leaves `repScope` present, correct and unused, and G-CHK7 — which presses
       the button by calling repScope — would go on passing while the real click did
       something else. Check the path the reader takes, not the helper beside it. */
    {
      const h = CODE.match(/closest\('\[data-rep\]'\)[\s\S]*?\n\}\);/);
      if (!h) fail.push('the [data-rep] handler could not be read');
      else if (!/repScope\(/.test(h[0])) fail.push('the [data-rep] handler does not call repScope — it is assembling the drill state itself');
    }
    /* Any OTHER writer of the drill state is a second journey by definition. repScope
       is allowed one; setRoute is allowed to read it to undo the drill, which is a
       comparison, not an assignment. */
    const drill = [...CODE.matchAll(/S\.ring\s*=\s*'point'/g)];
    if (drill.length !== 1) {
      fail.push(`S.ring='point' is written in ${drill.length} place(s) in code — only repScope may:`);
      for (const d of drill) fail.push('      ' + CODE.slice(CODE.lastIndexOf('\n', d.index) + 1, CODE.indexOf('\n', d.index)).trim());
    }
    /* Every offer of the journey states what it will deal, or G-CHK7 has nothing to
       compare against and the promise goes back to being unfalsifiable prose. */
    for (const m of CODE.matchAll(/data-rep="/g))
      if (!CODE.slice(m.index, m.index + 200).includes('data-repn="'))
        fail.push('a data-rep button states no data-repn count — G-CHK7 cannot check it');
    if (fail.length) {
      console.error('✗ NOT SHIPPING. The ⚡ Rep journey has more than one implementation:');
      for (const f of fail) console.error('    ' + f);
      process.exit(1);
    }
    console.log('one ⚡ Rep handler, one writer of the drill state, every button stating its count ✓');
  }
  {
    const R = ctx.__REP__;
    if (!R) { console.error('✗ G-CHK7 did not run — repScope/repBtnHTML have been renamed'); process.exit(1); }
    if (R.bad.length) {
      console.error(`✗ ${R.bad.length} of ${R.n} ⚡ Rep button(s) do not deal what they promise:`);
      for (const b of R.bad.slice(0, 12)) console.error('    ' + b);
      console.error('\n✗ NOT SHIPPING. "Rep all 16 cards" that deals one is the bug this page was rebuilt around.');
      process.exit(1);
    }
    console.log(`all ${R.n} ⚡ Rep buttons deal exactly the count they promise, pressed from a cold Guided start ✓`);
  }

  /* ── G-CHK1 / G-CHK4: the checklist that SHIPS is the course's document ───────
     Not a check on the extractor — a check on the artifact. It reads the strings back
     out of the generated page and requires every one of them to appear, whitespace
     normalised, in a corpus unit filed under SRC-ASSESSMENT-CRITERIA. A transform
     added anywhere between the two (a tidy-up of the double comma in the respiratory
     terms, a "helpful" closing bracket on Respiratory 5, an ellipsis on the 330-char
     criterion 12) fails here rather than in front of a reader holding Canvas open.

     The same reasoning as the ckey fixture: a self-check whose fixture is the wrong
     artifact is not a check. The fixture here is the page, not the JSON in between. */
  {
    const m = out.match(/PACK\.checklist=(\{[\s\S]*?\});\n/);
    if (!m) { console.error('✗ NOT SHIPPING. PACK.checklist is not in the built page.'); process.exit(1); }
    let shipped; try { shipped = JSON.parse(m[1]); }
    catch (e) { console.error('✗ NOT SHIPPING. PACK.checklist does not parse: ' + e.message); process.exit(1); }
    const corpus = JSON.parse(readFileSync('audit/corpus.json', 'utf8'))
      .filter((u) => u.src === 'SRC-ASSESSMENT-CRITERIA').map((u) => WS(u.t));
    const inDoc = (s) => corpus.some((t) => t.includes(WS(s)));
    const fail = [], seen = new Set();
    let nRows = 0, nStr = 0, nTermsShipped = 0;
    for (const s of shipped.systems) {
      if (!inDoc(s.name)) fail.push(`the system heading "${s.name}" is not in the course document`);
      for (const r of s.rows) {
        nRows++; nTermsShipped += (r.terms ?? []).length;
        if (seen.has(r.crit)) fail.push(`${r.crit} is rendered twice`);
        seen.add(r.crit);
        if (!r.text) { fail.push(`${r.crit} has no verbatim text`); continue; }
        for (const str of [r.text, ...r.subs.map((x) => x.text), ...(r.terms ?? []).map((x) => x.t)]) {
          nStr++;
          if (!inDoc(str)) fail.push(`${r.crit}: "${String(str).slice(0, 60)}…" is not in the course document`);
        }
      }
    }
    /* A case study rendered inside the numbered list stops the page being the course's
       own document — the thing every other rule here is protecting. */
    for (const id of shipped.extra) if (seen.has(id)) fail.push(`${id} is not on the published checklist and is rendered inside the numbered rows`);
    if (nRows !== 36) fail.push(`the checklist renders ${nRows} numbered rows, not 36`);
    if (fail.length) {
      console.error('✗ NOT SHIPPING. The shipped checklist is not the course document:');
      for (const f of fail.slice(0, 12)) console.error('    ' + f);
      process.exit(1);
    }
    /* And the same claim about the RENDER, not just the data. */
    const R = ctx.__CHK__;
    if (!R) { console.error('✗ the checklist render gate did not run — chkRows/HASCHK renamed?'); process.exit(1); }
    const rfail = [];
    const byId = Object.fromEntries(R.presets.map((p) => [p.id, p]));
    if (!byId.all || byId.all.rows !== 36) rfail.push(`the "Everything" preset draws ${byId.all?.rows} rows, not 36`);
    for (const p of R.presets) {
      if (!p.chars) rfail.push(`the "${p.id}" preset draws no markup at all`);
      if (p.ids.some((id) => shipped.extra.includes(id))) rfail.push(`a case study is drawn inside the "${p.id}" numbered rows`);
    }
    const blindWant = P.criteria.filter((c) => c.blind && !shipped.extra.includes(c.id)).map((c) => c.id);
    if (byId.blind && byId.blind.ids.join() !== blindWant.join())
      rfail.push(`"Never practised" draws ${byId.blind.ids.join(',') || 'nothing'} — the pack declares ${blindWant.join(',')}`);
    /* Three of the 36 are term lists rather than statements, and their chips are the
       only route to a glossary entry outside Search. A row that quietly stopped
       rendering its terms would look completely normal. */
    if (R.termRows !== 3) rfail.push(`${R.termRows} terminology rows render their terms, not 3`);
    if (R.terms !== nTermsShipped) rfail.push(`${R.terms} term chips render against ${nTermsShipped} published terms`);
    for (const id of shipped.extra) if (!R.extra.includes(id)) rfail.push(`${id} is missing from the block below the 36`);
    if (rfail.length) {
      console.error('✗ NOT SHIPPING. The checklist page does not draw what it holds:');
      for (const f of rfail) console.error('    ' + f);
      process.exit(1);
    }
    console.log(`all ${nStr} checklist strings in the shipped page are present verbatim in the course document · every row draws expanded under all ${R.presets.length} presets ✓`);
  }

  const RUNNERS = ['studyRail', 'studyFlash', 'studyWritten', 'studyAuto'];
  const unlockable = [];
  for (const fn of RUNNERS) {
    const m = script.match(new RegExp('\\nfunction ' + fn + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'));
    if (!m) { console.error(`✗ ${fn} not found — the study runners have been renamed`); process.exit(1); }
    if (!/lockMark\(|wireRate\(/.test(m[0])) unlockable.push(fn);
  }
  if (unlockable.length) {
    console.error(`✗ NOT SHIPPING. ${unlockable.join(', ')} never calls lockMark — a lead card dealt by it can never lock, so its round can never be completed.`);
    process.exit(1);
  }
  console.log(`all ${RUNNERS.length} study runners record the lock ✓`);

  const cold = ctx.__COLD__;
  if (cold) {
    if (!cold.same) {
      console.error(`✗ NOT SHIPPING. The easy opening changed Round 1's MEMBERSHIP: ${cold.base} cards in, ${cold.n} out. It may reorder the round and nothing else.`);
      process.exit(1);
    }
    if (!cold.moved) {
      console.error('✗ the easy opening matched nothing — a cold reader still opens on whatever the course lists first. Check the verbatim/mcq/stem-length filter in coldOpen.');
      process.exit(1);
    }
    const wrong = cold.head.filter(h => h !== 'mcq/verbatim');
    if (wrong.length) {
      console.error(`✗ the first cards of a cold Round 1 are ${cold.head.join(', ')} — they are meant to be short machine-marked questions from a past paper.`);
      process.exit(1);
    }
    console.log(`a cold reader opens on ${cold.head.length} short past-paper questions, and Round 1 still holds all ${cold.n} ✓`);
  }

  /* ── G21: the reader never meets the word "ring" ──────────────────────────────
     The identifiers stay `ring` on purpose — renaming sixty of them buys nothing
     anybody can see — which is exactly why this is easy to get wrong: the word is
     everywhere in the source, so a new string reading "38 left in this ring" looks
     native. It happened twice in one afternoon.

     THE FIRST VERSION OF THIS GATE WAS WORSE THAN NONE. It rendered nine named
     surfaces and grepped their output, passed, and the words "38 in this ring" were on
     the screen the whole time — the filter bar simply was not on the list. An
     enumerated checklist of surfaces is a checklist of the surfaces you remembered.

     So: scan the ENGINE, whole, with comments stripped. Not the built page — the pack
     says "cartilage rings" seven times and is right to. The pattern is the word with a
     prose delimiter in front and no identifier character behind, which every
     `ringOf(`, `S.ring=`, `.ringbar` and `(types,ring)` fails and every sentence hits.
     Zero false positives on the engine as it stands. */
  {
    const eng = tpl
      .replace(/\/\*[\s\S]*?\*\//g, '')        // JS block comments
      .replace(/<!--[\s\S]*?-->/g, '')         // HTML comments
      .replace(/(^|\s)\/\/.*$/gm, '$1');       // line comments, but not the // in https://
    const leaks = [...eng.matchAll(/[\s>"'][Rr]ings?(?![A-Za-z0-9_(])/g)]
      .map(m => eng.slice(Math.max(0, m.index - 70), m.index + 45).replace(/\s+/g, ' '));
    if (leaks.length) {
      console.error(`✗ NOT SHIPPING. The word "ring" is in ${leaks.length} reader-facing engine string(s):`);
      for (const l of leaks.slice(0, 8)) console.error('    …' + l);
      console.error('  Nobody knows what a ring is. Say Round, and never without its plain-English subtitle.');
      process.exit(1);
    }
    console.log('no reader-facing engine string says "ring" ✓');
  }

  {
    const b = ctx.__BRIEF__;
    if (!b) { console.error('✗ the retired-Brief gate did not run — this pack has no rings, or nav/HASRINGS has been renamed'); process.exit(1); }
    if (!b.viewExists) { console.error('✗ VIEWS.brief is gone, so this gate proves nothing. Delete the gate with the view, or put the view back.'); process.exit(1); }
    const fail = [];
    if (b.ok) fail.push('BRIEFOK() is true on a ringed pack');
    if (b.links) fail.push(`${b.links} card(s) still render "→ Read the full explanation"`);
    if (b.landed !== 'study') fail.push(`nav('brief') landed on "${b.landed}", not study`);
    if (!b.proseLen) fail.push('bgRow/filterUI rendered nothing, so the wording check read an empty string');
    if (b.namesIt) fail.push('a line above the queue still tells the reader about the Brief');
    if (fail.length) {
      console.error('✗ NOT SHIPPING. The Brief is retired on this pack but still reachable:');
      for (const f of fail) console.error('    ' + f);
      console.error('  A button that lands on a retired page teaches the reader to distrust the others.');
      process.exit(1);
    }
    console.log('the retired Brief has no way in — no link, no route, no mention ✓');
  }
  {
    const L = ctx.__LEADS__;
    if (!L) { console.error('✗ REASONLEAD is gone — the provenance label gate cannot run'); process.exit(1); }
    if (!/past quiz/.test(L.verbatim) || /\bexam\b/i.test(L.verbatim)) {
      console.error(`✗ NOT SHIPPING. The verbatim label reads "${L.verbatim}".`);
      console.error('  That tier records where the card CAME FROM — one of her past papers. Calling it');
      console.error('  an exam question makes a promise about the paper this pack cannot keep.');
      process.exit(1);
    }
    console.log('the past-quiz label states a source, not a prediction ✓');
  }

  {
    const R = ctx.__ROUTE__;
    if (!R) { console.error('✗ the route gate did not run — this pack has no rings, or routeUI/routePickHTML has been renamed'); process.exit(1); }
    const fail = [];
    if (!R.asks) fail.push('ROUTEASK() is false with nothing chosen — a cold reader is never asked which route to take');
    if (!R.hasBoth || R.askLen < 300) fail.push(`the chooser does not offer both routes (${R.askLen} chars, both=${R.hasBoth})`);
    if (!R.askDelegated) fail.push('the chooser\'s options are not delegated — a lost binding on a full-screen modal with no close button locks the reader out of the whole tool');
    if (R.panelQuiet !== true) fail.push('the first-run panel renders UNDERNEATH the chooser — two explanations at once, one about a route not yet chosen');
    for (const r of ['guided', 'own']) {
      const d = R.doors[r], q = R.shut[r];
      if (!d.g) fail.push(`under "${r}" the [ Change ] sheet has no way back to Guided — that is a lock`);
      if (!d.o) fail.push(`under "${r}" the [ Change ] sheet has no "Let me choose" — the reader is on a rail again`);
      if (!d.why) fail.push(`under "${r}" nothing explains what the words mean`);
      if (d.lit !== 1) fail.push(`under "${r}" ${d.lit} door(s) are lit, not exactly one — the reader cannot tell which route is running`);
      /* THE SHUT STATE IS THE STATE THE READER IS IN. Folding two permanently-visible
         doors into a sheet is only allowed while the closed line still NAMES the route
         and puts its edit button beside it — otherwise the choice has been demoted to a
         menu path, which [[two-doors-pattern]] rule 2 forbids. */
      if (!q.names) fail.push(`with the sheet shut, the queue line under "${r}" does not say which route is running`);
      if (!q.change) fail.push(`with the sheet shut, there is no [ Change ] control under "${r}" — the route is stated and not reversible`);
    }
    if (R.gRing !== 0) fail.push(`Guided is not dealing Round 1 (ringNow=${R.gRing})`);
    if (R.oRing !== null) fail.push('"I\'ll choose" is still inside the rounds — it reorders one round instead of leaving them');
    if (!R.oDeck) fail.push('"I\'ll choose" deals an empty queue');
    if (R.oDeck <= R.gDeck) fail.push(`"I'll choose" deals ${R.oDeck} and Guided deals ${R.gDeck} — the second door changes nothing`);
    if (!/Round [0-9]/.test(R.gSub)) fail.push('the bar does not name the round under Guided');
    if (/Round [0-9]/.test(R.oSub)) fail.push(`the bar still names a round while the rounds are paused: "${R.oSub}"`);
    if (R.oHead) fail.push('a second "back to the rounds" bar renders under "I\'ll choose" — the same control twice, and two of them drift');
    /* The drill is the one state where the reader is being dealt something other than
       what the round line promises, so all three of these have to be true on the CLOSED
       line: what it narrowed to, how many that is, and the way back. */
    if (!R.drill.names) fail.push('a one-point drill does not name the point it narrowed to');
    if (!R.drill.counts) fail.push('a one-point drill does not say how many cards it is dealing');
    if (!R.drill.out) fail.push('a one-point drill offers no way back to the rounds without opening a sheet first — that is a menu path, not an exit');
    if (!R.undrilled) fail.push('returning to Guided from a one-topic drill leaves the filter on, so "Round 1" is secretly one focus point');
    /* `why` is gone with ROUTEHELP — the sheet IS the explanation, and its glossary link
       is `data-qx`. A `data-route` the handler does not understand now silently calls
       setRoute with it, which falls through to 'guided': a door that quietly means the
       other one. */
    const bad = [...new Set(R.values)].filter(v => !['guided', 'own'].includes(v));
    if (bad.length) fail.push(`data-route value(s) the handler does not understand: ${bad.join(', ')}`);
    /* The route buttons are the only way out of a narrowed self-directed queue and the
       only way back into the rounds. Every other binding in the engine attaches on a
       setTimeout the file's own comments call racy — measured, not assumed: clicking
       the old id-wired "Back to the rounds" in the same tick as its render did nothing
       at all. A lost binding on THIS control is a lock, which house policy forbids. */
    if (!script.includes("closest('[data-route]')")) fail.push('the route buttons are no longer delegated — a lost binding on them is a lock');
    if (fail.length) {
      console.error('✗ NOT SHIPPING. The reader is back on a rail:');
      for (const f of fail) console.error('    ' + f);
      process.exit(1);
    }
    console.log(`the route is asked once and both doors stay on screen under either — Guided deals ${R.gDeck}, "I'll choose" ${R.oDeck} ✓`);
  }

  const seg = ctx.__SEGSTATES__;
  if (seg) {
    const want = ['new', 'seen', 'half', 'locked'];
    const missing = want.filter(s => !seg.includes(s));
    if (missing.length) {
      console.error(`✗ NOT SHIPPING. Spine Bar state(s) no reader can ever reach: ${missing.join(', ')}. A state drawn in CSS and never returned is a lie.`);
      process.exit(1);
    }
  }
  const sp = ctx.__SPINE__;
  if (sp) {
    /* Counted inside the vm — `pack` up here is the source TEXT, and the loaded pack
       object does not exist until well below this block. */
    if (sp.segs !== sp.crits) {
      console.error(`✗ NOT SHIPPING. The Spine Bar draws ${sp.segs} segments for ${sp.crits} focus points.`);
      process.exit(1);
    }
    if (sp.named !== sp.want) {
      console.error(`✗ NOT SHIPPING. ${sp.want - sp.named} of ${sp.want} block(s) in the Spine Bar carry no name.`);
      console.error('   A run of segments the reader cannot identify, sitting next to named ones, reads as a bug.');
      process.exit(1);
    }
    /* And the same names head their sections in the list the bar opens into, which is
       where a reader who cannot read a tooltip on a phone actually goes. The labels row
       is gone; both of its replacements have to work, or the name has simply been
       deleted with the row. */
    if (sp.listed !== sp.want) {
      console.error(`✗ NOT SHIPPING. ${sp.want - sp.listed} of ${sp.want} body system(s) head no section in the list the bar opens into.`);
      console.error('   On a phone the block tooltip is unreachable, so this list is the only place the name survives.');
      process.exit(1);
    }
    if (sp.rows !== sp.crits) {
      console.error(`✗ NOT SHIPPING. The list the bar opens into draws ${sp.rows} rows for ${sp.crits} focus points — grouping has dropped or duplicated one.`);
      process.exit(1);
    }
    console.log(`the Spine Bar draws all ${sp.segs} focus points in ${sp.groups} block(s), all ${sp.named} named in the bar and in the list ✓`);
  }
}

/* ── G-CSS1: the scales are enforced, or they are temporary ────────────────────────
   The stylesheet was not badly written, it was UNSCALED — 22 font sizes, 7 weights, 15
   radii, tuned component by component in isolation. Six steps, three weights and three
   radii fix that once; this is what stops it drifting back, because three tools from now
   nobody remembers the scale and every fix will be one half-pixel nudge that looks right
   on its own.

   OVER THE WHOLE PAGE, not just the <style> block. Half the drift arrived as
   `style="font-size:13.5px"` inside a template literal, where a stylesheet-only check
   cannot see it — and an inline value is the one most likely to be a nudge nobody
   revisits. Raw colours are checked the same way and only outside :root, because that is
   where the palette lives and the palette is the estate's ([[house-design-system]]);
   a hex anywhere else is a component inventing its own. */
{
  const style = out.match(/<style>([\s\S]*?)<\/style>/);
  if (!style) { console.error('✗ NOT SHIPPING. No <style> block — the scale gate has nothing to check.'); process.exit(1); }
  /* The PALETTE blocks, plural: `:root` twice and one per theme. They are where raw hex
     belongs and the only place it does — the estate palette is copied wholesale out of
     hub/index.html and the derivations under it were measured, so a check that swept
     them would be a standing order to indirect the house colours for no reason. */
  const PAL = /(?::root|html\[data-theme="[a-z]+"\])\{[\s\S]*?\n\}/g;
  const rest = style[1].replace(PAL, '');
  const FS = new Set(['11px', '12.5px', '14px', '16px', '19px', '24px', '40px']);
  const FW = new Set(['400', '600', '800', 'inherit']);
  const RD = new Set(['var(--r1)', 'var(--r2)', 'var(--r3)', 'var(--r)', '0', 'inherit']);
  const bad = [];
  const sweep = (src, where) => {
    for (const m of src.matchAll(/font-size\s*:\s*([^;"'}\n!]+)/g))
      if (!FS.has(m[1].trim())) bad.push(`${where} font-size: ${m[1].trim()}`);
    for (const m of src.matchAll(/font-weight\s*:\s*([^;"'}\n!]+)/g))
      if (!FW.has(m[1].trim())) bad.push(`${where} font-weight: ${m[1].trim()}`);
    for (const m of src.matchAll(/border-radius\s*:\s*([^;"'}\n!]+)/g))
      if (!RD.has(m[1].trim())) bad.push(`${where} border-radius: ${m[1].trim()}`);
  };
  sweep(rest, 'stylesheet');
  sweep(out.replace(/<style>[\s\S]*?<\/style>/, ''), 'inline');
  /* Six is the scale, and a seventh step declared and never used is the scale rotting
     quietly. Only the hero's 40px is allowed to be rare. */
  for (const step of ['11px', '12.5px', '14px', '16px', '19px', '24px'])
    if (!rest.includes('font-size:' + step)) bad.push(`the ${step} step is declared and never used — the scale has six steps or it has five`);
  for (const m of rest.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) bad.push(`raw colour outside :root: ${m[0]}`);
  if (bad.length) {
    console.error(`✗ NOT SHIPPING. ${bad.length} value(s) outside the declared scale:`);
    for (const b of [...new Set(bad)].slice(0, 14)) console.error('    ' + b);
    console.error('   6 type steps (11 · 12.5 · 14 · 16 · 19 · 24, plus the 40px result hero), 3 weights, 3 radii.');
    process.exit(1);
  }
  /* ── AND NO TWO COMPONENTS SHARE A MODIFIER NAME ──────────────────────────────
     `.clozebody.seg` — a long cloze passage split into blocks — collided head-on with
     `.seg`, the navigation segmented control, so a 400-word question was laid out as a
     TAB BAR: display:flex, padding, gap, wrap. It pushed 4px past a 375px viewport and
     took the body scroll with it. Nothing threw. Both components looked entirely
     plausible on their own screens, which is why it survived.

     So: a class used as a BARE selector (its own component) may not also be used as a
     modifier on another component's element. The check is deliberately narrow — it does
     not police naming, it catches the one shape that fails silently. */
  {
    const bare = new Set([...rest.matchAll(/(?:^|[\s,>+~])\.([A-Za-z][\w-]*)\s*\{/gm)].map((m) => m[1]));
    const clash = [];
    for (const m of rest.matchAll(/\.([A-Za-z][\w-]*)\.([A-Za-z][\w-]*)/g)) {
      if (bare.has(m[2]) && m[1] !== m[2]) clash.push(`.${m[1]}.${m[2]} — "${m[2]}" is also a component of its own`);
    }
    if (clash.length) {
      console.error(`✗ NOT SHIPPING. ${clash.length} modifier name(s) collide with a component:`);
      for (const c of [...new Set(clash)]) console.error('    ' + c);
      console.error('   One of these is styling the other by accident. Rename the modifier.');
      process.exit(1);
    }
  }
  console.log('every size, weight, radius and colour in the page is on the declared scale, and no modifier collides with a component ✓');
}

const types = {};
for (const c of P.cards) types[c.type] = (types[c.type] || 0) + 1;
const tiers = {};
for (const c of P.cards) tiers[c.tier ?? '(none)'] = (tiers[c.tier ?? '(none)'] || 0) + 1;
console.log(`built index.html — ${(out.length / 1024).toFixed(0)} KB`);
console.log(`${P.cards.length} cards:`, Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('tiers:', Object.entries(tiers).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));

/* ── G30 · the cull exemption may only be spent on something genuinely absent ──
   `gapFill` lets a card survive `cullBackground`, which otherwise drops any textbook
   card whose focus points all carry one of her questions. That test is blind below
   criterion level — cvs-15 holds 47 of her questions and never once asked what
   pericarditis is — so the exemption is real and necessary. It is also exactly the
   shape of a backdoor: set the flag and any padding ships.

   So the flag COSTS something. A `gapFill` card must declare `gapTerms`, every term
   must actually appear in the card claiming it, and — the part that matters — NO OTHER
   CARD may test that term. The moment a term is covered somewhere else, the card
   claiming it is padding by the pack's own definition and the build says so.

   Checked against the SHIPPED pack, so a term that arrives later by harvest fails this
   rather than quietly leaving a duplicate in place. */
{
  const strip = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  /* What the reader is asked to produce or choose between — never the explanation, or
     a term merely NAMED in someone else's `why` would count as tested. */
  const tested = (c) => {
    const b = [c.q, c.text, c.prompt, c.stem];
    for (const k of ['options', 'statements', 'points', 'steps']) if (Array.isArray(c[k])) b.push(JSON.stringify(c[k]));
    for (const k of ['pairs', 'blanks']) if (Array.isArray(c[k])) b.push(JSON.stringify(c[k]));
    return strip(b.filter(Boolean).join(' '));
  };
  const cardsG = P.cards.filter((c) => c.type !== 'rail' && !c.damaged);
  const gapCards = cardsG.filter((c) => c.gapFill);
  const critsOfG = (c) => [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean);
  const fails = [], notes = [];
  for (const c of gapCards) {
    const terms = c.gapTerms ?? [];
    if (!terms.length) { fails.push(`a gapFill card on ${c.crit} declares no gapTerms`); continue; }
    /* THE DUPLICATE TEST IS SCOPED TO THE CRITERION, and that is the whole subtlety.
       A bare phrase means different things under different criteria: "body temperature"
       appears in two cvs-1 cards because the CARDIOVASCULAR system regulates it, which
       is not remotely the same learning objective as criterion resp-16's "the effect of
       body temperature on the rate and depth of ventilation". An unscoped substring
       search called that a duplicate and would have deleted the only card in the pack
       answering the criterion — the same context-blind matching that mis-files cards in
       map-criteria.mjs. A term is only already-covered if it is covered FOR THIS POINT.
       Cross-criterion hits are still printed, because they are worth a human glance. */
    const mine = new Set(critsOfG(c));
    for (const t of terms) {
      const needle = strip(t);
      if (!tested(c).includes(needle)) { fails.push(`${c.crit}: declares "${t}" but does not ask it`); continue; }
      const hits = cardsG.filter((o) => o !== c && tested(o).includes(needle));
      const sameCrit = hits.filter((o) => critsOfG(o).some((id) => mine.has(id)));
      if (sameCrit.length) fails.push(`${c.crit}: "${t}" is already tested by ${sameCrit.length} other card(s) on the same focus point — the exemption is not needed`);
      else if (hits.length) notes.push(`"${t}" also appears in ${hits.length} card(s) on other focus points (${[...new Set(hits.flatMap(critsOfG))].join(', ')}) — different objective, kept`);
    }
  }
  for (const n of notes) console.log(`  · ${n}`);
  if (fails.length) {
    console.error(`✗ G30 — gapFill exemptions that are not earned:\n   ${fails.join('\n   ')}`);
    process.exit(1);
  }
  const nTerms = gapCards.reduce((n, c) => n + (c.gapTerms ?? []).length, 0);
  if (gapCards.length) console.log(`${gapCards.length} gap-fill card(s) exempt from the cull, closing ${nTerms} named term(s) no other card asks ✓`);
}

/* ── coverage gate ────────────────────────────────────────────────────────────
   THE FLOOR STOPPED BEING A SHIP BLOCKER when the manufactured cards were culled.

   It used to mean "author until every focus point has 6 cards", and it worked: the
   build refused to ship a thin focus point, so one got written up to the line. Twelve
   of them were standing on cards written for no other reason than to clear it —
   measurably the least readable cards in the pack, sitting on ground the lecturer's
   own questions already covered.

   The pack now ships only what is sourced back to her material. Under that rule the
   floor can only be cleared by MINING more of her material, and where there is no more
   to mine the true number is the low one. A gate that fails the build on it is just a
   standing order to manufacture — the exact thing being removed. So:

     zero cards  → still a hard failure. An empty focus point is a hole, and the reader
                   meets it as a topic with nothing in it.
     below floor → DECLARED. `PACK.thin` carries it, the page tells the reader, and
                   apply-migration prints it as the work list for the next mining pass.

   `blindNeedsSaq` goes the same way and for the same reason: resp-15 and resp-16 have
   zero questions from her anywhere in the course, so demanding a written-answer card
   on them is demanding an invented one. */
/* QUESTION CARDS ONLY, and the rails' new focus points are exactly why this had to be
   said out loud. Three counts of "how many cards touch this point" exist in the estate
   and they answer different questions:

     PACK.thin[].n   computed in apply-migration BEFORE the rails are appended
     perPoint()      in the engine, which skips type:'rail' explicitly
     this            which counted everything, and agreed with the other two only for
                     as long as no rail carried a crit

   The moment the rails were filed under the checklist this reported resp-13 as having 5
   cards against a declared 3, and correctly failed the build. The fix is not to relax
   the comparison but to count the same thing the other two count: coverage is a claim
   about how much of HER material stands behind a focus point, and a chain to rebuild
   from memory is a different kind of study object. G-CHK2 above is the gate that every
   card — rails included — is FILED; this is the gate that filing one did not quietly
   make a thin point look covered. */
const counts = {};
for (const c of P.cards) { if (c.type === 'rail') continue;
  for (const id of [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean)) counts[id] = (counts[id] || 0) + 1; }

const empty = (P.criteria ?? []).filter(c => !counts[c.id]);
if (empty.length) {
  console.error(`✗ ${empty.length} focus point(s) with NO cards at all: ${empty.map(c => c.id).join(', ')}`);
  console.error('\n✗ NOT SHIPPING. A focus point the reader cannot reach is a hole, not thin coverage.');
  process.exit(1);
}
console.log(`all ${(P.criteria ?? []).length} focus points have at least one card ✓`);

/* ── the three criterion-integrity gates (C1, C2, C6) ─────────────────────────
   Added 11 Aug 2026 with the rebuild spec, and every one of them was failing when
   it was written. They exist because the ring system about to be built on this data
   deals cards BY focus point, so a card with no focus point is a card no reader will
   ever be dealt, and a focus point with no card of its own has no spine card to lead
   with. A queue that looks principled and is tagged wrong is worse than pack order.

   `rail` cards stay outside the COVERAGE maths — they are a different kind of study
   object and may not make a thin focus point look covered — but they are no longer
   outside the FILING. See the note in apply-migration.mjs where they are added. */
{
  const drillable = P.cards.filter(c => c.type !== 'rail');
  const critsOf = (c) => [c.crit, ...(c.alsoCrit ?? [])].filter(Boolean);

  /* ── G-CHK2: every card in the pack is filed under a checklist item ───────────
     C1 below asks this of the drillable cards and always has. This asks it of ALL of
     them, which is the claim the Checklist page makes in its own opening line —
     "everything in this tool is filed under one of them" — and which was false for the
     46 rails on the day that sentence was written. A page that states a total and is
     wrong about it is worse than a page that states nothing. */
  const unfiled = P.cards.filter(c => !critsOf(c).length);
  if (unfiled.length) {
    console.error(`✗ NOT SHIPPING. ${unfiled.length} of ${P.cards.length} cards are under no checklist item, and the Checklist page claims every card is:`);
    for (const c of unfiled.slice(0, 8)) console.error(`    [${c.type} ${c.tier ?? '—'}] ${String(c.name ?? c.q ?? '').replace(/<[^>]+>/g, '').slice(0, 76)}`);
    console.error('   Rails are authored in audit/rail-crits.json; question cards route through audit/routes.json.');
    process.exit(1);
  }
  /* ── G-CHK3: and every focus point it names is a real one ─────────────────────
     Both directions. A card naming an id that is not in PACK.criteria is dealt by
     nothing and counted by nothing; a criterion with no card renders a row promising
     zero. The second half is the gate above this block; this is the first. */
  const ids = new Set((P.criteria ?? []).map(c => c.id));
  const ghosts = P.cards.flatMap(c => critsOf(c).filter(id => !ids.has(id)).map(id => ({ c, id })));
  if (ghosts.length) {
    console.error(`✗ NOT SHIPPING. ${ghosts.length} card(s) name a focus point this pack does not declare:`);
    for (const g of ghosts.slice(0, 8)) console.error(`    ${g.id} ← ${String(g.c.name ?? g.c.q ?? '').replace(/<[^>]+>/g, '').slice(0, 60)}`);
    process.exit(1);
  }
  console.log(`all ${P.cards.length} cards are filed under a declared focus point, rails included ✓`);

  // C1 — a card the criterion-ordered queue can never deal
  const orphans = drillable.filter(c => !critsOf(c).length);
  if (orphans.length) {
    console.error(`✗ ${orphans.length} card(s) carry no focus point at all:`);
    for (const c of orphans.slice(0, 8)) console.error(`    [${c.type} ${c.tier}] ${String(c.q ?? '').replace(/<[^>]+>/g, '').slice(0, 76)}`);
    console.error('\n✗ NOT SHIPPING. Route them in audit/routes.json, or write the rule in map-criteria.mjs.');
    process.exit(1);
  }

  // C2 — a focus point that is nothing's primary subject has no spine card
  const primary = {};
  for (const c of drillable) if (c.crit) primary[c.crit] = (primary[c.crit] ?? 0) + 1;
  const noPrimary = (P.criteria ?? []).filter(c => !primary[c.id]);
  if (noPrimary.length) {
    console.error(`✗ ${noPrimary.length} focus point(s) with no card whose primary subject they are: ${noPrimary.map(c => c.id).join(', ')}`);
    console.error('   An alsoCrit mention is a card about something else. Declare a `crit` in audit/routes.json.');
    console.error('\n✗ NOT SHIPPING.');
    process.exit(1);
  }
  console.log(`every focus point is the primary subject of at least one card ✓  (thinnest: ${Object.entries(primary).sort((a, b) => a[1] - b[1])[0].join(' with ')})`);

  /* C6 — a card may not claim more focus points than it has parts to test them with.
     The cap is per-card and relative, because "too many" is not a fixed number: her
     50-mark formative Q4 is one question with ten keyed blanks covering ten different
     things, and tagging it ten ways is accurate. A single-answer multiple choice tagged
     four ways is the defect — usually because a rule fired on a DISTRACTOR, which is the
     card being described by the answers it is trying to rule out.

     parts + 3 is where the reviewed pack actually sits: after the 11 Aug rule pass the
     worst single-answer card carries 4, and each of those four is a real factor named in
     its own options. The gate locks that review in rather than proposing a new ideal. */
  const partsOf = (c) => (c.blanks?.length || c.pairs?.length || c.statements?.length || c.points?.length || c.steps?.length || 1);
  const overtagged = drillable.map(c => ({ c, n: critsOf(c).length, p: partsOf(c) })).filter(x => x.n > x.p + 3);
  if (overtagged.length) {
    console.error(`✗ ${overtagged.length} card(s) claim more focus points than they can test:`);
    for (const x of overtagged.slice(0, 8)) console.error(`    ${x.n} points / ${x.p} part(s) [${x.c.type}] ${critsOf(x.c).join(',')} — ${String(x.c.q ?? '').replace(/<[^>]+>/g, '').slice(0, 56)}`);
    console.error('\n✗ NOT SHIPPING. Trim them with a `drop` in audit/routes.json, or tighten the rule that fired.');
    process.exit(1);
  }
  const worst = drillable.map(c => ({ n: critsOf(c).length, p: partsOf(c) })).sort((a, b) => (b.n - b.p) - (a.n - a.p))[0];
  console.log(`no card claims more focus points than it can test ✓  (closest: ${worst.n} points over ${worst.p} part(s))`);

  /* ── G16: the two classifiers have to agree on the body system ───────────────
     A card carries TWO independently-derived labels, and the reader sees both on the
     same row: `topic` is the browse tab, decided by harvest.mjs from the question's
     wording and the quiz it came from; `crit` is the focus point, decided by
     map-criteria.mjs from a separate rule table. Nothing made them agree, and on
     11 Aug 2026 twenty-six shipped cards disagreed — "👃 RESPIRATORY ANATOMY ·
     FUNCTIONAL ANATOMY OF THE HEART AND GREAT VESSELS · The right and left coronary
     arteries arise from the …", a card contradicting itself on its own label row.

     Comparing two independently-derived fields is the only check that catches this;
     neither classifier can see its own error, and the counts each produces look
     healthy. Keep them independent and gate the agreement — deriving one from the
     other would remove the error and the detector in the same move.

     Compared at SYSTEM level, not topic level: which of five cardiovascular tabs a
     card sits in is a judgement call, but a respiratory question under a
     cardiovascular focus point is a defect. The case studies are the declared
     exception — cs-bp is answered from cvs-bp cards and cs-vacc from immune ones, so
     they legitimately cross. */
  const TOPIC_SYS = Object.fromEntries((P.topics ?? []).map(t => [t.id, t.sys]));
  const critSys = (id) => /^cvs-/.test(id) ? 'cvs' : /^resp-/.test(id) ? 'resp' : /^lymph-/.test(id) ? 'lymph' : 'case';
  const crossed = P.cards.filter((c) => {
    if (c.type === 'rail' || !c.crit) return false;
    const cs = critSys(c.crit);
    return cs !== 'case' && TOPIC_SYS[c.topic] !== cs;
  });
  if (crossed.length) {
    console.error(`✗ ${crossed.length} card(s) whose browse tab and focus point name different body systems:`);
    for (const c of crossed.slice(0, 12)) {
      console.error(`    ${String(c.topic).padEnd(12)} (${TOPIC_SYS[c.topic]})  vs  ${String(c.crit).padEnd(9)} (${critSys(c.crit)})  ${String(c.q ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 58)}`);
    }
    console.error('\n   One of the two is wrong. Fix the FOCUS POINT with `crit`/`add`/`drop` in');
    console.error('   audit/routes.json, or the BROWSE TAB with `topic` in the same file (or a rule');
    console.error('   in harvest.mjs — APPEND, never insert).');
    console.error('\n✗ NOT SHIPPING. A card that contradicts itself on its own label row reads as broken.');
    process.exit(1);
  }
  console.log(`browse tab and focus point agree on the body system for all ${P.cards.filter(c => c.crit && c.type !== 'rail').length} labelled cards ✓`);

  /* C5 — what the SPINE CARD of each focus point is made of.
     Ring 0 deals one card per focus point and says, in effect, "answer this and you have
     covered that part of the paper". The claim is only as good as the card: a `verbatim`
     spine is one of Hannetjie's own questions, a `taught` spine is her lecture pinned by a
     quote, and a `textbook` spine is a sentence this pack wrote about a topic the course
     has never been observed to ask. All three are legitimate to ship; only the last one
     must never be shipped SILENTLY.

     So the rule is not "every spine must be verbatim" — that would be a demand to invent
     questions. It is: a focus point that cannot field one of her own questions has to be
     saying so in the pack, and a focus point standing entirely on background reading has
     to carry a sentence explaining that to the reader. Both directions are checked, so a
     note that stops being true fails the build instead of reassuring nobody. */
  const RANK = { verbatim: 3, taught: 2, textbook: 1 };
  const spineTrouble = [], staleNote = [];
  for (const cr of P.criteria ?? []) {
    const mine = drillable.filter(c => c.crit === cr.id);
    const best = Math.max(0, ...mine.map(c => RANK[c.tier] ?? 0));
    if (best === 3) {
      if (cr.acknowledgedGap) staleNote.push(`${cr.id}: carries an acknowledged-gap note, but its spine card is now one of Hannetjie's own questions — delete the note in apply-migration.mjs`);
      continue;
    }
    if (!cr.blind) spineTrouble.push(`${cr.id}: best card for it is \`${best === 2 ? 'taught' : 'textbook'}\`, but the pack does not mark the point as never-practised — the reader is told nothing`);
    if (best === 1 && !cr.acknowledgedGap) spineTrouble.push(`${cr.id}: every card on it is background reading and there is no acknowledged-gap note saying so`);
    // the engine renders this note through esc(); markup in it reaches the reader as angle brackets
    if (/[<>]/.test(cr.acknowledgedGap ?? '')) spineTrouble.push(`${cr.id}: the acknowledged-gap note contains markup, and the engine escapes it — write it in plain text`);
    if (best === 0) spineTrouble.push(`${cr.id}: no card is primarily about it at all`);
  }
  if (spineTrouble.length || staleNote.length) {
    for (const m of [...spineTrouble, ...staleNote]) console.error(`✗ ${m}`);
    console.error('\n✗ NOT SHIPPING. A focus point whose spine card is not one of her questions must say so.');
    process.exit(1);
  }
  const byTier = { verbatim: 0, taught: 0, textbook: 0 };
  for (const cr of P.criteria ?? []) {
    const best = Math.max(0, ...drillable.filter(c => c.crit === cr.id).map(c => RANK[c.tier] ?? 0));
    byTier[best === 3 ? 'verbatim' : best === 2 ? 'taught' : 'textbook']++;
  }
  console.log(`spine cards: ${byTier.verbatim} focus points can field one of her own questions, ${byTier.taught} her lecture, ${byTier.textbook} background reading (declared) ✓`);

  /* ── PACK.spine resolves, and resolves to the card that was reviewed ──────────
     Ring 0 is a list of card KEYS, and a key that matches nothing deals an empty ring
     while every count around it still looks right. The keys are written by
     apply-migration.mjs from audit/spine.mjs; this re-derives them here, from the
     shipped pack, with the same module — so a spine that has silently drifted from the
     38 cards a human read fails the build rather than the reader's session. */
  const { spineFor } = await import('./audit/spine.mjs');
  const { ckey } = await import('./audit/ckey.mjs');
  const spine = P.spine ?? {};
  const spineBad = [];
  for (const cr of P.criteria ?? []) {
    const want = spineFor(P.cards, cr.id);
    const got = spine[cr.id];
    if (!want) { if (got) spineBad.push(`${cr.id}: has a spine key but no card is primarily about it`); continue; }
    if (!got) { spineBad.push(`${cr.id}: no spine key — Ring 0 would skip this focus point`); continue; }
    if (got !== ckey(want)) spineBad.push(`${cr.id}: spine key ${got} is not the card spine.mjs chooses (${ckey(want)})`);
    if (!P.cards.some(c => ckey(c) === got)) spineBad.push(`${cr.id}: spine key ${got} matches no shipped card`);
  }
  if (spineBad.length) {
    for (const m of spineBad) console.error(`✗ ${m}`);
    console.error('\n✗ NOT SHIPPING. Re-run apply-migration.mjs — PACK.spine is stale.');
    process.exit(1);
  }
  console.log(`Ring 0 is ${Object.keys(spine).length} keys, every one resolving to the card audit/spine.mjs chooses ✓`);

  /* ── G24: the FORMATIVE tie-break still matches her formatives ────────────────
     spine.mjs decides "came from a formative" by matching the word against each card's
     `ev.quiz` / `ev.src`, because the alternative — a hardcoded list of registry ids —
     goes stale silently and that file has no way to notice. This is the half of that
     bargain that does the noticing.

     A predicate that matches NOTHING is the dangerous failure, and it is invisible: the
     sort still runs, every count is unchanged, Round 1 is still 38 cards, and the only
     symptom is that the deal quietly reverts to being decided by `parts`. So assert the
     population, in both directions. The floor is her two formatives at their current
     reach; the ceiling exists because /formative/i is a word match and a course that
     starts titling its topic quizzes "formative" would swallow the whole pack and the
     tie-break would again decide nothing. */
  const { isFormative } = await import('./audit/spine.mjs');
  const drill = P.cards.filter(c => c.type !== 'rail' && !c.damaged);
  const nF = drill.filter(isFormative).length;
  const leadF = (P.criteria ?? []).map(cr => spineFor(P.cards, cr.id)).filter(c => c && isFormative(c)).length;
  if (nF < 20 || nF > drill.length * 0.25) {
    console.error(`✗ NOT SHIPPING. The formative tie-break matches ${nF} of ${drill.length} drillable cards.`);
    console.error('  Too few means her formatives have been renamed out of the predicate and Round 1 has silently');
    console.error('  gone back to being decided by part-count; too many means the word no longer distinguishes');
    console.error('  anything. Check ev.quiz / ev.src against audit/registry.json, then re-read spine.mjs.');
    process.exit(1);
  }
  if (leadF < 8) {
    console.error(`✗ NOT SHIPPING. Only ${leadF} of the 38 lead cards come from a formative — it was 13 when the`);
    console.error('  tie-break was added, and 3 before it. A drop means the tie-break is no longer reaching the deal.');
    process.exit(1);
  }
  console.log(`formative tie-break live: ${nF} drillable cards trace to one of her formatives, ${leadF} of them lead a focus point ✓`);

  /* ── G15: the engine's rings are audit/spine.mjs's rings ─────────────────────
     `ringOf` is written twice — in audit/spine.mjs, and again inside the shipped page,
     which imports nothing because it is one offline file. Two implementations of "which
     ring is this card in" do not fail loudly when they drift: they deal a different deck
     from the one the spec describes and measure-spec.mjs prints, and every screen still
     looks right. The page counted its own rings during the smoke test above, in its own
     scope; this is the comparison. */
  const { ringCounts } = await import('./audit/spine.mjs');
  const want = ringCounts(P, ckey);
  if (!ENGINE_RINGS) {
    console.error('✗ the shipped page reported no ring counts — has ringOf/HASRINGS been renamed, or has PACK.spine gone?');
    process.exit(1);
  }
  if (ENGINE_RINGS.join(',') !== want.join(',')) {
    console.error('✗ the page deals different rings from the ones audit/spine.mjs describes:');
    console.error(`    page      : ${ENGINE_RINGS.map((n, i) => `Ring ${i} ${n}`).join(' · ')}`);
    console.error(`    spine.mjs : ${want.map((n, i) => `Ring ${i} ${n}`).join(' · ')}`);
    console.error('\n✗ NOT SHIPPING. The reader would be dealt a deck nobody reviewed.');
    process.exit(1);
  }
  console.log(`rings agree, page and spine.mjs: ${want.map((n, i) => `Ring ${i} ${n}`).join(' · ')} ✓`);

  /* ── G23 + G24, read back ─────────────────────────────────────────────────── */
  const Y = ENGINE_YIELD;
  if (P.written?.length) {
    if (!Y) { console.error('✗ the pack declares a written half and the page reported nothing — has yieldOpen or HASWRITTEN been renamed?'); process.exit(1); }
    const bad = [];
    if (!Y.same) bad.push('yieldOpen changed Round 1 membership — it may only reorder');
    if (!Y.lead) bad.push('Round 1 does not open on a card whose PRIMARY subject is a written-half topic');
    if (!Y.headClean) bad.push('the written cards are not contiguous at the front of Round 1');
    if (Y.strays) bad.push(`${Y.strays} card(s) in the written round are not on a declared written point`);
    if (Y.wRound !== Y.wantW) bad.push(`the written round holds ${Y.wRound} cards, ${Y.wantW} qualify`);
    if (!Y.escapeIsWritten) bad.push(`"Skip ahead" lands on round ${Y.escapeTo}, not the written half`);
    if (bad.length) { console.error('✗ ' + bad.join('\n✗ ')); console.error('\n✗ NOT SHIPPING.'); process.exit(1); }
    console.log(`the written half is Round ${Y.escapeTo + 1} — ${Y.wRound} cards, all on a declared point, dealt first in Round 1 and the escape hatch's destination ✓`);
  }
  const ST = ENGINE_STOP;
  if (P.spine && Object.keys(P.spine).length) {
    if (!ST) { console.error('✗ the pack has rounds and the page reported no set — has setSize or sessStart been renamed?'); process.exit(1); }
    const bad = [];
    if (ST.dealt !== ST.size) bad.push(`a set of ${ST.size} dealt ${ST.dealt} cards`);
    if (!ST.stopped) bad.push(`the study view dealt another card after the set of ${ST.size} was complete — the card-39 loop is back`);
    if (!ST.none) bad.push('the done screen has nothing to say when no topic is half-way');
    if (!ST.fresh) bad.push('the done screen does not tell a reader when to come back');
    if (!ST.clock) bad.push('the come-back line gives no clock time — a duration is a sum the reader has to do');
    if (!ST.ready) bad.push('the done screen does not notice when the hour is already up');
    if (bad.length) { console.error('✗ ' + bad.join('\n✗ ')); console.error('\n✗ NOT SHIPPING.'); process.exit(1); }
    console.log(`a set of ${ST.size} cards ends, and the done screen names a clock time to come back ✓`);
  }
  const SH = ENGINE_SHARE;
  if (SH) {
    if (!SH.differs) {
      console.error(`✗ the written-share wording did not change when the exam config did (both "${SH.real}") — it is a literal, not a reading of paperWeights()`);
      process.exit(1);
    }
    console.log(`the written share reads "${SH.real}" and is derived from the exam config, not typed ✓`);
  }
}

/* The declaration has to REACH the reader, or culling to honest numbers just means
   quietly shipping thinner coverage. Prove the pack carries it and the engine renders
   it, rather than trusting that it does. */
const thin = P.thin ?? [];
if (thin.length) {
  console.log(`${thin.length} focus point(s) declared thin: ` + thin.map(t => `${t.id} ${t.n}/${t.floor}`).join(' · '));
  const stale = thin.filter(t => (counts[t.id] || 0) !== t.n);
  if (stale.length) {
    console.error(`✗ PACK.thin disagrees with the cards actually in the pack: ${stale.map(t => `${t.id} says ${t.n}, pack has ${counts[t.id] || 0}`).join(' · ')}`);
    process.exit(1);
  }
  if (!tpl.includes('PACK.thin')) {
    console.error('✗ NOT SHIPPING. The pack declares thin focus points but the engine never reads PACK.thin — the reader would never be told.');
    process.exit(1);
  }
}
console.log(`${used.size} of ${Object.keys(FIG).length} ported figures wired to cards`);
if (used.size === 0) { console.error('✗ no figures wired — pack.js has lost its F()/FC() calls'); process.exit(1); }

/* ── explanation gate ─────────────────────────────────────────────────────────
   Getting a question wrong is the moment the tool either teaches the reader or loses
   them. A card that answers "why was I wrong?" with nothing but a red box does the
   second, and half the machine-marked cards used to do exactly that.

   The engine synthesises a floor line (the correct option, the pairs or blanks missed)
   so nobody ever meets a bare mark — but a floor is not teaching, and without a gate
   here there is nothing to stop the next batch of cards arriving without one. Same
   shape as the coverage gate above: authored in audit/explanations.json, enforced at
   ship time, no runtime warning for the reader to decode. */
const MARKED = ['mcq', 'match', 'cloze', 'tfset', 'order'];
const noWhy = P.cards.filter(c => MARKED.includes(c.type) && !String(c.why ?? '').trim());
const noModel = P.cards.filter(c => c.type === 'saq' && !String(c.model ?? '').trim());
console.log(noWhy.length || noModel.length
  ? `✗ ${noWhy.length} machine-marked card(s) with no explanation, ${noModel.length} written answer(s) with no model`
  : `every one of the ${P.cards.filter(c => MARKED.includes(c.type)).length} machine-marked cards explains itself, and all ${P.cards.filter(c => c.type === 'saq').length} written answers carry a model ✓`);
for (const c of [...noWhy, ...noModel].slice(0, 8)) {
  console.error(`    ${c.type} ${c.crit ?? '?'}: ${String(c.q ?? '').replace(/<[^>]+>/g, '').slice(0, 72)}`);
}
if (noWhy.length || noModel.length) {
  console.error('\n✗ NOT SHIPPING. Author the missing `why:`/`model:` in audit/explanations.json and re-run apply-migration.');
  process.exit(1);
}

/* Written last, so "NOT SHIPPING" above is literally true. It used to be written
   before the gates ran, which left a failing build with a fresh index.html on disk
   next to a message saying it had not shipped one. */
writeFileSync('index.html', out);
console.log('wrote index.html');
