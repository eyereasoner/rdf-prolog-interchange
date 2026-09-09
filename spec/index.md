# RDF/Prolog Interchange 1.0

## Editor's Draft, 9 September 2026

This document is an exploratory specification. It is not an ISO standard, a
W3C Standard, or a product conformance claim.

## Abstract

RDF/Prolog Interchange (RPI) defines a reversible mapping between RDF datasets
and ground ISO Prolog facts. It also defines a small result interface through
which an ISO Prolog program can publish selected ground answers as an RDF
dataset.

RPI does not define a new rule language or a new RDF entailment regime. RDF
defines the exchanged data model. ISO Prolog defines the rule language and its
execution. RPI defines only the boundary between them.

The core representation is:

```prolog
rdf(Subject, Predicate, Object, Graph).
```

A conforming program selects publishable conclusions through:

```prolog
result_rdf(Subject, Predicate, Object, Graph).
```

RPI provides an RDF 1.1 profile and a provisional RDF 1.2 profile. The RDF 1.2
profile must identify the RDF 1.2 specification revision it implements until
RDF 1.2 reaches W3C Recommendation status.

## 1. Introduction

RDF and Prolog solve different parts of a knowledge-processing problem.

RDF provides a standardized graph data model with global identifiers,
datatyped values, blank nodes, datasets, and concrete Web syntaxes. ISO Prolog
provides a standardized programming language based on terms, clauses,
unification, and resolution. Applications frequently need both: RDF for
interchange and Prolog for inspectable rules and search.

RPI composes these technologies through a deliberately narrow interface:

```text
RDF dataset
    | encode
    v
ground rdf/4 facts
    + ISO Prolog program
    | query result_rdf/4
    v
ground rdf/4 result facts
    | decode
    v
RDF dataset
```

The mapping is independent of RDF concrete syntax. An RDF dataset may have
been parsed from Turtle, TriG, N-Triples, N-Quads, JSON-LD, RDF/XML, RDFa, or
another syntax. RPI begins after RDF parsing and ends before RDF serialization.

## 2. Conformance language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and
**OPTIONAL** in this document are to be interpreted as described in BCP 14
when, and only when, they appear in all capitals.

An implementation may claim conformance only to the roles and profiles defined
in Section 11.

## 3. Scope

### 3.1 Goals

RPI has the following goals:

1. Preserve RDF terms without coercing them to Prolog numbers, strings, or
   application-specific objects.
2. Represent RDF graph data using ordinary ground ISO Prolog terms.
3. Allow portable ISO Prolog programs to query those terms.
4. Define an explicit and safe boundary for publishing ground results as RDF.
5. Permit an RDF converter to conform without containing or invoking a Prolog
   engine.
6. Support independent implementations and machine-readable conformance tests.

### 3.2 Non-goals

RPI does not define:

- a replacement for RDF, SPARQL, N3, RIF, or Prolog;
- a new rule syntax;
- an RDF, RDFS, OWL, or application entailment regime;
- the logical meaning of arbitrary Prolog predicates;
- an execution order beyond that specified by the selected Prolog profile;
- implicit network retrieval;
- mutation of a source RDF dataset;
- canonical RDF serialization;
- a proof vocabulary;
- a module system or Prolog library profile; or
- a translation from N3 rules to Prolog.

## 4. Terminology

**RDF term** means an IRI, blank node, literal, or, in the RPI-RDF12 profile,
an RDF 1.2 triple term.

**Graph name** means the name of a named graph as permitted by the applicable
RDF specification.

**Quad** means a tuple `(subject, predicate, object, graph)`, where `graph` is
either the default-graph marker or a graph name.

**RPI term** means one of the Prolog terms defined in Section 6.

**Dataset document** means a Prolog text containing only the ground facts
defined by Section 7. It is data and MUST NOT need to be executed to be decoded.

**Rule program** means a Prolog text evaluated by a Prolog processor. A rule
program is distinct from a dataset document even if an implementation permits
the two texts to be loaded together.

**Result relation** means `result_rdf/4` and, when the Dataset Inventory Profile
is used, `result_rdf_graph/1`.

**Text atom** means a Prolog atom whose sequence of characters is the indicated
RDF lexical value, IRI, language tag, blank-node label, or scope identifier.

## 5. Representation principles

