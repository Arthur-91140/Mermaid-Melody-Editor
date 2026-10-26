/** Sequence samples shared by the round-trip and engine comparison tests. */
export const SEQUENCE_CORPUS: string[] = [
  `sequenceDiagram
    Alice->>John: Hello John, how are you?
    John-->>Alice: Great!
    Alice-)John: See you later!`,

  `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    loop HealthCheck
        John->>John: Fight against hypochondria
    end
    Note right of John: Rational thoughts <br/>prevail!
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Jolly good!`,

  `sequenceDiagram
    title: Shop
    actor U as User
    participant W as Web server
    participant D@{ "type": "database" }
    U->>+W: GET /cart
    W->>+D: SELECT
    D-->>-W: rows
    W-->>-U: 200 OK
    U-xW: cancel
    U--xW: cancel (async)
    W--)U: notify
    U<<->>W: sync
    U<<-->>W: sync dotted`,

  `sequenceDiagram
    Alice->>Bob: Hello Bob, how are you?
    alt is sick
        Bob->>Alice: Not so good :(
    else is well
        Bob->>Alice: Feeling fresh like a daisy
    end
    opt Extra response
        Bob->>Alice: Thanks for asking
    end
    par Alice to Bob
        Alice->>Bob: Hello guys!
    and Alice to John
        Alice->>John: Hello guys!
    end
    critical Establish a connection
        Bob-->John: connect
    option Network timeout
        Bob-->Bob: Log error
    end
    break when the booking fails
        Bob-->Alice: show failure
    end
    rect rgb(191, 223, 255)
        Alice->>John: inside rect
    end`,

  `sequenceDiagram
    box Purple Alice & John
        participant A
        participant J
    end
    box Another Group
        participant B
        participant C
    end
    A->>J: Hello John, how are you?
    J->>A: Great!
    A->>B: Hello Bob, how is Charley?
    B->>C: Hello Charley, how are you?`,

  `sequenceDiagram
    autonumber
    Alice->>Bob: Hi Bob
    activate Bob
    Bob->>Alice: Hi Alice
    deactivate Bob
    create participant Carl
    Alice->>Carl: Hi Carl!
    create actor D as Donald
    Carl->>D: Hi!
    destroy Carl
    Alice-xCarl: We are too many
    Note left of Alice: left
    Note over Alice,Bob: A typical interaction
    %% a comment
    Alice->>Bob: I #9829; you #59; really`,

  `sequenceDiagram
    Alice->>Bob: first
    participant Zed
    Bob->>Zed: later declared
    Bob->>Alice:`,
];
