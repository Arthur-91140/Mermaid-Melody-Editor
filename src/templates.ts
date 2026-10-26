import type { DiagramKind } from './diagrams/common';
import type { Language } from './i18n';

export type TemplateKind = Exclude<DiagramKind, 'other'>;

export const TEMPLATE_KINDS: TemplateKind[] = ['flowchart', 'sequence', 'class', 'er', 'state', 'mindmap', 'gantt'];

function blank(kind: TemplateKind, lang: Language): string {
  const fr = lang === 'fr';
  const today = new Date().toISOString().slice(0, 10);
  switch (kind) {
    case 'flowchart':
      return `flowchart TD\n    A[${fr ? 'Début' : 'Start'}]`;
    case 'sequence':
      return 'sequenceDiagram\n    participant A\n    participant B';
    case 'class':
      return 'classDiagram\n    class Animal';
    case 'er':
      return `erDiagram\n    ${fr ? 'ENTITE' : 'ENTITY'}`;
    case 'state':
      return `stateDiagram-v2\n    [*] --> ${fr ? 'Etat1' : 'State1'}`;
    case 'mindmap':
      return `mindmap\n    root((${fr ? 'Idée' : 'Idea'}))`;
    case 'gantt':
      return `gantt\n    dateFormat YYYY-MM-DD\n    section Phase 1\n    ${fr ? 'Première tâche' : 'First task'} :t1, ${today}, 3d`;
  }
}

function example(kind: TemplateKind, lang: Language): string {
  const fr = lang === 'fr';
  const today = new Date();
  const day = (offset: number) => new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);
  switch (kind) {
    case 'flowchart':
      return fr
        ? `flowchart TD
    A([Commande reçue]) --> B{Stock disponible ?}
    B -->|Oui| C[Préparer le colis]
    B -->|Non| D[Commander au fournisseur]
    D --> E[(Base fournisseurs)]
    D -.-> C
    subgraph Expedition [Expédition]
        C --> F[Étiqueter]
        F --> G[/Remettre au transporteur/]
    end
    G --> H((Livré))
    classDef ok fill:#d1fae5,stroke:#059669
    class H ok`
        : `flowchart TD
    A([Order received]) --> B{In stock?}
    B -->|Yes| C[Pack the parcel]
    B -->|No| D[Order from supplier]
    D --> E[(Supplier DB)]
    D -.-> C
    subgraph Shipping
        C --> F[Print label]
        F --> G[/Hand over to carrier/]
    end
    G --> H((Delivered))
    classDef ok fill:#d1fae5,stroke:#059669
    class H ok`;
    case 'sequence':
      return fr
        ? `sequenceDiagram
    autonumber
    actor U as Utilisateur
    participant W as Application web
    participant API
    participant DB as Base de données
    U->>+W: Se connecte
    W->>+API: POST /login
    API->>+DB: Vérifier le mot de passe
    DB-->>-API: OK
    alt Identifiants valides
        API-->>W: Jeton de session
        W-->>U: Tableau de bord
    else Identifiants invalides
        API-->>W: 401
        W-->>U: Message d'erreur
    end
    deactivate API
    deactivate W
    Note over U,W: La session expire après 30 minutes`
        : `sequenceDiagram
    autonumber
    actor U as User
    participant W as Web app
    participant API
    participant DB as Database
    U->>+W: Signs in
    W->>+API: POST /login
    API->>+DB: Check password
    DB-->>-API: OK
    alt Valid credentials
        API-->>W: Session token
        W-->>U: Dashboard
    else Invalid credentials
        API-->>W: 401
        W-->>U: Error message
    end
    deactivate API
    deactivate W
    Note over U,W: Sessions expire after 30 minutes`;
    case 'class':
      return `classDiagram
    class Animal {
        <<abstract>>
        +String name
        +int age
        +makeSound()* void
    }
    class Dog {
        +String breed
        +fetch() void
    }
    class Cat {
        +bool indoor
        +purr() void
    }
    class Owner {
        +String name
        +adopt(Animal a) void
    }
    Animal <|-- Dog
    Animal <|-- Cat
    Owner "1" o-- "*" Animal : ${fr ? 'possède' : 'owns'}`;
    case 'er':
      return fr
        ? `erDiagram
    CLIENT ||--o{ COMMANDE : passe
    COMMANDE ||--|{ LIGNE : contient
    PRODUIT ||--o{ LIGNE : "figure dans"
    CLIENT {
        int id PK
        string nom
        string email UK
    }
    COMMANDE {
        int id PK
        int client_id FK
        date creee_le
    }
    LIGNE {
        int commande_id PK, FK
        int produit_id PK, FK
        int quantite
    }
    PRODUIT {
        int id PK
        string libelle
        decimal prix
    }`
        : `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    PRODUCT ||--o{ LINE-ITEM : "appears in"
    CUSTOMER {
        int id PK
        string name
        string email UK
    }
    ORDER {
        int id PK
        int customer_id FK
        date created_at
    }
    LINE-ITEM {
        int order_id PK, FK
        int product_id PK, FK
        int quantity
    }
    PRODUCT {
        int id PK
        string label
        decimal price
    }`;
    case 'state':
      return fr
        ? `stateDiagram-v2
    [*] --> Brouillon
    Brouillon --> EnRelecture : soumettre
    EnRelecture --> Brouillon : refuser
    EnRelecture --> Publie : approuver
    state Publie {
        [*] --> EnLigne
        EnLigne --> Archive : archiver
    }
    Publie --> [*]
    note right of EnRelecture : Deux relecteurs requis`
        : `stateDiagram-v2
    [*] --> Draft
    Draft --> InReview : submit
    InReview --> Draft : reject
    InReview --> Published : approve
    state Published {
        [*] --> Online
        Online --> Archived : archive
    }
    Published --> [*]
    note right of InReview : Two reviewers required`;
    case 'mindmap':
      return fr
        ? `mindmap
    root((Projet))
        Objectifs
            Lancer la v1
            Trouver 100 utilisateurs
        Équipe
            Design
            Développement
            ::icon(fa fa-code)
        Risques
            ))Délais((
            Budget`
        : `mindmap
    root((Project))
        Goals
            Ship v1
            Reach 100 users
        Team
            Design
            Development
            ::icon(fa fa-code)
        Risks
            ))Deadlines((
            Budget`;
    case 'gantt':
      return `gantt
    title ${fr ? 'Lancement du produit' : 'Product launch'}
    dateFormat YYYY-MM-DD
    excludes weekends
    section ${fr ? 'Conception' : 'Design'}
    ${fr ? 'Recherche' : 'Research'} :done, r1, ${day(-10)}, 5d
    ${fr ? 'Maquettes' : 'Mockups'} :active, m1, after r1, 6d
    section ${fr ? 'Réalisation' : 'Build'}
    ${fr ? 'Développement' : 'Development'} :crit, d1, after m1, 10d
    ${fr ? 'Tests' : 'Testing'} :t1, after d1, 4d
    section ${fr ? 'Lancement' : 'Launch'}
    ${fr ? 'Mise en ligne' : 'Go live'} :milestone, after t1, 0d`;
  }
}

export function templateCode(kind: TemplateKind, lang: Language, variant: 'blank' | 'example'): string {
  return variant === 'blank' ? blank(kind, lang) : example(kind, lang);
}