### 5.1 Groundness

Every fact produced by an RPI importer MUST be ground. Variables have no RDF
term equivalent and MUST NOT occur in an RPI dataset document.

Every solution accepted from a result relation MUST be ground. A publisher
MUST report an error if a selected result contains a variable.

### 5.2 Explicit term kinds

RPI uses compound terms such as `iri/1`, `literal/2`, and `triple/3` so that RDF
term kinds remain explicit. A bare Prolog atom, integer, float, list, or other
term is not an RDF term merely because an implementation could coerce it into
one.

For example, the following three Prolog terms are distinct and only the first
is a valid RPI encoding of an RDF IRI:

```prolog
iri('https://example.org/alice')
'https://example.org/alice'
"https://example.org/alice"
```

### 5.3 Text values

All RDF textual values MUST be represented abstractly as Prolog atoms. An RPI
source emitter SHOULD use quoted atom syntax for every text atom, even where a
bare atom would happen to be legal.

After the Prolog text is read, the atom's character sequence MUST equal the RDF
character sequence. An emitter MUST escape quotes, backslashes, control
characters, and other characters as required by the target ISO Prolog syntax.
It MUST NOT change Unicode normalization, IRI spelling, percent encoding, or a
literal's lexical form.

RPI interchange text MUST be encoded as UTF-8. A processor that cannot
represent a required Unicode scalar value MUST report an unsupported-character
error rather than substitute or discard that value.

### 5.4 Set semantics

An RDF graph is a set of triples. Consequently, the order of `rdf/4` facts is
not significant and duplicate `rdf/4` facts do not denote duplicate RDF quads.

A portable rule program MUST NOT depend on the source order or multiplicity of
imported `rdf/4` facts. Importers SHOULD emit each distinct fact once.

## 6. RDF term mapping

This section defines an encoding function `E` from RDF terms to ground Prolog
terms and a decoding function `D` in the reverse direction.

### 6.1 IRIs

An RDF IRI `i` is encoded as:

```prolog
iri(I)
```

where `I` is a text atom containing `i`.

Example:

```prolog
iri('https://example.org/alice')
```

`D(iri(I))` is the RDF IRI represented by `I`. A decoder MUST reject `iri(I)`
when `I` is not an atom or does not satisfy the applicable RDF requirements for
an IRI.

### 6.2 Blank nodes

An RDF blank node is encoded as:

```prolog
bnode(Scope, Label)
```

where `Scope` and `Label` are text atoms.

`Scope` is an opaque identifier assigned by the importer to the import scope.
`Label` identifies the blank node within that scope. Neither value is an RDF
IRI, and applications MUST NOT derive RDF meaning from either value.

Within one imported dataset:

- occurrences of the same RDF blank node MUST use the same `(Scope, Label)`
  pair;
- distinct RDF blank nodes MUST use distinct `(Scope, Label)` pairs.

Independent imports SHOULD use distinct scopes unless the caller explicitly
states that they are views of the same blank-node scope.

On decoding, each distinct `(Scope, Label)` pair MUST map to one blank node and
distinct pairs MUST map to distinct blank nodes. A serializer may choose new
blank-node labels. Round-trip equality involving blank nodes is therefore RDF
dataset isomorphism, not textual equality.

Example:

```prolog
bnode('import-7', 'b0')
```

### 6.3 Datatyped literals

An RDF literal with lexical form `lex` and datatype IRI `dt` is encoded as:

```prolog
literal(Lexical, datatype(DatatypeIRI))
```

where `Lexical` and `DatatypeIRI` are text atoms.

Example:

```prolog
literal('0042', datatype('http://www.w3.org/2001/XMLSchema#integer'))
```

The lexical form MUST be preserved. In particular, the example above MUST NOT
be encoded as the Prolog integer `42` or silently canonicalized to the lexical
form `'42'`.

The datatype IRI is represented directly by the atom inside `datatype/1`; it is
not wrapped in `iri/1`.

### 6.4 Language-tagged strings

An RDF language-tagged string with lexical form `lex` and language tag `lang`
is encoded as:

```prolog
literal(Lexical, lang(Language))
```

Example:

```prolog
literal('Bonjour', lang('fr'))
```

`Lexical` and `Language` are text atoms. The language tag MUST satisfy the
requirements of the applicable RDF specification.

