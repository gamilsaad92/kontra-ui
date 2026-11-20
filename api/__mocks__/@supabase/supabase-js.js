const responses = {
  authUser: null,
  authError: null,
  tables: {},
};

const passthrough = builder => {
  builder.select = builder.select || (() => builder);
  builder.eq = builder.eq || (() => builder);
  builder.is = builder.is || (() => builder);
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
  builder.is = () => builder;
  builder.ilike = () => builder;
  builder.gte = () => builder;
  builder.lte = () => builder;
  builder.textSearch = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.in = () => builder;
  builder.upsert = rows => builder.insert(rows);
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
  builder.insert = rows => {
    const inputRows = Array.isArray(rows) ? rows : [rows];
    const resolved =
      typeof config.insert === 'function' ? config.insert(rows) : config.insert;

    if (config.insert === undefined) {
      if (!Array.isArray(config.records)) {
        config.records = [];
      }
      config.records.push(...inputRows);
    }

    const dataArray =
      resolved === undefined
        ? inputRows
        : Array.isArray(resolved)
        ? resolved
        : [resolved];

    const payload = {
      data: dataArray,
      error: config.error ?? null,
    };

    return {
      select: () => Promise.resolve(payload),
      single: () =>
        Promise.resolve({
          data: dataArray[0] ?? null,
          error: config.error ?? null,
        }),
      maybeSingle: () =>
        Promise.resolve({
            data: dataArray[0] ?? null,
          error: config.error ?? null,
        }),
    };
  };
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
    signInWithPassword: jest.fn(async () => ({
      data: { user: responses.authUser, session: null },
      error: responses.authError ?? null,
    })),
    refreshSession: jest.fn(async () => ({
      data: { user: responses.authUser, session: null },
      error: responses.authError ?? null,
    })),
    signOut: jest.fn(async () => ({ error: null })),
    admin: {
      createUser: jest.fn(async ({ user } = {}) => ({ data: { user: user || null }, error: null })),
      updateUserById: jest.fn(async (id, attributes) => ({
        data: { user: { id, ...attributes } },
        error: null,
      })),
      signOut: jest.fn(async () => ({ error: null })),
    },
  },
  from: jest.fn(table => {
    const config = responses.tables[table] || {};
    return createBuilder(table, config);
  }),
  rpc: jest.fn(async () => ({ data: null, error: null })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(async () => ({ data: { path: 'mock-upload' }, error: null })),
      list: jest.fn(async () => ({ data: [], error: null })),
      remove: jest.fn(async () => ({ data: [], error: null })),
      getPublicUrl: jest.fn(() => ({
        data: { publicUrl: 'http://localhost/mock-file' },
        publicURL: 'http://localhost/mock-file',
      })),
      createSignedUrl: jest.fn(async () => ({
        data: { signedUrl: 'http://localhost/mock-file' },
        error: null,
      })),
    })),
  },
  functions: {
    invoke: jest.fn(async () => ({ data: null, error: null })),
  },
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
