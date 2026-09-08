# RDF and Prolog: Two Standards-Based Legs

The most direct and durable foundation for standards-based reasoning is to
stand on two established standards:

- **W3C RDF** for knowledge representation and interchange;
- **ISO Prolog** for rules, queries, and reasoning.

RDF and Prolog already solve the two essential parts of the problem. This
avoids depending on another rule language becoming standardized or widely
adopted.

```text
                  EyeProlog
               reasoning brain
                      |
            RDF/Prolog Interchange
              /                 \
       W3C RDF                   ISO Prolog
        data leg                 rules leg
```

- [EyeProlog](https://github.com/eyereasoner/eyeprolog) is the ISO Prolog
  reasoning brain, producing answers and inspectable proofs.
- [rdf-prolog-interchange](https://github.com/eyereasoner/rdf-prolog-interchange)
  implements the reversible interchange boundary between RDF datasets and ISO
  Prolog.
- [RDF/Prolog Interchange 1.0](https://github.com/eyereasoner/rdf-prolog-interchange/blob/main/spec/index.md)
  specifies that boundary independently of any implementation.

## The processing model

```text
RDF dataset
    | reversible RPI encoding
    v
ground rdf/4 facts
    + ISO Prolog rules
    | query result_rdf/4
    v
ground result facts
    | reversible RPI decoding
    v
RDF dataset
```

RDF provides global identifiers, literals, blank nodes, triple terms, graphs,
datasets, and interoperable Web syntaxes. ISO Prolog provides terms, variables,
unification, clauses, recursion, queries, and standardized execution behavior.

## RDF/Prolog Interchange

RDF/Prolog Interchange, or RPI, is not a third rule language or a third
architectural leg. It is the narrow interchange contract between RDF and ISO
Prolog. It defines what neither underlying standard defines: the reversible
representation of RDF datasets as ground Prolog facts and the explicit
publication of selected Prolog answers as RDF.

Its core relations are:

```prolog
rdf(Subject, Predicate, Object, Graph).
result_rdf(Subject, Predicate, Object, Graph).
```

RPI preserves RDF term kinds, lexical forms, blank-node identity, RDF 1.2
triple terms, and default and named graphs. Only ground answers explicitly
selected through `result_rdf/4` are published. RDF conversion does not execute
arbitrary Prolog source, and the rules remain ordinary portable ISO Prolog.

RPI is comparable to a language binding or interchange profile. It connects
two standards without redefining either of them.

## EyeProlog

EyeProlog makes the ISO Prolog leg practical. It provides a documented and
tested ISO profile, keeps extensions explicit, and produces inspectable
answers and proofs. The RDF converter remains independent of the solver, so
RDF data, Prolog rules, intermediate results, and RDF output remain separate,
reproducible artifacts.

N3, SPARQL-RL, and RIF are not required by this architecture. They may be
supported as adapters or additional entry points, but they are not foundations
on which RDF/Prolog reasoning depends.

> **Stand on two standards-based legs: W3C RDF for knowledge and ISO Prolog for
> reasoning. RDF/Prolog Interchange connects them without inventing either one
> again.**
