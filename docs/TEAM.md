# Équipe d'agents

Les définitions de rôle sont dans `.claude/agents/`. Chaque agent reçoit un rôle, un
périmètre de fichiers et une spécification.

```
Architecte (session principale)
 ├─ Développeur données Coran      src/domain/quran, tools/quran-data, assets/data
 ├─ Développeur progression        src/domain/khatm
 ├─ Développeur jardin             src/domain/garden
 ├─ Développeur reconnaissance     src/domain/recognition
 ├─ Développeur interface          src/ui, src/features, src/app
 ├─ Relecteur design               chaque écran, selon les règles d'Apple
 ├─ Testeurs indépendants          __tests__/acceptance de chaque module
 └─ Relecteur sécurité             tout le dépôt, en lecture
```

## Circuit

1. L'architecte écrit la spécification et fixe les interfaces partagées.
2. Le développeur conteste la spécification, implémente, teste, rend un rapport.
3. Un testeur qui n'a pas vu le code s'écrire rédige des tests d'acceptation à partir de
   la spécification et cherche à casser le module. Il ne corrige rien : il rapporte.
4. L'architecte arbitre chaque constat (défaut du code, ou spécification à préciser) et
   renvoie les défauts au développeur du module, qui corrige.
5. On reteste. Le module n'est intégré que lorsque `npm run check` passe, tests
   d'acceptation compris.
6. Chaque écran passe une revue de design : règles d'Apple (pages concernées relues,
   pas citées de mémoire), liste des tics « généré par IA », et note sur cinq critères
   (cohérence, hiérarchie, finition, fonction, originalité). En dessous de 7 sur 10 sur
   un critère, l'écran retourne au développeur.
7. Le relecteur sécurité passe avant chaque push.

## Règles communes

- Chacun reste dans son périmètre de fichiers.
- Personne n'affaiblit un test pour le faire passer.
- Tout rapport distingue : vérifié, non vérifié, douteux.