### 6.5 Directional language-tagged strings

Under the RPI-RDF12 profile, an RDF directional language-tagged string is
encoded as:

```prolog
literal(Lexical, lang(Language, Direction))
```

`Direction` MUST be the atom `ltr` or `rtl`.

Examples:

```prolog
literal('Welcome', lang('en', ltr))
literal('مرحبا', lang('ar', rtl))
```

This form is not valid under the RPI-RDF11 profile.

### 6.6 RDF 1.2 triple terms

Under the RPI-RDF12 profile, an RDF triple term `(s, p, o)` is encoded
recursively as:

```prolog
triple(E_s, E_p, E_o)
```

where `E_s = E(s)`, `E_p = E(p)`, and `E_o = E(o)`.

Example:

```prolog
triple(
    iri('https://example.org/alice'),
    iri('https://example.org/knows'),
    iri('https://example.org/bob')
)
```

Nested triple terms are encoded by recursive application of this rule. A
decoder MUST enforce the triple-term position and term-kind restrictions of
the identified RDF 1.2 revision.

This form is not valid under the RPI-RDF11 profile.

### 6.7 Default graph marker

The default graph is represented by the atom:

```prolog
default_graph
```

`default_graph` is an RPI structural marker and is not an RDF IRI or blank node.

### 6.8 Mapping table

| RDF value | RPI term |
|---|---|
| IRI | `iri(Value)` |
| Blank node | `bnode(Scope, Label)` |
| Datatyped literal | `literal(Value, datatype(DatatypeIRI))` |
| Language-tagged string | `literal(Value, lang(Language))` |
| Directional language-tagged string | `literal(Value, lang(Language, Direction))` |
| RDF 1.2 triple term | `triple(Subject, Predicate, Object)` |
| Default graph | `default_graph` |

## 7. Dataset mapping

### 7.1 Quad facts

For every quad `(s, p, o, g)` in an RDF dataset, an importer MUST produce:

```prolog
rdf(E(s), E(p), E(o), E(g)).
```

For a triple in the default graph, `E(g)` is `default_graph`. For a triple in a
named graph, `E(g)` is the encoding of its graph name.

The subject, predicate, object, and graph positions MUST satisfy the term-kind
and position constraints of the selected RDF profile. In particular, a
predicate MUST decode to an RDF IRI.

Example RDF quad:

```text
<https://example.org/alice>
<https://example.org/parent>
<https://example.org/bob>
<https://example.org/family>
```

RPI encoding:

```prolog
rdf(
    iri('https://example.org/alice'),
    iri('https://example.org/parent'),
    iri('https://example.org/bob'),
    iri('https://example.org/family')
).
```

### 7.2 Quad Profile

The RPI Quad Profile represents only the set of quads through `rdf/4` facts.
It preserves the default graph and every named graph that contains at least one
triple.

An empty named graph has no quad and therefore cannot be represented by
`rdf/4` alone. The Quad Profile does not preserve the existence of empty named
graphs. Implementations MUST disclose this limitation when claiming the Quad
Profile.

### 7.3 Dataset Inventory Profile

The RPI Dataset Inventory Profile preserves empty graphs by adding ground
`rdf_graph/1` facts.

An importer MUST emit:

```prolog
rdf_graph(default_graph).
```

It MUST also emit one fact for each named graph, including an empty named
graph:

```prolog
rdf_graph(E(GraphName)).
```

Every graph occurring in an `rdf/4` fact MUST also occur in an `rdf_graph/1`
fact. Duplicate `rdf_graph/1` facts are insignificant, and their order is
insignificant.

When decoding a Dataset Inventory document, the graph inventory is the set of
decoded `rdf_graph/1` arguments. Every `rdf/4` graph argument MUST name a graph
in that inventory. A decoder MUST report an error if an `rdf/4` fact refers to
an undeclared graph.

### 7.4 Dataset documents are data

An RPI dataset document MUST contain only:

- `rdf/4` facts;
- `rdf_graph/1` facts when using the Dataset Inventory Profile; and
- Prolog layout text and comments.

It MUST NOT contain directives, rules, queries, variables, or facts for other
predicates.

A decoder MUST parse and inspect a dataset document as data. It MUST NOT load
or execute the document merely to extract RDF.

### 7.5 Extraction Profile

