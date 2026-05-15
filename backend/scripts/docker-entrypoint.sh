#!/bin/sh
set -e

npx prisma migrate deploy

SEED_MODE="${SEED_DATABASE:-auto}"
if [ "$SEED_MODE" = "auto" ] || [ "$SEED_MODE" = "true" ]; then
  USER_COUNT="$(node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.user
  .count()
  .then((count) => {
    console.log(count);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE
)"

  if [ "$SEED_MODE" = "true" ] || [ "$USER_COUNT" = "0" ]; then
    node dist/prisma/seed.js
  else
    echo "Database already has users; skipping seed."
  fi
fi

node dist/src/main.js
