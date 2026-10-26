/** State diagram samples shared by the round-trip and engine comparison tests. */
export const STATE_CORPUS: string[] = [
  `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,

  `stateDiagram-v2
    state "This is a state description" as s2
    s1 : This is a state description
    s1 : with two lines
    s1 --> s2: A transition
    state fork_state <<fork>>
    [*] --> fork_state
    fork_state --> State2
    fork_state --> State3
    state join_state <<join>>
    State2 --> join_state
    State3 --> join_state
    join_state --> State4
    State4 --> [*]
    state if_state <<choice>>
    State4 --> if_state
    if_state --> False: if n < 0
    if_state --> True : if n >= 0`,

  `stateDiagram-v2
    [*] --> First
    state First {
        [*] --> second
        second --> [*]
    }
    [*] --> NamedComposite
    NamedComposite: Another Composite
    state NamedComposite {
        [*] --> namedSimple
        namedSimple --> [*]
        namedSimple: Another simple
    }
    state "Labelled composite" as LC {
        direction LR
        state Inner {
            a --> b
        }
    }
    First --> LC`,

  `stateDiagram-v2
    direction LR
    State1: The state with a note
    note right of State1
        Important information! You can write
        notes.
    end note
    State1 --> State2
    note left of State2 : This is the note to the left.
    %% comment
    classDef badBadEvent fill:#f00,color:white,font-weight:bold
    class State2 badBadEvent
    State1:::badBadEvent --> State3`,
];
