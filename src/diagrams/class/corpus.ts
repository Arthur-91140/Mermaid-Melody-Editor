/** Class diagram samples shared by the round-trip and engine comparison tests. */
export const CLASS_CORPUS: string[] = [
  `classDiagram
    note "From Duck till Zebra"
    Animal <|-- Duck
    note for Duck "can fly\\ncan swim"
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
        +String beakColor
        +swim()
        +quack()
    }
    class Fish{
        -int sizeInFeet
        -canEat()
    }
    class Zebra{
        +bool is_wild
        +run()
    }`,

  `classDiagram
    direction RL
    classA --|> classB : Inheritance
    classC --* classD : Composition
    classE --o classF : Aggregation
    classG --> classH : Association
    classI -- classJ : Link(Solid)
    classK ..> classL : Dependency
    classM ..|> classN : Realization
    classO .. classP : Link(Dashed)`,

  `classDiagram
    Customer "1" --> "*" Ticket
    Student "1" --> "1..*" Course
    Galaxy --> "many" Star : Contains
    Animal <|--|> Robot
    Duck *--o Pond`,

  `classDiagram
    class Shape{
        <<interface>>
        noOfVertices
        draw()
    }
    class Color{
        <<enumeration>>
        RED
        BLUE
        GREEN
    }
    class Square~Shape~{
        int id
        List~int~ position
        setPoints(List~int~ points)
        getPoints() List~int~
    }
    class Engine
    <<Service>> Engine
    class Animal["Animal with a label"]
    Animal --> Engine`,

  `classDiagram
    namespace BaseShapes {
        class Triangle
        class Rectangle {
          double width
          double height
        }
    }
    Triangle --> Rectangle
    class Lonely`,

  `classDiagram
    class Animal:::someclass
    class Duck
    Animal <|-- Duck
    classDef someclass fill:#f96
    cssClass "Duck" someclass
    style Animal stroke:#333,stroke-width:4px`,
];
