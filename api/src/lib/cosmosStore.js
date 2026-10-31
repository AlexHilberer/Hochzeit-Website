import { CosmosClient } from '@azure/cosmos';

export function createCosmosStore({ connectionString, databaseId, containerId }) {
  let containerPromise;
  // Created on first use so a fresh database or local dev container needs no setup step.
  const container = () => {
    containerPromise ??= new CosmosClient(connectionString)
      .database(databaseId)
      .containers.createIfNotExists({ id: containerId, partitionKey: { paths: ['/id'] } })
      .then(({ container }) => container);
    return containerPromise;
  };

  return {
    async getById(id) {
      const { resource } = await (await container()).item(id, id).read();
      return resource ?? null;
    },
    async getByUsername(username) {
      const { resources } = await (await container()).items
        .query({ query: 'SELECT * FROM c WHERE c.username = @username', parameters: [{ name: '@username', value: username }] })
        .fetchAll();
      return resources[0] ?? null;
    },
    async list() {
      const { resources } = await (await container()).items
        .query('SELECT * FROM c ORDER BY c.displayName')
        .fetchAll();
      return resources;
    },
    async create(invitation) {
      const { resource } = await (await container()).items.create(invitation);
      return resource;
    },
    async replace(invitation) {
      const { resource } = await (await container()).item(invitation.id, invitation.id).replace(invitation);
      return resource;
    },
    async remove(id) {
      await (await container()).item(id, id).delete();
    },
  };
}
