/** Mindmap samples shared by the round-trip and engine comparison tests. */
export const MINDMAP_CORPUS: string[] = [
  `mindmap
  root((mindmap))
    Origins
      Long history
      ::icon(fa fa-book)
      Popularisation
        British popular psychology author Tony Buzan
    Research
      On effectiveness<br/>and features
      On Automatic creation
        Uses
            Creative techniques
            Strategic planning
            Argument mapping
    Tools
      Pen and paper
      Mermaid`,

  `mindmap
    Root
        A[Square]
        B(Rounded)
        C((Circle))
        D))Bang((
        E)Cloud(
        F{{Hexagon}}
            :::urgent large
        G["\`**Markdown** text\`"]
        [No id square]`,

  `mindmap
  id1["Quoted (text)"]
      deeper
    sibling
  %% a comment`,
];