An RPI Publisher MAY additionally support the RPI Extraction Profile. This
profile accepts a larger Prolog text and selects ground `rdf/4` facts without
executing that text.

An Extraction Profile publisher:

- MUST parse the source without consulting or executing it;
- MUST decode every ground `rdf/4` fact;
- MUST report malformed or nonground `rdf/4` facts as errors;
- MUST ignore rules, directives, queries, facts for other predicates, and
  `rdf/4` clauses having a non-empty body; and
- MUST NOT treat ignored content as authorization to perform an operation.

The Extraction Profile is useful for materialized Prolog output and combined
data-and-rule examples. Such a source is not an RPI dataset document unless it
also satisfies Section 7.4.

### 7.6 Ordering

The abstract RPI mapping does not define a source order for facts. A serializer
MAY provide a deterministic ordering for reproducible files, but consumers MUST
NOT assign semantics to that ordering.

## 8. Decoding Prolog facts to RDF

For every accepted ground fact:

```prolog
rdf(S, P, O, G).
```

a publisher MUST:

1. decode `S`, `P`, `O`, and `G` using Section 6;
2. validate the decoded terms and their positions against the selected RDF
   profile;
3. construct the corresponding RDF quad; and
4. add that quad to the output dataset.

Duplicate facts produce one RDF quad because the target graph is a set.

A publisher MUST NOT:

- coerce a bare Prolog atom into an IRI;
- coerce a Prolog number into an RDF literal;
- execute a directive found in a purported dataset document;
- omit a malformed fact and continue silently; or
- change a literal lexical form merely because its datatype is recognized.

Under the Dataset Inventory Profile, `rdf_graph/1` facts MUST be processed as
specified in Section 7.3. A concrete RDF syntax that cannot express an empty
named graph cannot serialize every Dataset Inventory dataset. In that case the
serializer MUST report the limitation or require a syntax capable of
representing the dataset; it MUST NOT claim a lossless serialization.

## 9. Prolog execution and result publication

### 9.1 Input relation

A runner makes imported `rdf/4` facts available to the rule program. Under the
Dataset Inventory Profile it also makes `rdf_graph/1` facts available.

A portable rule program SHOULD treat these predicates as read-only source
relations and SHOULD place derived RDF exclusively in the result relations.

### 9.2 Result relation

A rule program publishes RDF quads by defining:

```prolog
result_rdf(Subject, Predicate, Object, Graph).
```

A runner queries `result_rdf(S, P, O, G)` with four fresh variables and
enumerates its solutions according to the ISO Prolog execution model.

For every solution, the runner MUST:

1. require `S`, `P`, `O`, and `G` to be ground;
2. require `rdf(S, P, O, G)` to be valid under the selected RPI profile; and
3. add the decoded quad to the result dataset.

Solution order and duplicate solutions are insignificant in the resulting RDF
dataset.

### 9.3 Result graph inventory

For Dataset Inventory output, a rule program MUST additionally define:

```prolog
result_rdf_graph(Graph).
```

The runner enumerates `result_rdf_graph(G)` with a fresh variable. Each
solution MUST be ground and MUST be a valid default-graph marker or encoded RDF
graph name.

Every graph occurring in a `result_rdf/4` solution MUST also occur in a
`result_rdf_graph/1` solution. This relation permits a program to publish empty
named graphs.

### 9.4 Example rule program

Given imported parent facts, a portable program can define:

```prolog
ancestor(X, Y) :-
    rdf(X, iri('https://example.org/parent'), Y, _).

ancestor(X, Y) :-
    rdf(X, iri('https://example.org/parent'), Z, _),
    ancestor(Z, Y).

result_rdf(
    X,
    iri('https://example.org/ancestor'),
    Y,
    iri('https://example.org/derived')
) :-
    ancestor(X, Y).
```

The graph wildcard in this example intentionally combines matching parent
facts from all graphs. Applications that require graph separation MUST include
an appropriate graph argument in their relations.

### 9.5 Termination and resources

RPI does not guarantee that a rule program terminates or has finitely many
answers. A runner MAY impose documented time, memory, inference, depth, or
solution limits. Resource exhaustion MUST NOT be reported as logical failure.

### 9.6 Side effects and extensions

An ISO Prolog program may perform operations whose results depend on processor
state or the external environment. RPI does not make such a program
reproducible merely by standardizing its RDF boundary.

