# Data Sets

## topLanguages.ts

`topLanguages.ts` exports an array named `topLanguages` containing common languages ordered by total number of speakers. The order is descending so the most widely spoken languages appear first. Import this file in any script that needs a consistent list of language names:

```ts
import { topLanguages } from '../data/topLanguages';
```

This dataset is currently used by `server/scripts/bulkCreateLanguageTutors.ts` to generate example agents, but it can be reused for other tasks as well.

## Populating the Database with Language Tutors

Follow these steps to add the example language tutor templates to your database:

1. Make sure the `DATABASE_URL` environment variable is configured and that the database is reachable.
2. Run the seed script:

```bash
npm run seed:languages
```

The script creates 100 public, active language tutor templates using the languages listed in `server/data/topLanguages.ts`. It uses the shared curriculum without generating paid translations, images, or audio. New tutors use `gpt-4o` through the application's existing chat routing.

The same initializer runs when the application starts, so the published database receives missing built-in tutors after the user republishes. A development seed alone does not confirm the live catalog was updated.

The initializer uses a transaction-scoped database lock to avoid duplicate entries across concurrent workers. It only repairs catalog records owned by the dedicated language-tutor system identity; private or user-created agents with matching names are left unchanged. Existing nonempty teaching instructions and model choices are retained. No schema changes are performed at startup.
