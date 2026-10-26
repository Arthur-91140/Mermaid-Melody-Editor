/** ER samples shared by the round-trip and engine comparison tests. */
export const ER_CORPUS: string[] = [
  `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses`,

  `erDiagram
    CAR ||--o{ NAMED-DRIVER : allows
    CAR {
        string registrationNumber PK
        string make
        string model
        string[] parts
    }
    PERSON ||--o{ NAMED-DRIVER : is
    PERSON {
        string driversLicense PK "The license #"
        string(99) firstName "Only 99 characters are allowed"
        string lastName
        string phone UK
        int age
    }
    NAMED-DRIVER {
        string carRegistrationNumber PK, FK
        string driverLicence PK, FK
    }
    MANUFACTURER only one to zero or more CAR : makes`,

  `erDiagram
    direction LR
    p[Person] {
        string firstName
        string lastName
    }
    a["Customer Account"] {
        string email
    }
    p ||--o| a : "has an account"
    LONELY`,

  `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER:::hot
    ORDER |o..o| INVOICE : "billed by"
    classDef hot fill:#f96,stroke:#333
    style INVOICE fill:#9cf`,
];