Programs using processor extensions MAY be executed, but they MUST NOT be
described as conforming to the RPI Portable ISO Rule Profile unless those
extensions are unreachable during the result query.

## 10. Semantic boundary

### 10.1 Semantics of a run

RDF and ISO Prolog have different semantics. RDF interpretations are
open-world and monotonic: absence of a triple is not falsity, and adding
triples never withdraws a consequence. A definite Prolog program denotes its
least Herbrand model and is evaluated by an ordered, goal-directed search.
Composing them therefore requires saying what the composite means, rather
than leaving that to whatever a particular program computes.

For RPI the answer is deliberately narrow. Given an RDF dataset `D` and a rule
program `P`, let `F` be the ground `rdf/4` facts produced from `D` by
Sections 6 and 7. The meaning of a run is the least Herbrand model of
`F` together with `P`, under the semantics of the identified ISO Prolog
profile, and the published dataset is the decoding of the `result_rdf/4`
subset of that model selected under Section 9.

Two consequences follow, and both are intended:

- The published quads are **assertions made by the program about `D`**. They
  are not consequences of `D` under any RDF entailment regime, and Section
  10.2 applies to any claim otherwise.
- The composite is monotonic in `D` only when `P` is. A definite program
  without negation-as-failure is monotonic, so extending `D` can only extend
  the published dataset. A program using negation-as-failure is not, and
  Section 10.3 applies.

This is a statement about the composite, not a new entailment regime. It
locates the logical content in `P` and confines RPI to the boundary.

### 10.2 No implicit entailment regime

Execution of a Prolog program over an RPI encoding does not by itself
constitute RDF entailment, RDFS entailment, OWL entailment, or any other RDF
entailment regime.

If an application claims that its results implement a particular entailment
regime, that claim belongs to a separate specification or application profile.

### 10.3 Open and closed worlds

RDF does not generally treat absence of a triple as evidence of falsity.
Prolog negation-as-failure can do so for a selected goal under the Prolog
program's operational semantics.

RPI does not transfer negation-as-failure into RDF semantics. A rule program
using negation-as-failure MUST define or document the dataset, graph, or
relation over which closure is assumed when that choice affects published
results.

### 10.4 Graphs are not quoted formulae

An RDF named graph is an RDF graph associated with a graph name. RPI does not
interpret a named graph as an N3 quoted formula, a modal context, a claim of
truth, or a provenance assertion. Applications may assign such roles through
separate vocabularies and rules.

### 10.5 Publication is explicit

Only solutions selected through the result relation are published. A runner
MUST NOT publish every internal Prolog fact or every successful intermediate
goal implicitly.

Applications SHOULD publish derived results into a named graph distinct from
source graphs when provenance, review, or replacement boundaries matter.

### 10.6 Blank nodes are encoded as names

Section 6.2 encodes an RDF blank node as `bnode(Scope, Label)`, a ground term.
An RDF blank node is existentially quantified; a ground Prolog term is a name.
The encoding is therefore a Skolemization of `D`.

This is sound for the purpose RPI serves: a Skolemization entails exactly the
same ground consequences, so a rule program deriving ground results is not
misled by it. It is not an equivalence. `D` and its encoding do not have the
same models, and existential consequences of `D` are not recoverable from the
encoded facts. A rule program MUST NOT treat a `bnode/2` term as an RDF IRI
or as a stable identifier outside its import scope, as required by Section
6.2.

### 10.7 Literal identity is syntactic

Section 6.3 requires a literal's lexical form to be preserved and forbids
canonicalization. Unification and `==/2` compare Prolog terms structurally, so
two literals that denote the same datatype value but differ lexically are
distinct RPI terms and do not unify. For example:

```
literal('0042', datatype('http://www.w3.org/2001/XMLSchema#integer'))
literal('42', datatype('http://www.w3.org/2001/XMLSchema#integer'))
```

These are the same xsd:integer value and two different terms.

Datatype value equality is therefore a relation a rule program provides, not a
property of the encoding. A program that requires value comparison SHOULD
define an explicit relation for it and SHOULD document the datatypes covered.
Section 13.5 additionally requires any datatype conversion offered by an
implementation to keep the original RDF term available.

## 11. Conformance

