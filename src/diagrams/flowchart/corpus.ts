/** Flowchart samples shared by the round-trip and engine comparison tests. */
export const FLOWCHART_CORPUS: string[] = [
  `flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]`,

  `graph LR
    A --- B
    B-->C[fa:fa-ban forbidden]
    B-->D(fa:fa-spinner);
    B-- text -->E
    E-. dotted .->F
    F== thick ==>G
    G ~~~ H`,

  `flowchart LR
    id1([This is the text in the box])
    id2[[subroutine]]
    id3[(Database)]
    id4((circle))
    id5>asymmetric]
    id6{rhombus}
    id7{{hexagon}}
    id8[/Parallelogram/]
    id9[\\Parallelogram alt\\]
    id10[/Trapezoid\\]
    id11[\\Trapezoid alt/]
    id12(((double circle)))`,

  `flowchart LR
    A --o B
    B --x C
    C <--> D
    D o--o E
    E x--x F
    F ----> G
    G -..-> H
    H ====> I
    I -->|"label with | pipe"| J`,

  `flowchart TB
    c1-->a2
    subgraph one
    a1-->a2
    end
    subgraph two
    b1-->b2
    end
    subgraph three
    c1-->c2
    end
    one --> two
    three --> two
    two --> c2`,

  `flowchart LR
  subgraph TOP
    direction TB
    subgraph B1
        direction RL
        i1 -->f1
    end
    subgraph B2
        direction BT
        i2 -->f2
    end
  end
  A --> TOP --> B
  B1 --> B2`,

  `flowchart LR
    a & b--> c & d
    e --> f & g --> h`,

  `flowchart LR
    A:::someclass --> B
    classDef someclass fill:#f96
    classDef other fill:#9f6,stroke:#333,stroke-width:4px
    class B other
    style A stroke-dasharray: 5 5
    linkStyle 0 stroke:#ff3,stroke-width:4px,color:red;`,

  `flowchart TD
    A@{ shape: doc, label: "Report" } --> B@{ shape: diamond, label: "OK?" }
    B --> C@{ shape: cyl, label: "Store" }
    B --> D@{ shape: lean-r }`,

  `flowchart TD
    A["A double quote:#quot;"] --> B["A dec char:#9829;"]
    B --> C["\`**Bold** markdown\`"]`,

  `flowchart TB
    subgraph "Implicit one"
      a --> b
    end
    subgraph id2 ["Explicit (two)"]
      c
    end
    b --> c
    %% a comment line
    click a "https://mermaid.js.org" "Docs"`,

  `graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;`,
];
