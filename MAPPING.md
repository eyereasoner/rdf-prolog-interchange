# RDF as Prolog facts

This guide describes the representation used by the two converters.

Each RDF quad becomes an ordinary ground Prolog fact:

```prolog
rdf(Subject, Predicate, Object, Graph).
```

For example, the RDF triple

```turtle
<https://example.org/alice> <https://example.org/knows> <https://example.org/bob> .
```

becomes:

```prolog
rdf(iri('https://example.org/alice'),
    iri('https://example.org/knows'),
    iri('https://example.org/bob'),
    default_graph).
```

## Terms

| RDF value | Prolog term |
| --- | --- |
| IRI | `iri(Value)` |
| Blank node | `bnode(Scope, Label)` |
| Typed literal | `literal(Value, datatype(IRI))` |
| Language string | `literal(Value, lang(Language))` |
| Directional language string | `literal(Value, lang(Language, ltr))` or `literal(Value, lang(Language, rtl))` |
| RDF 1.2 triple term | `triple(Subject, Predicate, Object)` |
| Default graph | `default_graph` |

Text values are Prolog atoms. The wrappers distinguish RDF term kinds:
`iri('https://example.org/alice')` represents an IRI; a bare atom with the same
spelling does not. Datatype IRIs are atoms directly inside `datatype/1`.
Triple terms contain recursively encoded RDF terms.

The converter checks term positions, absolute IRIs, language tags, and base
directions. Prolog numbers and strings are rejected in text positions.

## What survives conversion

Literal spelling is preserved. For example,
`literal('0042', datatype('http://www.w3.org/2001/XMLSchema#integer'))`
does not become the Prolog number `42`. Comparing datatype values requires
your program to interpret the lexical forms.

Blank nodes use a scope and a label to preserve identity. Use different
`--scope` values when combining independent inputs whose blank-node labels
might overlap. The same pair identifies the same node; different pairs
identify different nodes. Output blank-node labels may change.

The quad set roundtrips up to blank-node renaming. Original prefixes,
comments, formatting, and source order are not retained. Duplicate output
quads are removed. Empty named graphs are not preserved: there is no quad
for the converter to encode.

## Running rules and writing results

Load the generated facts and your rules in a Prolog engine. The examples use
`result_rdf/4` to select results and `write_results/0` to print them as
ground `rdf/4` facts. These query names are conveniences for the examples;
your application can choose its own.

Pass the resulting facts to `prolog-to-rdf`. It parses the source, extracts
ground `rdf/4` facts, validates their terms, and serializes them. It ignores
directives, rules, queries, and other predicates without executing them.
Malformed or nonground `rdf/4` facts are errors.

See the [worked examples](examples/README.md) for complete commands.

## What the results mean

The Prolog program determines the results. Conversion alone does not apply
RDF, RDFS, or OWL inference rules. A program can implement those rules, but
that is a property of the program.

Negation-as-failure means that a Prolog goal did not succeed; it does not
establish that an RDF statement is false. Blank-node labels identify nodes
within the imported data; they do not become globally meaningful names.
These distinctions matter when writing rules, even though the conversion
itself is straightforward.
