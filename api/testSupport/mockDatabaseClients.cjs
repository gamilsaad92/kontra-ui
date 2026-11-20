'use strict';

jest.mock('pg');
jest.mock('@supabase/supabase-js');

const { createClient } = require('@supabase/supabase-js');

beforeEach(() => {
  createClient.__reset?.();
});
