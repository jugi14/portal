export * from './types';
export * from './helpers';
export { linearQueries as LinearQueries } from './queries';
export { linearMutations as LinearMutations } from './mutations';
export { LINEAR_QUERIES } from './graphql-queries';
export { LINEAR_MUTATIONS } from './graphql-mutations';

import { linearQueries } from './queries';
import { linearMutations } from './mutations';
import * as helpers from './helpers';

export const LinearHelpers = helpers;

export const linearTeamIssuesService = {
  ...linearQueries,
  ...linearMutations,
  ...helpers
};

export default linearTeamIssuesService;
