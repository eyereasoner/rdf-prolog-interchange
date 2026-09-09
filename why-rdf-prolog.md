# Why RDF and Prolog?

RDF is useful for exchanging graph data. ISO Prolog is useful for writing
rules and asking questions about it. They can be used together with a small
converter.

```text
RDF input
    | rdf-to-prolog
    v
rdf/4 facts + your Prolog rules
    | run a query and write ground rdf/4 results
    v
Prolog result facts
    | prolog-to-rdf
    v
RDF output
```

RDF contributes identifiers, literals, blank nodes, and graphs. Prolog
contributes terms, unification, rules, recursion, and search. The connection
is simply a choice of Prolog terms for RDF values, documented in the
[mapping guide](MAPPING.md).

This package performs the conversions. [EyeProlog](https://github.com/eyereasoner/eyeprolog)
or another Prolog engine runs the rules. You can inspect the intermediate
facts, use ordinary Prolog tools, and convert the results back to RDF.

The examples call their result query `result_rdf/4`, but that name is not
required by the converter. What matters is that the output contains valid,
ground `rdf/4` facts.

The rules determine what is inferred. Converting RDF into facts does not
automatically give a Prolog program RDF entailment semantics, and
negation-as-failure does not turn missing RDF statements into false ones.
Literal spelling and blank-node identity also need to be respected when
writing rules.

The useful pieces are the converters, the documented mapping, and the
[examples you can run](examples/README.md). RDF and ISO Prolog provide the
existing foundations.
