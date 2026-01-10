/**
 * Linear Team Issues Dashboard Service
 * REFACTORED: Now re-exports from modular structure in /services/linear/
 * 
 * All exports maintained for backward compatibility.
 * New code should import from /services/linear/ modules directly.
 */

export * from './linear/types';
export * from './linear/helpers';

import { linearQueries } from './linear/queries';
import { linearMutations } from './linear/mutations';
import * as helpers from './linear/helpers';

export const LinearQueries = linearQueries;
export const LinearMutations = linearMutations;
export const LinearHelpers = helpers;

import linearTeamIssuesService from './linear';
export default linearTeamIssuesService;
