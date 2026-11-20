'use strict';

const blocked = () => {
  throw new Error('[test isolation] Live PostgreSQL database connections are blocked. Direct PostgreSQL clients are blocked.');
};

class Pool {
  connect = blocked;
  query = blocked;
  end = async () => undefined;
  on = () => this;
}

class Client {
  connect = blocked;
  query = blocked;
  end = async () => undefined;
  on = () => this;
}

module.exports = { Pool, Client };
