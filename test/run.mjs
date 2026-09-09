import assert from 'node:assert/strict';
import {
  compileRdfToProlog,
  compileRdfDocumentToProlog,
  extractRdfFromProlog,
  parseNQuads,
  serializeRdfFromProlog,
} from '../src/index.mjs';
import { parseClauses, parseGoalText, parseNumberTokenText } from '../src/prolog-parser.mjs';

let passed = 0;
function test(name, fn) {
  try {
    const result = fn();
    if (result?.then) return result.then(() => { passed++; console.log(`ok - ${name}`); });
    passed++; console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await test('N-Quads roundtrips through rdf/4 Prolog facts', () => {
  const input = '<https://example/s> <https://example/p> "chat"@fr <https://example/g> .\n_:a <https://example/value> "42"^^<http://www.w3.org/2001/XMLSchema#integer> .\n';
  const prolog = compileRdfToProlog(input, { scope: 'doc' });
  assert.equal(
    extractRdfFromProlog(prolog),
    '<https://example/s> <https://example/p> "chat"@fr <https://example/g> .\n_:e646f63_61 <https://example/value> "42"^^<http://www.w3.org/2001/XMLSchema#integer> .\n',
  );
});

await test('RDF 1.2 directional and triple terms roundtrip', () => {
  const input = 'VERSION "1.2"\n<https://example/s> <https://example/says> <<( _:a <https://example/text> "مرحبا"@ar--rtl )>> .\n';
  const prolog = compileRdfToProlog(input, { scope: 'doc' });
  assert.equal(
    extractRdfFromProlog(prolog),
    '<https://example/s> <https://example/says> <<( _:e646f63_61 <https://example/text> "مرحبا"@ar--rtl )>> .\n',
  );
});

await test('nested RDF 1.2 triple terms roundtrip', () => {
  const input = '<https://example/s> <https://example/p> <<( <https://example/a> <https://example/b> <<( _:x <https://example/c> "line\\nfeed" )>> )>> .\n';
  const prolog = compileRdfToProlog(input, { scope: 'doc' });
  assert.equal(
    extractRdfFromProlog(prolog),
    '<https://example/s> <https://example/p> <<( <https://example/a> <https://example/b> <<( _:e646f63_78 <https://example/c> "line\\nfeed" )>> )>> .\n',
  );
});

await test('Unicode blank-node labels are preserved through scoped encoding', () => {
  const input = '_:éclair <https://example/p> _:名.\n';
  const prolog = compileRdfToProlog(input, { scope: 'doc' });
  assert.equal(
    extractRdfFromProlog(prolog),
    '_:e646f63_c3a9636c616972 <https://example/p> _:e646f63_e5908d .\n',
  );
});

await test('RDF text atoms preserve ISO controls and hostile-looking data', () => {
  const input = '<https://example/s> <https://example/p> "bell\\u0007 back\\b tab\\t line\\n vertical\\u000b form\\f return\\r quote\\\" slash\\\\ apostrophe\' ).\\n:- halt.\\n%" .\n';
  const prolog = compileRdfToProlog(input, { scope: 'doc' });
  assert.match(prolog, /apostrophe'' \)\./);
  assert.match(prolog, /\\n:- halt\./);
  assert.equal(extractRdfFromProlog(prolog), input);
});

await test('RDF text positions reject Prolog string and number coercions', () => {
  const suffix = ", iri('https://example/p'), iri('https://example/o'), default_graph).";
  assert.throws(() => extractRdfFromProlog('rdf(iri("https://example/s")' + suffix), /IRI must be an atom/);
  assert.throws(
    () => extractRdfFromProlog(
      "rdf(iri('https://example/s'), iri('https://example/p'), literal(42, datatype('http://www.w3.org/2001/XMLSchema#integer')), default_graph).",
    ),
    /literal must be an atom/,
  );
});

await test('RDF conversion validates absolute IRIs, language tags, and base direction', () => {
  assert.throws(
    () => parseNQuads('<relative> <https://example/p> <https://example/o> .\n'),
    /IRI must be absolute/,
  );
  assert.throws(
    () => extractRdfFromProlog(
      "rdf(iri('https://example/s'), iri('https://example/p'), literal('x', lang('en_us')), default_graph).",
    ),
    /invalid language tag/,
  );
  assert.throws(
    () => extractRdfFromProlog(
      "rdf(iri('https://example/s'), iri('https://example/p'), literal('x', lang('en', 'LTR')), default_graph).",
    ),
    /base direction must be ltr or rtl/,
  );
  assert.throws(
    () => extractRdfFromProlog(
      "rdf(iri('https://example/s'), iri('https://example/p'), literal('x', datatype('relative')), default_graph).",
    ),
    /datatype IRI must be absolute/,
  );
});

await test('Prolog RDF facts serialize as Turtle from a .ttl-style format', () => {
  const source = `
    rdf(iri('https://example/s'), iri('https://example/p'), literal('hello', datatype('http://www.w3.org/2001/XMLSchema#string')), default_graph).
  `;
  assert.equal(
    serializeRdfFromProlog(source, { format: 'ttl' }),
    'VERSION "1.2"\n\n<https://example/s> <https://example/p> "hello" .\n',
  );
});

await test('Prolog RDF facts serialize named graphs as TriG', () => {
  const source = `
    rdf(iri('https://example/s'), iri('https://example/p'), iri('https://example/o'), iri('https://example/g')).
  `;
  assert.equal(
    serializeRdfFromProlog(source, { format: 'trig' }),
    'VERSION "1.2"\n\n<https://example/g> {\n  <https://example/s> <https://example/p> <https://example/o> .\n}\n',
  );
});

await test('only rdf/4 facts are serialized and duplicates are removed', () => {
  const source = `
    note(ignored).
    rdf(iri('https://example/s'), iri('https://example/p'), iri('https://example/o'), default_graph).
    rdf(X, P, O, G) :- other(X, P, O, G).
    rdf(iri('https://example/s'), iri('https://example/p'), iri('https://example/o'), default_graph).
  `;
  assert.equal(extractRdfFromProlog(source), '<https://example/s> <https://example/p> <https://example/o> .\n');
});

await test('RDF extraction never executes directives or rules', () => {
  const source = `
    :- initialization(halt).
    note(not_extracted).
    rdf(X, P, O, G) :- would_execute(X, P, O, G).
    rdf(iri('https://example/s'), iri('https://example/p'), iri('https://example/o'), default_graph).
  `;
  assert.equal(extractRdfFromProlog(source), '<https://example/s> <https://example/p> <https://example/o> .\n');
});

await test('vendored parser matches current EyeProlog integer separators', () => {
  const clauses = parseClauses('decimal(1_ /* grouping */ 000). radix(0xCA_FE).', {
    sourceMetadata: false,
  });
  assert.equal(clauses[0].head.args[0].name, '1000');
  assert.equal(clauses[1].head.args[0].name, '51966');
  assert.equal(parseNumberTokenText('1_000').name, '1000');
  assert.throws(() => parseNumberTokenText('1_000', { isoStrict: true }));
});

await test('vendored parser matches current EyeProlog double-bar lists', () => {
  const list = parseGoalText('p("ab"||Tail)').args[0];
  assert.equal(list.name, '.');
  assert.equal(list.args[0].name, 'a');
  assert.equal(list.args[1].name, '.');
  assert.equal(list.args[1].args[0].name, 'b');
  assert.equal(list.args[1].args[1].name, 'Tail');
  assert.throws(() => parseGoalText('p("ab"||Tail)', { isoStrict: true }));
});

await test('include-source keeps source facts separate', () => {
  const prolog = compileRdfToProlog('<https://example/s> <https://example/p> <https://example/o> .\n', { includeSource: true });
  assert.match(prolog, /rdf\(S, P, O, G\) :- source_rdf\(S, P, O, G\)\./);
  assert.match(prolog, /source_rdf\(iri\('https:\/\/example\/s'\)/);
  assert.equal(extractRdfFromProlog(prolog), '');
});

await test('N-Quads document input does not require rdf-parse', async () => {
  const source = '<https://example/s> <https://example/p> <https://example/o> .\n';
  const prolog = await compileRdfDocumentToProlog(source, { inputPath: 'example.nq', scope: 'example.nq' });
  assert.equal(extractRdfFromProlog(prolog), source);
});

// Confirm rdf-parse integration when the dependency is present. The extraction's
// core N-Quads path remains independently testable without it.
try {
  await import('rdf-parse');
  await test('Turtle input is accepted through rdf-parse', async () => {
    const source = '@prefix ex: <https://example/>. ex:s ex:p ex:o.';
    const prolog = await compileRdfDocumentToProlog(source, {
      inputPath: 'example.ttl', scope: 'example.ttl', baseIRI: 'https://example/base',
    });
    assert.equal(extractRdfFromProlog(prolog), '<https://example/s> <https://example/p> <https://example/o> .\n');
  });
} catch (error) {
  if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  console.log('skip - Turtle input (rdf-parse is not installed)');
}

console.log(`1..${passed}`);
