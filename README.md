# rdf-prolog-roundtrip

Standalone RDF 1.2 <-> ISO Prolog quad-set roundtripping toolkit. It converts
RDF dataset quads to ordinary `rdf/4` Prolog facts and ground `rdf/4` facts back
to RDF.
The package contains no Prolog solver.

## RDF/Prolog Interchange specification

The package is the initial implementation experiment for the
[RDF/Prolog Interchange 1.0 editor's draft](spec/index.md). The specification
extracts the package's term mapping and `result_rdf/4` convention into an
implementation-neutral contract; it does not make this implementation
normative.

The current package implements the draft's Importer and Publisher roles,
RPI-RDF12 terms, the RPI-Quad structure profile, and the safe RPI Extraction
Publisher profile. In particular, `prolog-to-rdf` parses Prolog source and
selects ground `rdf/4` facts without executing directives or rules.
The RPI-RDF12 term-model target is the 7 April 2026 Candidate Recommendation
Snapshot of RDF 1.2 Concepts; RDF 1.2 remains standards-track work, so this
target is stated explicitly rather than described as a completed W3C Standard.

The optional RPI-Dataset inventory profile (`rdf_graph/1`), which preserves
empty named graphs, is not implemented. A quad stream cannot record the
existence of an empty named graph. The package also does not implement the
Runner role: EyeProlog or another Prolog system executes rules before their
materialized ground results are passed to `prolog-to-rdf`.

Its vendored source parser is synchronized with EyeProlog's parser while using
a minimal standalone term model. See [`EXTRACTION.md`](EXTRACTION.md) for the
source revision and the intentionally small adaptation boundary.

## Install

```sh
npm install
```

Node.js 18+ is required. N-Quads/N-Triples use the built-in parser. `rdf-parse`
is an optional dependency for Turtle, TriG, JSON-LD, RDF/XML, RDFa, and other
RDF syntaxes.

## Basic roundtrip

```sh
rdf-to-prolog data.ttl -o data.pl
prolog-to-rdf data.pl -o roundtripped.ttl
```

The Prolog representation is:

```prolog
rdf(Subject, Predicate, Object, Graph).
```

`prolog-to-rdf` infers its output syntax from `.nq`, `.ttl`, or `.trig` (or use
`--format nq|ttl|trig`).

## Examples

`examples/` contains 14 flat, complete examples. Every example has exactly the
same five-file shape:

```text
examples/<name>-input.ttl|trig
examples/<name>-input.pl
examples/<name>-rules.pl
examples/<name>-output.pl
examples/<name>-output.ttl|trig
```

The meaning is literal:

```text
RDF input
   | rdf-to-prolog
   v
<name>-input.pl
   + <name>-rules.pl       (ISO Prolog)
   | query result_rdf/4
   v
<name>-output.pl           (ground rdf/4 test results)
   | prolog-to-rdf
   v
RDF output
```

All rule files expose:

```prolog
result_rdf(S, P, O, G).
write_results.
```

`result_rdf/4` is the test query. `write_results/0` prints all its solutions as
ground `rdf/4` facts, which is exactly the format accepted by `prolog-to-rdf`.
See [`examples/README.md`](examples/README.md) for a concrete trust-flow run.

With EyeProlog 1.5.26 or newer, materialize those facts without adding the
resolved `write_results` goal to the output:

```sh
eyeprolog --quiet --goal write_results \
  examples/odrl-dpv-fpv-trust-flow-input.pl \
  examples/odrl-dpv-fpv-trust-flow-rules.pl \
  > examples/odrl-dpv-fpv-trust-flow-output.pl
```

## CLI

RDF -> Prolog:

```sh
rdf-to-prolog [options] input
```

```text
--format TYPE      input media type/extension when needed
--base IRI         base IRI for relative references
--rules FILE       append a rule file (optional convenience)
--include-source   store input as source_rdf/4 and bridge it through rdf/4
--scope NAME       blank-node scope
-o, --output FILE  output file
```

Prolog -> RDF:

```sh
prolog-to-rdf [options] facts.pl
```

```text
--format nq|ttl|trig  RDF output syntax; otherwise inferred from -o
-o, --output FILE     output file
```

`prolog-to-rdf` does not execute rules. A Prolog engine first materializes the
rule result as ground `rdf/4` facts; the checked-in `*-output.pl` files show
exactly what that means.

Aliases `rdf-to-pl` and `pl-to-rdf` are also provided.

## JavaScript API

```js
import {
  compileRdfDocumentToProlog,
  compileRdfToProlog,
  extractRdfFromProlog,
  serializeRdfFromProlog,
} from 'rdf-prolog-roundtrip';

const facts = compileRdfToProlog(nquads);
const nquadsAgain = extractRdfFromProlog(facts);
const turtle = serializeRdfFromProlog(facts, { format: 'ttl' });
```

## Term mapping

| RDF value | Prolog term |
| --- | --- |
| IRI | `iri(Value)` |
| Blank node | `bnode(Scope, Label)` |
| Typed literal | `literal(Value, datatype(IRI))` |
| Language string | `literal(Value, lang(Language))` |
| Directional language string | `literal(Value, lang(Language, ltr))` / `lang(Language, rtl)` |
| RDF 1.2 triple term | `triple(Subject, Predicate, Object)` |
| Default graph | `default_graph` |

RDF textual values are represented by ISO Prolog atoms. The publisher rejects
Prolog strings and numbers in text positions instead of silently coercing
them. IRIs must be absolute, language tags must follow RDF syntax, and RDF 1.2
base direction must be `ltr` or `rtl`.

## Tests

```sh
npm test
```

The example test discovers all 14 names from the flat directory, verifies the
five-file contract, roundtrips every checked-in input/output Prolog dataset,
and verifies that every `*-output.ttl|trig` is exactly the `prolog-to-rdf`
serialization of its matching `*-output.pl`. When `rdf-parse` is installed it
also regenerates each `*-input.pl` from the original Turtle/TriG source.