RPI conformance is expressed along independent axes: implementation role, RDF
term profile, dataset structure profile, and optional source-processing
profile.

### 11.1 Implementation roles

An **RPI Importer** accepts an RDF dataset and produces a conforming RPI dataset
document.

An **RPI Publisher** accepts a conforming RPI dataset document and produces the
corresponding RDF dataset or RDF serialization.

An **RPI Runner** makes imported facts available to a Prolog rule program,
enumerates the result relation, validates every selected result, and constructs
the result dataset.

An implementation MAY claim one or more roles. An importer or publisher is not
required to contain a Prolog solver.

### 11.2 RDF term profiles

An **RPI-RDF11** implementation supports the RDF 1.1 term model. It MUST reject
RDF 1.2 directional language-tagged strings and triple terms.

An **RPI-RDF12** implementation supports the term model of an identified RDF
1.2 revision, including directional language-tagged strings and triple terms.
Until RDF 1.2 becomes a W3C Recommendation, the implementation MUST disclose
the exact RDF 1.2 document revision or release it implements.

### 11.3 Dataset structure profiles

An **RPI-Quad** implementation supports `rdf/4` and accepts the empty-named-
graph limitation described in Section 7.2.

An **RPI-Dataset** implementation supports both `rdf/4` and `rdf_graph/1` and
preserves the complete graph inventory, including empty named graphs.

### 11.4 Source-processing profiles

An **RPI Dataset Document Publisher** accepts the restricted data-only format
defined in Section 7.4.

An **RPI Extraction Publisher** accepts the larger, non-executed Prolog source
format defined in Section 7.5. Supporting extraction does not weaken validation
of selected `rdf/4` facts.

### 11.5 Portable ISO Rule Profile

A rule program conforms to the **RPI Portable ISO Rule Profile** when:

1. it is accepted as conforming Prolog text by the identified ISO Prolog
   profile;
2. it defines the required result relation;
3. every published solution is ground and valid under the selected RPI
   profiles; and
4. evaluation of the result relation does not require non-profile language
   extensions.

The program MAY use ISO-defined control, arithmetic, term, and I/O facilities.
Use of implementation-defined behavior SHOULD be documented when it can alter
the result dataset.

### 11.6 Conformance claim format

A conformance claim MUST identify at least:

- this RPI version;
- one or more implementation roles;
- the RDF term profile;
- the dataset structure profile;
- the source-processing profile of a publisher;
- the ISO Prolog standard, corrigenda, and optional parts used by a runner; and
- for RPI-RDF12, the exact RDF 1.2 revision.

Example:

```text
RPI 1.0 Importer and Publisher;
RPI-RDF12, 2026-04-07 Concepts revision;
RPI-Quad;
RPI-Extraction Publisher.
```

This example is illustrative and does not claim that the cited RDF Concepts
document alone specifies every required RDF syntax or semantic detail.

## 12. Errors

An implementation MUST report an error rather than silently alter or omit data
when it encounters:

- an invalid RDF input term;
- an RDF feature outside the selected profile;
- a non-ground dataset fact or result;
- a malformed RPI compound term;
- an invalid term in an RDF position;
- a datatype value that is not an IRI atom;
- an invalid language tag or direction;
- an undeclared graph in the Dataset Inventory Profile;
- an unsupported character;
- executable content when input is required to satisfy the Dataset Document
  Profile; or
- a target syntax incapable of representing the requested dataset losslessly
  when lossless serialization was requested.

This specification does not require one Prolog exception term, JavaScript
exception class, process exit code, or diagnostic wording. Implementations
SHOULD identify the offending source location and term when available.

## 13. Security considerations

### 13.1 Prolog injection

RDF lexical forms and IRIs are untrusted data. An importer MUST serialize text
atoms using a Prolog-aware writer or an equivalent escaping algorithm. String
concatenation that permits RDF content to terminate a quoted atom can turn data
into a directive or clause and MUST NOT be used.

### 13.2 Data decoding

A publisher reading an RPI dataset document MUST parse it as data and validate
its top-level terms. It MUST NOT consult, load, or execute the document as a
shortcut for extracting `rdf/4` facts.

An Extraction Profile publisher likewise MUST NOT execute its input. It safely
ignores non-selected clauses as specified in Section 7.5; their presence is not
an instruction to the publisher.

