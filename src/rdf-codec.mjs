// RPI-RDF12 Quad Profile <-> ordinary ISO Prolog term encoding.
export const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
export const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
export const RDF_DIR_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#dirLangString';

export function parseNQuads(source, { scope = 'input' } = {}) {
  return new NQuadsParser(stripVersionDirective(source), scope).parse();
}

function stripVersionDirective(source) {
  return String(source ?? '').replace(/^([ \t]*)VERSION[ \t]+"1\.2"[ \t]*(?:#.*)?$/m, '$1');
}

class NQuadsParser {
  constructor(source, scope) { this.source = source; this.scope = scope; this.offset = 0; }

  parse() {
    const quads = [];
    this.space();
    while (!this.done()) {
      const subject = this.resource('subject');
      this.requiredSpace();
      const predicate = this.iri();
      this.requiredSpace();
      const object = this.term('object');
      const hadSpace = this.space();
      const graph = this.peek() === '.' ? { kind: 'defaultGraph' } : this.resource('graph');
      if (graph.kind !== 'defaultGraph') this.space();
      if (this.take() !== '.') this.fail('expected a terminating period');
      if (!hadSpace && graph.kind !== 'defaultGraph') this.fail('expected whitespace before graph');
      quads.push({ subject, predicate, object, graph });
      this.space();
    }
    return quads;
  }

  term(position) {
    if (this.starts('<<(')) return this.triple();
    if (this.peek() === '<') return this.iri();
    if (this.starts('_:')) return this.blank();
    if (this.peek() === '"') return this.literal();
    this.fail(`expected RDF ${position}`);
  }

  resource(position) {
    const term = this.term(position);
    if (!['namedNode', 'blankNode'].includes(term.kind)) this.fail(`${position} must be an IRI or blank node`);
    return term;
  }

  triple() {
    this.offset += 3;
    this.space();
    const subject = this.resource('triple subject');
    this.requiredSpace();
    const predicate = this.iri();
    this.requiredSpace();
    const object = this.term('triple object');
    this.space();
    if (!this.starts(')>>')) this.fail('expected )>> after triple term');
    this.offset += 3;
    return { kind: 'triple', subject, predicate, object };
  }

  iri() {
    if (this.take() !== '<') this.fail('expected IRI');
    let value = '';
    while (!this.done() && this.peek() !== '>') {
      const c = this.take();
      if (c === '\\') value += this.unicodeEscape();
      else {
        if (/[\u0000-\u0020<>"{}|^`]/u.test(c)) this.fail('invalid character in IRI');
        value += c;
      }
    }
    if (this.take() !== '>') this.fail('unterminated IRI');
    assertIri(value);
    return { kind: 'namedNode', value };
  }

  blank() {
    this.offset += 2;
    const start = this.offset;
    while (!this.done() && !/[\s<>"{}|^`\\()]/u.test(this.peek())) this.offset++;
    while (this.offset > start && this.source[this.offset - 1] === '.') this.offset--;
    const value = this.source.slice(start, this.offset);
    if (!/^[\p{L}\p{N}_](?:[\p{L}\p{N}\p{M}_\-\u00b7\u203f\u2040.]*[\p{L}\p{N}\p{M}_\-\u00b7\u203f\u2040])?$/u.test(value)) this.fail('invalid blank-node label');
    return { kind: 'blankNode', scope: this.scope, value };
  }

  literal() {
    this.offset++;
    let value = '';
    while (!this.done() && this.peek() !== '"') {
      const c = this.take();
      if (c === '\\') value += this.stringEscape();
      else {
        if (c.codePointAt(0) < 0x20) this.fail('control character in literal');
        value += c;
      }
    }
    if (this.take() !== '"') this.fail('unterminated literal');
    if (this.takeIf('@')) {
      const language = this.match(/[A-Za-z]+(?:-[A-Za-z0-9]+)*/y, 'language tag').toLowerCase();
      let direction = '';
      if (this.starts('--')) {
        this.offset += 2;
        direction = this.match(/(?:ltr|rtl)/iy, 'base direction').toLowerCase();
      }
      return { kind: 'literal', value, language, direction, datatype: direction ? RDF_DIR_LANG_STRING : RDF_LANG_STRING };
    }
    const datatype = this.starts('^^') ? (this.offset += 2, this.iri().value) : XSD_STRING;
    return { kind: 'literal', value, language: '', direction: '', datatype };
  }

  unicodeEscape() {
    const marker = this.take();
    const size = marker === 'u' ? 4 : marker === 'U' ? 8 : 0;
    if (!size) this.fail('IRI escapes must use \\u or \\U');
    const hexValue = this.source.slice(this.offset, this.offset + size);
    if (!new RegExp(`^[0-9A-Fa-f]{${size}}$`).test(hexValue)) this.fail('invalid Unicode escape');
    this.offset += size;
    const point = Number.parseInt(hexValue, 16);
    if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) this.fail('invalid Unicode code point');
    return String.fromCodePoint(point);
  }

  stringEscape() {
    const c = this.take();
    const simple = { t: '\t', b: '\b', n: '\n', r: '\r', f: '\f', '"': '"', "'": "'", '\\': '\\' };
    if (Object.hasOwn(simple, c)) return simple[c];
    this.offset--;
    return this.unicodeEscape();
  }

  space() {
    const start = this.offset;
    for (;;) {
      while (/\s/u.test(this.peek() ?? '')) this.offset++;
      if (this.peek() !== '#') break;
      while (!this.done() && this.peek() !== '\n' && this.peek() !== '\r') this.offset++;
    }
    return this.offset > start;
  }

  requiredSpace() { if (!this.space()) this.fail('expected whitespace'); }
  match(pattern, label) { pattern.lastIndex = this.offset; const found = pattern.exec(this.source); if (!found) this.fail(`invalid ${label}`); this.offset = pattern.lastIndex; return found[0]; }
  starts(value) { return this.source.startsWith(value, this.offset); }
  takeIf(value) { if (!this.starts(value)) return false; this.offset += value.length; return true; }
  peek() { return this.source[this.offset]; }
  take() { return this.source[this.offset++]; }
  done() { return this.offset >= this.source.length; }
  fail(message) { const line = this.source.slice(0, this.offset).split(/\r\n?|\n/).length; throw new Error(`${message} on line ${line}`); }
}

export function fromRdfJsQuad(quad, scope = 'input') {
  return {
    subject: fromRdfJs(quad.subject, scope),
    predicate: fromRdfJs(quad.predicate, scope),
    object: fromRdfJs(quad.object, scope),
    graph: fromRdfJs(quad.graph, scope),
  };
}

export function fromRdfJs(term, scope = 'input') {
  if (term.termType === 'NamedNode') {
    assertIri(term.value);
    return { kind: 'namedNode', value: term.value };
  }
  if (term.termType === 'BlankNode') {
    assertText(scope, 'blank-node scope');
    assertText(term.value, 'blank-node label');
    return { kind: 'blankNode', scope, value: term.value };
  }
  if (term.termType === 'DefaultGraph') return { kind: 'defaultGraph' };
  if (term.termType === 'Literal') return { kind: 'literal', value: term.value, language: term.language, direction: term.direction ?? '', datatype: term.datatype.value };
  if (term.termType === 'Quad') return { kind: 'triple', subject: fromRdfJs(term.subject, scope), predicate: fromRdfJs(term.predicate, scope), object: fromRdfJs(term.object, scope) };
  throw new Error(`unsupported RDF/JS term type: ${term.termType}`);
}

export function quadToEyeProlog(q, predicate = 'rdf') {
  assertQuad(q);
  return `${predicate}(${toEyeProlog(q.subject)}, ${toEyeProlog(q.predicate)}, ${toEyeProlog(q.object)}, ${toEyeProlog(q.graph)}).`;
}

export function toEyeProlog(t) {
  if (t.kind === 'namedNode') {
    assertIri(t.value);
    return `iri(${quote(t.value)})`;
  }
  if (t.kind === 'blankNode') {
    assertText(t.scope, 'blank-node scope');
    assertText(t.value, 'blank-node label');
    return `bnode(${quote(t.scope)}, ${quote(t.value)})`;
  }
  if (t.kind === 'defaultGraph') return 'default_graph';
  if (t.kind === 'triple') {
    assertTriple(t.subject, t.predicate, t.object);
    return `triple(${toEyeProlog(t.subject)}, ${toEyeProlog(t.predicate)}, ${toEyeProlog(t.object)})`;
  }
  if (t.kind === 'literal') {
    assertLiteral(t);
    const annotation = t.language
      ? (t.direction ? `lang(${quote(t.language)}, ${t.direction})` : `lang(${quote(t.language)})`)
      : `datatype(${quote(t.datatype ?? XSD_STRING)})`;
    return `literal(${quote(t.value)}, ${annotation})`;
  }
  throw new Error(`unsupported RDF term kind: ${t?.kind ?? typeof t}`);
}

export function eyePrologQuadToNQuad(term) {
  if (term?.type !== 'compound' || term.name !== 'rdf' || term.args.length !== 4) throw new Error('expected rdf/4 fact');
  const [subject, predicate, object, graph] = term.args.map(fromEyeProlog);
  return quadToNQuad({ subject, predicate, object, graph });
}

export function quadToNQuad({ subject, predicate, object, graph }) {
  assertQuad({ subject, predicate, object, graph });
  return `${toNQ(subject)} ${toNQ(predicate)} ${toNQ(object)}${graph.kind === 'defaultGraph' ? '' : ` ${toNQ(graph)}`} .`;
}

export function quadsToTurtle(quads) {
  for (const quad of quads) {
    assertQuad(quad);
    if (quad.graph.kind !== 'defaultGraph') throw new Error('Turtle output cannot contain named graphs; use TriG or N-Quads');
  }
  const body = quads.map((q) => `${toNQ(q.subject)} ${toNQ(q.predicate)} ${toNQ(q.object)} .`).join('\n');
  return `VERSION "1.2"\n${body ? `\n${body}\n` : '\n'}`;
}

export function quadsToTrig(quads) {
  const defaults = [];
  const named = new Map();
  for (const quad of quads) {
    assertQuad(quad);
    if (quad.graph.kind === 'defaultGraph') {
      defaults.push(quad);
      continue;
    }
    const key = toNQ(quad.graph);
    if (!named.has(key)) named.set(key, []);
    named.get(key).push(quad);
  }
  const chunks = [];
  if (defaults.length) {
    chunks.push(defaults.map((q) => `${toNQ(q.subject)} ${toNQ(q.predicate)} ${toNQ(q.object)} .`).join('\n'));
  }
  for (const [graph, graphQuads] of named) {
    const body = graphQuads.map((q) => `  ${toNQ(q.subject)} ${toNQ(q.predicate)} ${toNQ(q.object)} .`).join('\n');
    chunks.push(`${graph} {\n${body}\n}`);
  }
  return `VERSION "1.2"\n${chunks.length ? `\n${chunks.join('\n\n')}\n` : '\n'}`;
}

export function fromEyeProlog(t) {
  if (t?.type === 'atom' && t.name === 'default_graph') return { kind: 'defaultGraph' };
  if (compound(t, 'iri', 1)) {
    const value = textAtom(t.args[0], 'IRI');
    assertIri(value);
    return { kind: 'namedNode', value };
  }
  if (compound(t, 'bnode', 2)) {
    return {
      kind: 'blankNode',
      scope: textAtom(t.args[0], 'blank-node scope'),
      value: textAtom(t.args[1], 'blank-node label'),
    };
  }
  if (compound(t, 'triple', 3)) {
    const [subject, predicate, object] = t.args.map(fromEyeProlog);
    assertTriple(subject, predicate, object);
    return { kind: 'triple', subject, predicate, object };
  }
  if (compound(t, 'literal', 2)) {
    const value = textAtom(t.args[0], 'literal');
    if (compound(t.args[1], 'lang', 1)) {
      const language = normalizedLanguage(textAtom(t.args[1].args[0], 'language'));
      return { kind: 'literal', value, language, direction: '', datatype: RDF_LANG_STRING };
    }
    if (compound(t.args[1], 'lang', 2)) {
      const language = normalizedLanguage(textAtom(t.args[1].args[0], 'language'));
      const direction = textAtom(t.args[1].args[1], 'base direction');
      if (direction !== 'ltr' && direction !== 'rtl') throw new Error('base direction must be ltr or rtl');
      return { kind: 'literal', value, language, direction, datatype: RDF_DIR_LANG_STRING };
    }
    if (compound(t.args[1], 'datatype', 1)) {
      const datatype = textAtom(t.args[1].args[0], 'datatype');
      assertIri(datatype, 'datatype IRI');
      return { kind: 'literal', value, language: '', datatype };
    }
    throw new Error('literal annotation must be lang/1, lang/2, or datatype/1');
  }
  throw new Error(`term is not an RDF value: ${t?.name ?? typeof t}`);
}

function toNQ(t) {
  if (t.kind === 'namedNode') return `<${escapeIri(t.value)}>`;
  if (t.kind === 'blankNode') return `_:e${hex(t.scope)}_${hex(t.value)}`;
  if (t.kind === 'triple') return `<<( ${toNQ(t.subject)} ${toNQ(t.predicate)} ${toNQ(t.object)} )>>`;
  if (t.kind === 'literal') {
    const q = `"${escapeRdfString(t.value)}"`;
    if (t.language) return `${q}@${t.language}${t.direction ? `--${t.direction}` : ''}`;
    return (t.datatype ?? XSD_STRING) === XSD_STRING ? q : `${q}^^<${escapeIri(t.datatype)}>`;
  }
  throw new Error(`cannot serialize ${t.kind}`);
}
function quote(value) {
  assertText(value, 'RDF text');
  let escaped = '';
  for (const character of value) {
    const code = character.codePointAt(0);
    if (character === "'") escaped += "''";
    else if (character === '\\') escaped += '\\\\';
    else if (character === '\x07') escaped += '\\a';
    else if (character === '\b') escaped += '\\b';
    else if (character === '\t') escaped += '\\t';
    else if (character === '\n') escaped += '\\n';
    else if (character === '\v') escaped += '\\v';
    else if (character === '\f') escaped += '\\f';
    else if (character === '\r') escaped += '\\r';
    else if (code < 0x20 || code === 0x7f) escaped += '\\x' + code.toString(16) + '\\';
    else escaped += character;
  }
  return "'" + escaped + "'";
}

function escapeRdfString(value) {
  assertText(value, 'literal');
  let escaped = '';
  for (const character of value) {
    const code = character.codePointAt(0);
    if (character === '\\') escaped += '\\\\';
    else if (character === '"') escaped += '\\"';
    else if (character === '\t') escaped += '\\t';
    else if (character === '\n') escaped += '\\n';
    else if (character === '\r') escaped += '\\r';
    else if (character === '\b') escaped += '\\b';
    else if (character === '\f') escaped += '\\f';
    else if (code < 0x20 || code === 0x7f) {
      escaped += '\\u' + code.toString(16).padStart(4, '0');
    } else escaped += character;
  }
  return escaped;
}

function escapeIri(value) {
  assertIri(value);
  return value.replace(/[<>"{}|^`\\\u0000-\u0020]/g, (character) =>
    '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
}

function hex(value) {
  assertText(value, 'blank-node component');
  return Buffer.from(value, 'utf8').toString('hex');
}
function compound(t, name, arity) { return t?.type === 'compound' && t.name === name && t.args.length === arity; }
function textAtom(t, label) {
  if (t?.type !== 'atom') throw new Error(label + ' must be an atom');
  assertText(t.name, label);
  return t.name;
}

function assertText(value, label) {
  if (typeof value !== 'string') throw new Error(label + ' must be text');
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code >= 0xd800 && code <= 0xdfff) throw new Error(label + ' contains an invalid Unicode scalar value');
  }
}

function assertIri(value, label = 'IRI') {
  assertText(value, label);
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value)) throw new Error(label + ' must be absolute');
  if (/[\u0000-\u0020<>"{}|^`\\]/u.test(value)) throw new Error(label + ' contains an invalid character');
}

function normalizedLanguage(value) {
  if (!/^[A-Za-z]+(?:-[A-Za-z0-9]+)*$/u.test(value)) throw new Error('invalid language tag');
  return value.toLowerCase();
}

function assertLiteral(term) {
  assertText(term.value, 'literal');
  const language = term.language ?? '';
  const direction = term.direction ?? '';
  if (language) {
    normalizedLanguage(language);
    if (direction && direction !== 'ltr' && direction !== 'rtl') throw new Error('base direction must be ltr or rtl');
    return;
  }
  if (direction) throw new Error('base direction requires a language tag');
  assertIri(term.datatype ?? XSD_STRING, 'datatype IRI');
}

function assertRdfTerm(term) {
  if (term?.kind === 'namedNode') return assertIri(term.value);
  if (term?.kind === 'blankNode') {
    assertText(term.scope, 'blank-node scope');
    return assertText(term.value, 'blank-node label');
  }
  if (term?.kind === 'literal') return assertLiteral(term);
  if (term?.kind === 'triple') return assertTriple(term.subject, term.predicate, term.object);
  throw new Error('invalid RDF term');
}

function assertTriple(subject, predicate, object) {
  if (!['namedNode', 'blankNode'].includes(subject?.kind)) throw new Error('RDF subject must be an IRI or blank node');
  if (predicate?.kind !== 'namedNode') throw new Error('RDF predicate must be an IRI');
  if (!['namedNode', 'blankNode', 'literal', 'triple'].includes(object?.kind)) throw new Error('invalid RDF object');
  assertRdfTerm(subject);
  assertRdfTerm(predicate);
  assertRdfTerm(object);
}

function assertQuad({ subject, predicate, object, graph }) {
  assertTriple(subject, predicate, object);
  if (!['namedNode', 'blankNode', 'defaultGraph'].includes(graph?.kind)) throw new Error('invalid RDF graph');
  if (graph.kind !== 'defaultGraph') assertRdfTerm(graph);
}

// Package-neutral aliases.
export const quadToProlog = quadToEyeProlog;
export const prologQuadToNQuad = eyePrologQuadToNQuad;
export const fromProlog = fromEyeProlog;
