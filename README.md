# Mermaid-Melody-Editor

Éditeur visuel pour les diagrammes [Mermaid](https://mermaid.js.org), sous forme d'application web. Le code Mermaid et le canvas restent synchronisés dans les deux sens : modifier l'un met à jour l'autre immédiatement.

## Fonctionnalités

- **Édition visuelle de 7 types de diagrammes**
  - **Organigrammes** (`flowchart` / `graph`) : plus de 40 formes, liens (pleins, pointillés, épais, invisibles, flèches, cercles, croix, longueur), sous-graphes imbriqués, `classDef`, styles et liens cliquables.
  - **Séquences** : participants et acteurs, messages (tous les types de flèches), notes, blocs `loop` / `alt` / `opt` / `par` / `critical` / `break` / `rect` avec leurs branches, activations, numérotation automatique.
  - **Classes** : attributs et méthodes, annotations, génériques, relations UML (héritage, composition, agrégation, dépendance, réalisation…), cardinalités, espaces de noms, notes.
  - **Entité-relation** : entités avec attributs (types, clés PK/FK/UK, commentaires), alias, cardinalités en pattes d'oie, relations identifiantes ou non.
  - **États** : états, débuts et fins, choix, fork/join, états composites imbriqués, notes, transitions.
  - **Cartes mentales** : arbre mis en page automatiquement, 7 formes, icônes, ajout rapide au clavier, déplacement d'une idée par glisser-déposer.
  - **Gantt** : sections, tâches et jalons, dépendances `after` / `until`, déplacement et redimensionnement des barres à la souris, jours exclus (week-ends, dates).
- **Les autres types Mermaid** (pie, journey, gitGraph, timeline, C4…) s'éditent en code avec aperçu en direct.
- **Éditeur de code** avec coloration syntaxique, autocomplétion et erreurs soulignées à la bonne ligne.
- **Aperçu Mermaid** rendu par le moteur officiel, avec zoom, thèmes Mermaid (`default`, `neutral`, `forest`, `dark`, `base`) et style dessiné à la main.
- **Export** SVG, PNG, `.mmd`, Markdown et projet `.json` (code et mise en page) ; copie du code, du bloc Markdown ou du SVG.
- **Import** de fichiers `.mmd`, `.md` (tous les blocs ```` ```mermaid ````) et `.json`, par menu ou glisser-déposer ; collage de code.
- **Partage** par lien (le diagramme est compressé dans l'URL, au format compatible avec Mermaid Live) et ouverture directe dans Mermaid Live.
- **Documents multiples** enregistrés dans le navigateur, avec recherche, renommage, duplication et suppression.
- **Annuler / rétablir** sur toutes les modifications, du code comme du canvas.
- **Interface en français et en anglais**, thèmes clair et sombre, affichage adapté au mobile.

Aucun serveur n'est nécessaire : l'application est entièrement statique et les données restent dans le navigateur.

## Démarrage

Prérequis : Node.js 22.12 ou plus récent.

```bash
npm install
```

```bash
npm run dev
```

L'application est alors disponible sur http://localhost:5173.

Autres commandes :

```bash
npm test
```

```bash
npm run build
```

Le build produit un site statique dans `dist/`, déployable sur n'importe quel hébergement de fichiers (chemins relatifs).

## Raccourcis

| Raccourci | Action |
| --- | --- |
| `Ctrl+Z` / `Ctrl+Maj+Z` | Annuler / rétablir |
| `Suppr` | Supprimer la sélection |
| `Ctrl+D` | Dupliquer la sélection |
| `F2` ou double-clic | Renommer |
| `Ctrl+A` | Tout sélectionner |
| `Ctrl+S` | Exporter en `.mmd` |
| `Tab` / `Entrée` | Carte mentale : idée enfant / idée sœur |

Sur les canvas, on relie deux éléments en glissant depuis un point bleu ; relâcher dans le vide crée un nouvel élément relié. Dans les séquences, on crée un message en glissant d'une ligne de vie à une autre.

## Fonctionnement

Le code Mermaid reste la source de vérité. Pour chaque type de diagramme, un parseur transforme le code en modèle éditable et un sérialiseur régénère le code après une modification sur le canvas, dans un style proche de l'écriture manuelle (formes à la première mention, ordre des liens conservé, commentaires et lignes inconnues préservés). La position des éléments sur le canvas est propre à l'éditeur : elle est enregistrée avec le document, mais Mermaid calcule toujours sa propre mise en page pour le rendu final.

Le moteur Mermaid officiel sert à la validation, à l'aperçu et aux exports. Les tests comparent chaque parseur au moteur sur un corpus d'exemples : le modèle lu doit correspondre à ce que lit Mermaid, et le code régénéré doit être interprété par Mermaid exactement comme l'original. Pour les Gantt, les dates calculées par l'éditeur sont comparées à celles du moteur.

```
src/
  diagrams/   parseurs, sérialiseurs, opérations d'édition et tests, par type de diagramme
  canvas/     éditeurs visuels (React Flow pour les graphes, canvas dédiés pour séquences et Gantt)
  components/ coquille de l'application (barre du haut, documents, aperçu, inspecteur)
  editor/     éditeur de code CodeMirror et langage Mermaid
  lib/        rendu Mermaid, fichiers, liens de partage, stockage local
  store/      états partagés (documents et historique, préférences, sélection)
  i18n/       traductions français / anglais
```

## Licence

[GNU AGPL v3](LICENSE)
