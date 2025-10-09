const responses = {
  authUser: null,
  authError: null,
  tables: {},
};

const passthrough = builder => {
  builder.select = builder.select || (() => builder);
  builder.eq = builder.eq || (() => builder);
  builder.ilike = builder.ilike || (() => builder);
  builder.gte = builder.gte || (() => builder);
  builder.lte = builder.lte || (() => builder);
  builder.textSearch = builder.textSearch || (() => builder);
  builder.order = builder.order || (() => builder);
  builder.limit = builder.limit || (() => builder);
  builder.in = builder.in || (() => builder);
  builder.gte = builder.gte || (() => builder);
  builder.lte = builder.lte || (() => builder);
  return builder;
};

const createBuilder = (table, config) => {
  const builder = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.ilike = () => builder;
  builder.gte = () => builder;
  builder.lte = () => builder;
  builder.textSearch = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.in = () => builder;
  builder.then = (resolve, reject) => {
    const payload = { data: config.records ?? [], error: config.error ?? null };
    return Promise.resolve(payload).then(resolve, reject);
  };
  builder.maybeSingle = () =>
    Promise.resolve({
      data:
        config.maybeSingle ??
        config.single ??
        (Array.isArray(config.records) ? config.records[0] ?? null : null),
      error: config.error ?? null,
    });
  builder.single = () =>
    Promise.resolve({
      data:
        config.single ??
        config.maybeSingle ??
        (Array.isArray(config.records) ? config.records[0] ?? null : null),
      error: config.error ?? null,
    });
  builder.insert = rows => ({
    select: () => ({
      single: () =>
        Promise.resolve({
          data: config.insert ?? (Array.isArray(rows) ? rows[0] : rows),
          error: config.error ?? null,
        }),
      maybeSingle: () =>
        Promise.resolve({
          data: config.insert ?? (Array.isArray(rows) ? rows[0] : rows),
          error: config.error ?? null,
        }),
    }),
  });
  builder.update = () => ({
    in: () => ({
      eq: () => ({
        select: () =>
          Promise.resolve({
            data: config.update ?? [{ id: 'updated' }],
            error: config.error ?? null,
          }),
      }),
    }),
    eq: () => ({
      eq: () => ({
        select: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: config.update ?? { id: 'updated' },
              error: config.error ?? null,
            }),
          single: () =>
            Promise.resolve({
              data: config.update ?? { id: 'updated' },
              error: config.error ?? null,
            }),
        }),
      }),
      select: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: config.update ?? { id: 'updated' },
            error: config.error ?? null,
          }),
        single: () =>
          Promise.resolve({
            data: config.update ?? { id: 'updated' },
            error: config.error ?? null,
          }),
      }),
    }),
  });
  builder.delete = () => ({
    eq: () => ({
      eq: () => ({
        select: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: config.delete ?? { id: 'deleted' },
              error: config.error ?? null,
            }),
        }),
      }),
      select: () => ({
        maybeSingle: () =>
          Promise.resolve({
            data: config.delete ?? { id: 'deleted' },
            error: config.error ?? null,
          }),
      }),
    }),
  });
  return passthrough(builder);
};

const createClient = jest.fn(() => ({
  auth: {
    getUser: jest.fn(() =>
      Promise.resolve({
        data: { user: responses.authUser },
        error: responses.authError ?? null,
      })
    ),
  },
  from: jest.fn(table => {
    const config = responses.tables[table] || {};
    return createBuilder(table, config);
  }),
}));

createClient.__setAuthUser = user => {
  responses.authUser = user;
  responses.authError = null;
};

createClient.__setAuthError = error => {
  responses.authError = error;
};

createClient.__setTable = (table, config) => {
  responses.tables[table] = config;
};

createClient.__reset = () => {
  responses.authUser = null;
  responses.authError = null;
  responses.tables = {};
};

module.exports = { createClient };