### 13.3 Rule execution

A rule program is executable code. Running a program can consume unbounded
resources or access host capabilities exposed by the processor. Implementers
SHOULD provide appropriate isolation, capability restrictions, and resource
limits for untrusted programs.

### 13.4 Network access

RPI term occurrence does not authorize dereferencing an IRI. Importers,
runners, and publishers MUST NOT retrieve an IRI merely because it occurs in an
RPI term unless the calling application separately requests and authorizes that
operation.

### 13.5 Datatype handling

Recognizing a datatype IRI does not require evaluating its lexical form.
Implementations that offer datatype conversion MUST keep the original RDF term
available and MUST treat conversion failures as data-validation outcomes, not
as permission to rewrite the source literal.

## 14. Conformance test suite requirements

An RPI test suite should use manifest-driven positive and negative tests. At a
minimum it MUST cover:

1. IRIs containing quotes, backslashes, percent encodings, and non-ASCII
   characters;
2. preservation of literal lexical forms, including non-canonical numeric
   forms;
3. language tags and RDF 1.2 base direction;
4. blank-node identity within one import;
5. blank-node separation across independent scopes;
6. default and named graphs;
7. empty named graphs under the Dataset Inventory Profile;
8. RDF 1.2 triple terms and nested triple terms;
9. duplicate and reordered facts;
10. invalid predicates, graph names, and compound-term arities;
11. variables in input facts and result solutions;
12. directive and rule injection attempts in dataset documents;
13. round trips compared using RDF dataset isomorphism; and
14. result relations producing valid, duplicate, malformed, and nonground
    solutions.

For every supported dataset `D`, an importer and publisher pair claiming
lossless conformance MUST satisfy:

```text
decode(encode(D)) is dataset-isomorphic to D
```

For the Quad Profile, this requirement is evaluated after excluding the
existence of empty named graphs, as described in Section 7.2.

A runner test suite SHOULD execute the same Portable ISO Rule Profile programs
on at least two independent ISO Prolog processors and compare the resulting RDF
datasets by dataset isomorphism. Such comparison is evidence of portability,
not a replacement for ISO conformance testing.

## 15. Examples

### 15.1 RDF input, Prolog rules, RDF output

Given this Turtle input:

```turtle
@prefix ex: <https://example.org/> .

ex:alice ex:parent ex:bob .
ex:bob ex:parent ex:carol .
```

an RPI-RDF11 Quad Importer produces the following facts, modulo ordering and
layout:

```prolog
rdf(
    iri('https://example.org/alice'),
    iri('https://example.org/parent'),
    iri('https://example.org/bob'),
    default_graph
).

rdf(
    iri('https://example.org/bob'),
    iri('https://example.org/parent'),
    iri('https://example.org/carol'),
    default_graph
).
```

The rule program from Section 9.4 derives three `result_rdf/4` solutions. A
publisher may serialize them as TriG:

```trig
@prefix ex: <https://example.org/> .

ex:derived {
    ex:alice ex:ancestor ex:bob, ex:carol .
    ex:bob ex:ancestor ex:carol .
}
```

This result is an application-derived graph. It is not claimed to follow from
RDF semantics alone.

### 15.2 RDF 1.2 triple term

An RDF 1.2 statement whose object is a triple term can be represented as:

```prolog
rdf(
    iri('https://example.org/alice'),
    iri('https://example.org/claims'),
    triple(
        iri('https://example.org/bob'),
        iri('https://example.org/knows'),
        iri('https://example.org/carol')
    ),
    default_graph
).
```

The embedded triple term is a term. Its occurrence does not by itself assert
the embedded triple as a member of the default graph.

### 15.3 Empty named graph

Under the Dataset Inventory Profile, an empty named graph is represented by:

```prolog
rdf_graph(default_graph).
rdf_graph(iri('https://example.org/empty')).
```

There is no corresponding `rdf/4` fact because the graph contains no triples.

## 16. Relationship to N3

N3 is an expressive Web language for RDF data, quoted formulae, variables,
rules, and built-ins. At the time of this draft, N3 is developed in a W3C
Community Group and is not a W3C Standard.

RPI does not depend on N3. An implementation may provide a separately specified
N3 compiler profile:

