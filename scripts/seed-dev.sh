#!/bin/bash


# rebuild the api container to include the seed script
docker compose -f dev.docker-compose.yaml up --build api -d

# Run the seed script (which includes prisma generate)
docker compose -f dev.docker-compose.yaml exec api npm run seed