```text
supported N3 profile
    | compile
    +-- RDF-compatible data --> RPI rdf/4 facts
    `-- supported rules      --> ISO Prolog clauses
```

Such a profile MUST identify the supported N3 revision, define the translation
of each supported construct, and reject or diagnose unsupported constructs. It
MUST NOT describe N3 quoted formulae as RDF named graphs unless a separate
semantic specification defines that relationship.

Keeping this compiler profile separate allows N3 to remain a productive
authoring and experimentation layer while RDF and ISO Prolog remain the
normative foundations of RPI.

## 17. Relationship to RIF

The W3C Rule Interchange Format includes specifications for combining RIF rule
dialects with RDF and OWL. It is useful prior art for keeping rule-language and
RDF semantics explicit.

RPI has a narrower purpose. It uses ISO Prolog as the program language and
defines a direct term-level dataset boundary. It does not define another rule
dialect or claim compatibility with a RIF dialect.

## 18. Possible future specifications

The following work may build on RPI without expanding the RPI 1.0 core:

- an RDF vocabulary describing an RPI processing job, its dataset, program,
  entry point, profiles, and output graph;
- an N3-to-RPI compiler profile;
- a portable library profile for common RDF operations;
- a proof-certificate representation and RDF proof vocabulary;
- provenance guidance for source and derived graphs;
- streaming and incremental dataset profiles;
- standardized resource-limit reporting; and
- mappings between selected RIF and ISO Prolog profiles.

Each extension should have its own conformance declaration and tests.

## 19. Initial implementation alignment

The `rdf-prolog-interchange` package is the initial implementation experiment
from which this specification was extracted. At the publication date of this
draft it implements:

- the Importer and Publisher roles;
- the RPI-RDF12 term profile, targeting the 7 April 2026 Candidate
  Recommendation Snapshot of RDF 1.2 Concepts;
- the RPI-Quad dataset structure profile; and
- the RPI Extraction Publisher profile.

It does not itself contain a Prolog solver. EyeProlog or another Prolog system
may be composed with it to perform the Runner role. The optional RPI-Dataset
inventory profile, including `rdf_graph/1`, is not currently implemented.

This section is informative. The implementation is evidence and a source of
test cases; it is not normative, and independent implementations are required
to demonstrate interoperability.

## 20. Standardization path

A practical path toward standardization is:

1. publish this mapping as an implementation-neutral draft;
2. align it with the official RDF test suites and ISO Prolog conformance work;
3. implement it independently in at least two RDF stacks and at least two
   Prolog environments;
4. publish an implementation report and unresolved interoperability issues;
5. stabilize a small version 1.0 without adding a new rule language;
6. incubate it under an appropriate open, royalty-free contribution process;
   and
7. seek adoption by a standards-track Working Group when implementer and user
   support justify that step.

A Community Group report may incubate the work but is not itself a W3C
Standard. Advancement to a W3C Recommendation requires the W3C Recommendation
Track through a Working Group.

## 21. References

### Normative foundations

- ISO/IEC 13211-1:1995, *Information technology — Programming languages —
  Prolog — Part 1: General core*, together with applicable published technical
  corrigenda: <https://www.iso.org/standard/21413.html>
- RDF 1.1 Concepts and Abstract Syntax, W3C Recommendation:
  <https://www.w3.org/TR/rdf11-concepts/>
- RDF 1.2 Concepts and Abstract Data Model, latest published version:
  <https://www.w3.org/TR/rdf12-concepts/>
- BCP 14, RFC 2119 and RFC 8174:
  <https://www.rfc-editor.org/info/bcp14>

### Informative references

- Notation3 Language: <https://w3c-cg.github.io/N3/spec/>
- W3C Community Group status and standards-track guidance:
  <https://www.w3.org/community/about/faq/>
- W3C Recommendation Track:
  <https://www.w3.org/policies/process/#recs-and-notes>
- RIF RDF and OWL Compatibility:
  <https://www.w3.org/TR/rif-rdf-owl/>
- `rdf-prolog-interchange`, an existing implementation experiment:
  <https://github.com/eyereasoner/rdf-prolog-interchange>

## 22. One-sentence definition

> RDF/Prolog Interchange maps RDF datasets to ground ISO Prolog facts and maps
> explicitly selected ground Prolog answers back to RDF datasets without
> redefining the semantics of either RDF or Prolog.
